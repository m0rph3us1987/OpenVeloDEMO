---
type: Architecture
title: Database Bootstrap
description: Idempotent helper that creates the SQLite database, applies the Prisma schema, and seeds demo ingredients on every API startup.
tags: [database, prisma, bootstrap, seed, ci]
timestamp: 2026-07-26T13:54:15Z
---

# Purpose

`apps/api/scripts/ensure-db.mjs` guarantees that the SQLite database backing the API is ready before any HTTP request is served. It is invoked automatically by `apps/api/src/server.ts` on startup and is also executed by `setup.sh` as part of repository provisioning. The script is **idempotent** — re-running it against an already-prepared database is safe and fast.

# Resolution Order

The script resolves the target database file in this order:

1. **Honor `$DATABASE_URL`** — if the environment variable is set, its existing value is used as-is and the bootstrapper does not probe writability (caller owns the file).
2. **Persistent volume** — defaults to `/data/openvelo/dev.db`. This path is the persistence target used in containerised jobs and CI.
3. **Local fallback** — if `/data/openvelo` is not writable (e.g. a plain developer machine), the script falls back to `apps/api/data/dev.db` and creates the parent directory.

The resolved target is returned to the bootstrap caller and the URL is exported on `process.env.DATABASE_URL` when it was not already set, so Prisma sees a consistent connection string.

# Actions Performed

For the resolved target, the script:

1. Creates the parent directory of the database file if missing (`mkdirSync({ recursive: true })`).
2. If the database file does **not** exist, runs `prisma db push --skip-generate --accept-data-loss --schema <schema.prisma>` to materialise the schema.
3. Runs `prisma db execute --schema <schema.prisma> --file <seed.sql>` to apply the demo seed.
4. Logs the resolved `DATABASE_URL` for observability.

If the database file already exists, the `db push` step is skipped (only the seed step runs), so re-running does not rewrite or migrate an existing database.

# Seed Data

`apps/api/prisma/seed.sql` uses `INSERT OR IGNORE` against the unique `Ingredient.name` index so the seed is safe to re-run. The seven demo rows are:

| Name | Category | Base unit |
|------|----------|-----------|
| Beef | Meat | `g` |
| Tomato | Vegetables | `pcs` |
| Milk | Dairy | `ml` |
| Rice | Grains | `g` |
| Salt | Spices | `g` |
| Pepper | Spices | `g` |
| Olive Oil | Other | `ml` |

The seed uses stable IDs prefixed with `seed-…` so it can be referenced in tests and documentation.

Recipe rows are **not** seeded by `seed.sql`. The four demo recipes are owned by the [Seed Data](/architecture/seed-data.md) TypeScript module, which `apps/api/src/server.ts` invokes on startup whenever the `Recipe` table is empty and which `POST /api/admin/reset` re-runs after wiping the workspace.

# Wiring

```text
setup.sh
  └── node scripts/ensure-db.mjs
        └── resolve target (env /data /local)
        └── prisma db push      (only if file missing)
        └── prisma db execute   (seed.sql)

apps/api/src/server.ts
  └── await bootstrap()         (executed before createApp + listen)
        └── resolve target
        └── prisma db push      (only if file missing)
        └── prisma db execute   (seed.sql)
        └── sets process.env.DATABASE_URL if unset
```

# Testability

The script exports `bootstrap(deps)` and a `PATHS` constant. The `deps` parameter is a bag of injectable functions (`execFileSync`, `existsSync`, `mkdirSync`, `access`, `constants`, `env`, `log`) so the bootstrap logic can be exercised without touching the filesystem or invoking Prisma. See `apps/api/tests/db-bootstrap.test.ts` for the test matrix.

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/scripts/ensure-db.mjs` | Bootstrap implementation (target resolution, `db push`, `db execute`). |
| `apps/api/scripts/ensure-db.d.mts` | Type declarations for the bootstrapper's exported surface. |
| `apps/api/prisma/seed.sql` | Idempotent demo seed (`INSERT OR IGNORE` on `Ingredient.name`). |
| `apps/api/src/server.ts` | Calls `bootstrap()` before starting the HTTP server. |
| `setup.sh` | Runs the bootstrap after `npm ci` and `prisma generate`. |
| `apps/api/tests/db-bootstrap.test.ts` | Vitest coverage of all resolution paths and short-circuits. |
| `apps/api/prisma/schema.prisma` | Defines the schema applied by `db push`. See [Prisma Schema](/database/schema.md). |

# Citations

[1] [Prisma CLI — db push](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#db-push)
[2] [Prisma CLI — db execute](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#db-execute)
