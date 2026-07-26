import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { bootstrap, PATHS } from '../scripts/ensure-db.mjs';

type FakeDeps = {
  execFileSync: Mock;
  existsSync: Mock;
  mkdirSync: Mock;
  access: Mock;
  constants: { W_OK: number };
  env: Record<string, string | undefined>;
  log: Mock;
};

function makeDeps(overrides: Partial<FakeDeps> = {}): FakeDeps {
  return {
    execFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    access: vi.fn().mockResolvedValue(undefined),
    constants: { W_OK: 2 },
    env: {},
    log: vi.fn(),
    ...overrides,
  };
}

const ORIGINAL_ENV = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_ENV;
  }
  vi.restoreAllMocks();
});

describe('ensure-db bootstrap', () => {
  it('short-circuits when the database file is already present', async () => {
    const deps = makeDeps({
      existsSync: vi.fn((p: string) => p === PATHS.PERSISTENT_DB),
    });
    const target = await bootstrap(deps as never);
    expect(target.url).toBe(`file:${PATHS.PERSISTENT_DB}`);
    expect(target.ownsFile).toBe(true);
    // No `prisma db push`, only `prisma db execute` for the seed.
    expect(deps.execFileSync).toHaveBeenCalledTimes(1);
    const args = (deps.execFileSync.mock.calls[0]?.[1] as string[]) ?? [];
    expect(args[1]).toBe('db');
    expect(args[2]).toBe('execute');
  });

  it('runs `prisma db push` then `prisma db execute` when the file is missing', async () => {
    const deps = makeDeps({
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
    });
    const target = await bootstrap(deps as never);
    expect(target.url).toBe(`file:${PATHS.PERSISTENT_DB}`);
    expect(deps.mkdirSync).toHaveBeenCalledWith(PATHS.PERSISTENT_DIR, { recursive: true });
    expect(deps.execFileSync).toHaveBeenCalledTimes(2);
    const firstArgs = (deps.execFileSync.mock.calls[0]?.[1] as string[]) ?? [];
    const secondArgs = (deps.execFileSync.mock.calls[1]?.[1] as string[]) ?? [];
    expect(firstArgs[1]).toBe('db');
    expect(firstArgs[2]).toBe('push');
    expect(secondArgs[1]).toBe('db');
    expect(secondArgs[2]).toBe('execute');
    // DATABASE_URL is passed via env on every execFileSync call.
    for (const call of deps.execFileSync.mock.calls) {
      const env = call[2] as { env: Record<string, string> };
      expect(env.env.DATABASE_URL).toBe(target.url);
    }
  });

  it('falls back to the local DB path when /data is not writable', async () => {
    const deps = makeDeps({
      access: vi.fn().mockRejectedValue(new Error('EACCES')),
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
    });
    const target = await bootstrap(deps as never);
    expect(target.url).toBe(`file:${PATHS.LOCAL_DB}`);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('falling back'));
    expect(deps.mkdirSync).toHaveBeenCalledWith(PATHS.LOCAL_DIR, { recursive: true });
  });

  it('honours an explicit $DATABASE_URL without probing writability', async () => {
    const deps = makeDeps({
      env: { DATABASE_URL: 'file:/tmp/explicit.db' },
      existsSync: vi.fn((p: string) => p === '/tmp/explicit.db'),
    });
    const target = await bootstrap(deps as never);
    expect(target.url).toBe('file:/tmp/explicit.db');
    expect(target.ownsFile).toBe(false);
    // Only the seed step runs because the explicit file already exists.
    expect(deps.access).not.toHaveBeenCalled();
    expect(deps.execFileSync).toHaveBeenCalledTimes(1);
  });
});
