---
type: Architecture
title: API Server
description: Express server wiring, middleware order, and bootstrap entry points.
tags: [api, express, server]
timestamp: 2026-07-26T11:39:07Z
---

# Entry Point

The API is bootstrapped from `apps/api/src/server.ts`. It reads `PORT` (default `3001`), constructs the app via `createApp()`, and starts listening.

# App Composition

`createApp()` lives in `apps/api/src/app.ts`. It wires the Express app in this order:

1. **CORS** — origin from `WEB_ORIGIN` env var (default `http://localhost:5173`), credentials enabled.
2. **JSON body parser** — `express.json()`.
3. **Routes** — currently only `GET /api/health`.

# Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | HTTP port the server binds to. |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (the web dev server). |
| `DATABASE_URL` | (required by Prisma) | Connection string for the SQLite database. |

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/server.ts` | Bootstraps the HTTP server. |
| `apps/api/src/app.ts` | Composes middleware and routes; exported for tests. |
| `apps/api/prisma/schema.prisma` | Data model (see [Database Schema](/database/schema.md)). |
| `apps/api/tests/health.test.ts` | Supertest check for `/api/health`. |

# Registering New Routes

Add new route handlers inside `createApp()` in `apps/api/src/app.ts`, after the CORS and JSON middleware. Any controller module that needs the Prisma client should import it from `@prisma/client` once it is initialized.

# Routing Diagram

```
Client (apps/web)
  └── HTTP ──► Express (apps/api/src/app.ts)
                    ├── CORS
                    ├── JSON parser
                    └── /api/health
```
