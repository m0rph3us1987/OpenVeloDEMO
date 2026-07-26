import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempPath = path.join(
  os.tmpdir(),
  `openvelo-api-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}.db`,
);

const databaseUrl = `file:${tempPath}`;
process.env.DATABASE_URL = databaseUrl;

const prismaBin = path.resolve(__dirname, '..', '..', '..', 'node_modules', '.bin', 'prisma');
const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');

try {
  execFileSync(
    prismaBin,
    ['db', 'push', '--skip-generate', '--accept-data-loss', '--schema', schemaPath],
    {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );
} catch (err) {
  const execErr = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
  const stdout = execErr.stdout?.toString() ?? '';
  const stderr = execErr.stderr?.toString() ?? '';
  throw new Error(
    `Failed to push Prisma schema for tests.\nstdout: ${stdout}\nstderr: ${stderr}\n${execErr.message ?? ''}`,
  );
}

export async function teardown(): Promise<void> {
  await fs.rm(tempPath, { force: true });
  const journal = `${tempPath}-journal`;
  await fs.rm(journal, { force: true });
}
