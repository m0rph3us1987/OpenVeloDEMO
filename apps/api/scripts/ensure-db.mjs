#!/usr/bin/env node
// Ensures the SQLite database used by the API exists, has the current schema,
// and is seeded with demo ingredients. Idempotent: safe to run on every
// setup/dev cycle.
//
// Resolution order:
//   1. Honour $DATABASE_URL if it is already set.
//   2. Otherwise prefer the persistent volume at /data/openvelo/dev.db
//      (writable in containerised jobs).
//   3. Fall back to a local file under apps/api/data/dev.db when /data
//      is not writable (e.g. plain developer machine).
//
// On selected target the script:
//   - creates the parent directory if missing,
//   - runs `prisma db push` to materialise the schema,
//   - runs `prisma db execute --file <seed.sql>` to populate demo rows.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(PACKAGE_ROOT, 'prisma', 'schema.prisma');
const SEED_PATH = path.join(PACKAGE_ROOT, 'prisma', 'seed.sql');
const CONSTRAINTS_PATH = path.join(PACKAGE_ROOT, 'prisma', 'constraints.sql');

const PERSISTENT_DIR = '/data/openvelo';
const PERSISTENT_DB = path.join(PERSISTENT_DIR, 'dev.db');
const LOCAL_DIR = path.join(PACKAGE_ROOT, 'data');
const LOCAL_DB = path.join(LOCAL_DIR, 'dev.db');

const require = createRequire(import.meta.url);
const PRISMA_BIN = require.resolve('prisma/build/index.js');

export const PATHS = Object.freeze({
  PERSISTENT_DIR,
  PERSISTENT_DB,
  LOCAL_DIR,
  LOCAL_DB,
  SCHEMA_PATH,
  CONSTRAINTS_PATH,
  SEED_PATH,
  PRISMA_BIN,
});

export const realDeps = Object.freeze({
  execFileSync,
  existsSync,
  mkdirSync,
  access,
  constants,
  env: process.env,
  log: (message) => process.stdout.write(`[ensure-db] ${message}\n`),
});

export async function isWritable(dir, deps = realDeps) {
  try {
    await deps.access(dir, deps.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function dbUrlFor(filePath) {
  return `file:${filePath}`;
}

function parseSqlitePath(url) {
  if (url.startsWith('file:')) return url.slice('file:'.length);
  return url;
}

function resolveTarget(env) {
  if (env.DATABASE_URL) {
    return { url: env.DATABASE_URL, label: '$DATABASE_URL', ownsFile: false };
  }
  return { url: dbUrlFor(PATHS.PERSISTENT_DB), label: PATHS.PERSISTENT_DB, ownsFile: true };
}

async function ensureDirFor(filePath, deps) {
  const dir = path.dirname(filePath);
  if (!deps.existsSync(dir)) {
    deps.mkdirSync(dir, { recursive: true });
    deps.log(`created directory ${dir}`);
  }
}

function runPrisma(args, env, deps) {
  deps.execFileSync('node', [PATHS.PRISMA_BIN, ...args], {
    stdio: 'pipe',
    env: { ...deps.env, ...env },
  });
}

export async function bootstrap(deps = realDeps) {
  const target = resolveTarget(deps.env);

  if (target.ownsFile) {
    const filePath = target.label;
    const persistentDir = path.dirname(filePath);
    if (!(await isWritable(persistentDir, deps))) {
      deps.log(`persistent directory ${persistentDir} is not writable; falling back to ${PATHS.LOCAL_DB}`);
      target.url = dbUrlFor(PATHS.LOCAL_DB);
      target.label = PATHS.LOCAL_DB;
    }
    await ensureDirFor(target.label, deps);
  }

  const fileExists = target.ownsFile
    ? deps.existsSync(target.label)
    : deps.existsSync(parseSqlitePath(target.url));

  if (!fileExists) {
    deps.log(`pushing schema to ${target.url}`);
    runPrisma(
      ['db', 'push', '--skip-generate', '--accept-data-loss', '--schema', PATHS.SCHEMA_PATH],
      { DATABASE_URL: target.url },
      deps,
    );
  } else {
    deps.log(`database already present at ${target.label ?? target.url}; skipping db push`);
  }

  deps.log(`seeding ingredients from ${PATHS.SEED_PATH}`);
  runPrisma(
    ['db', 'execute', '--schema', PATHS.SCHEMA_PATH, '--file', PATHS.SEED_PATH],
    { DATABASE_URL: target.url },
    deps,
  );

  deps.log(`applying database constraints from ${PATHS.CONSTRAINTS_PATH}`);
  runPrisma(
    ['db', 'execute', '--schema', PATHS.SCHEMA_PATH, '--file', PATHS.CONSTRAINTS_PATH],
    { DATABASE_URL: target.url },
    deps,
  );

  deps.log(`done. DATABASE_URL=${target.url}`);
  return target;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  bootstrap().catch((err) => {
    process.stderr.write(`[ensure-db] failed: ${err?.message ?? err}\n`);
    if (err?.stdout) process.stderr.write(`stdout: ${err.stdout.toString()}\n`);
    if (err?.stderr) process.stderr.write(`stderr: ${err.stderr.toString()}\n`);
    process.exit(1);
  });
}
