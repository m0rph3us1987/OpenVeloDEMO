---
type: Guide
title: Running the App Locally
description: Step-by-step instructions for developers to install dependencies, run the API and web client, and execute the test suite.
tags: [guide, setup, development]
timestamp: 2026-07-26T13:54:15Z
---

# Prerequisites

- Node.js 20+ (matches `@types/node` ^20).
- npm 10+ (ships with Node 20).

# Install

```bash
npm install
```

This installs all workspaces (`apps/api`, `apps/web`, `packages/types`) in one pass.

For a clean, reproducible install (e.g. in CI or after a fresh clone), a `setup.sh` helper is provided at the repo root:

```bash
./setup.sh
```

It runs `npm ci` non-interactively, generates the Prisma client, and then runs `node scripts/ensure-db.mjs` from `apps/api` to ensure the SQLite database exists, has the current schema, and is seeded with demo ingredients. See [Database Bootstrap](/architecture/db-bootstrap.md) for the resolution rules.

# Configure the Database

The API uses Prisma with SQLite. The bootstrap script handles the database automatically:

- If `DATABASE_URL` is **set**, it is honored as-is.
- Otherwise, the script prefers the persistent path `/data/openvelo/dev.db`. When that directory is not writable (typical on a plain developer machine), it falls back to `apps/api/data/dev.db` and creates the parent directory.

The first API startup creates the database file, applies the schema via `prisma db push`, and loads the demo seed (`Beef`, `Tomato`, `Milk`, `Rice`, `Salt`, `Pepper`, `Olive Oil`). Subsequent startups short-circuit `db push` so the existing schema is preserved.

If you want to migrate a long-lived database manually, the Prisma migrate workflow remains available:

```bash
export DATABASE_URL="file:./data/dev.db"
mkdir -p data
npm run prisma:migrate -w @openvelo/api
```

See [Database Schema](/database/schema.md) and [Database Bootstrap](/architecture/db-bootstrap.md).

# Run Dev Servers

```bash
npm run dev
```

This invokes `concurrently` to start both:

- API on `http://localhost:3001` (see [API Server](/architecture/api-server.md)).
- Web on `http://localhost:5173` (see [Web Application](/architecture/web-app.md)).

# Run Tests

```bash
npm run test
```

Runs vitest in every workspace that defines a `test` script.

# Type Check

```bash
npm run typecheck
```

Runs `tsc --noEmit` across every workspace.

# Build

```bash
npm run build
```

Compiles each workspace that defines a `build` script.

# Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Web shows a CORS error in the browser console. | The web origin is not allowed. | Set `WEB_ORIGIN` (default assumes `http://localhost:5173`). |
| API logs a Prisma error about `DATABASE_URL`. | Database URL not configured and the bootstrap script could not create a writable file. | Check that `/data/openvelo` is writable or set `DATABASE_URL` to a path you can write to. |
| `npm run test` fails on the API with a port-in-use error. | The dev server is already running on `3001`. | Stop `npm run dev` before running tests. |
