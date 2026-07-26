---
type: Architecture
title: API Server
description: Express server wiring, middleware order, and bootstrap entry points.
tags: [api, express, server]
timestamp: 2026-07-26T12:57:49Z
---

# Entry Point

The API is bootstrapped from `apps/api/src/server.ts`. It reads `PORT` (default `3001`), constructs the app via `createApp()`, and starts listening.

# App Composition

`createApp()` lives in `apps/api/src/app.ts`. It wires the Express app in this order:

1. **CORS** — origin from `WEB_ORIGIN` env var (default `http://localhost:5173`), credentials enabled.
2. **JSON body parser** — `express.json()`.
3. **Health route** — `GET /api/health` returns process liveness.
4. **Ingredients router** — `/api/ingredients` delegates to `createIngredientsRouter()` with a supplied or newly created Prisma client. See [Ingredients API](/api/ingredients.md).

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
| `apps/api/src/app.ts` | Composes middleware and routes, creates or accepts a Prisma client, and exports the app for tests. |
| `apps/api/src/ingredients.ts` | Implements ingredient validation and CRUD routes. See [Ingredients API](/api/ingredients.md). |
| `apps/api/prisma/schema.prisma` | Data model (see [Database Schema](/database/schema.md)). |
| `apps/api/tests/health.test.ts` | Supertest check for `/api/health`. |
| `apps/api/tests/ingredients.test.ts` | Supertest coverage for ingredient CRUD and errors. |

# Registering New Routes

`createApp(prisma?)` accepts an optional Prisma client for isolated tests. Register routers in `apps/api/src/app.ts` after the CORS and JSON middleware, and inject the client into data-backed routers rather than constructing clients inside route handlers.

# Routing Diagram

```
Client (apps/web)
  └── HTTP ──► Express (apps/api/src/app.ts)
                     ├── CORS
                     ├── JSON parser
                     ├── /api/health
                     └── /api/ingredients ──► Prisma ──► SQLite
```
