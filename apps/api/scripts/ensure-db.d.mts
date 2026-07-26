export const PATHS: {
  readonly PERSISTENT_DIR: string;
  readonly PERSISTENT_DB: string;
  readonly LOCAL_DIR: string;
  readonly LOCAL_DB: string;
  readonly SCHEMA_PATH: string;
  readonly SEED_PATH: string;
  readonly PRISMA_BIN: string;
};

export type BootstrapDeps = {
  execFileSync: (file: string, args: readonly string[], options: { stdio: 'pipe'; env: Record<string, string | undefined> }) => unknown;
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
  access: (path: string, mode: number) => Promise<void>;
  constants: { W_OK: number };
  env: Record<string, string | undefined>;
  log: (message: string) => void;
};

export function bootstrap(deps?: Partial<BootstrapDeps>): Promise<{ url: string; label: string; ownsFile: boolean }>;
