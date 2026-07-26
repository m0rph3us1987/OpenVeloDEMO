---
type: Guide
title: Running the App Locally
description: Step-by-step instructions for developers to install dependencies, run the API and web client, and execute the test suite.
tags: [guide, setup, development]
timestamp: 2026-07-26T12:57:49Z
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

It runs `npm ci` non-interactively and is the recommended way to bring up a new environment.

# Configure the Database

The API uses Prisma with SQLite. Set the connection string before starting the API:

```bash
export DATABASE_URL="file:./data/dev.db"
mkdir -p data
npm run prisma:migrate -w @openvelo/api
```

This creates `data/dev.db` and applies the current migration, including the unique ingredient-name constraint required by the [Ingredients API](/api/ingredients.md). See [Database Schema](/database/schema.md).

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
| API logs a Prisma error about `DATABASE_URL`. | Database URL not configured. | Set `DATABASE_URL` and re-run `npm run prisma:migrate`. |
| `npm run test` fails on the API with a port-in-use error. | The dev server is already running on `3001`. | Stop `npm run dev` before running tests. |
