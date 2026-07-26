---
type: Architecture
title: API Server
description: Express server wiring, middleware order, and bootstrap entry points.
tags: [api, express, server]
timestamp: 2026-07-26T19:12:38Z
---

# Entry Point

The API is bootstrapped from `apps/api/src/server.ts`. On startup it calls `bootstrap()` from `apps/api/scripts/ensure-db.mjs` to ensure the SQLite database exists, has the current schema, and is seeded with demo ingredients. The resolved target URL is exported on `process.env.DATABASE_URL` when it was not already set. Then it reads `PORT` (default `3001`), constructs the app via `createApp()`, and starts listening. See [Database Bootstrap](/architecture/db-bootstrap.md) for the resolution and seed details.

# App Composition

`createApp()` lives in `apps/api/src/app.ts`. It wires the Express app in this order:

1. **CORS** — origin from `WEB_ORIGIN` env var (default `http://localhost:5173`), credentials enabled.
2. **JSON body parser** — `express.json()`.
3. **Health route** — `GET /api/health` returns process liveness.
4. **Ingredients router** — `/api/ingredients` delegates to `createIngredientsRouter()` with a supplied or newly created Prisma client. See [Ingredients API](/api/ingredients.md).
5. **Recipes router** — `/api/recipes` delegates to `createRecipesRouter()`. See [Recipes API](/api/recipes.md).
6. **Plan router** — `/api/plan` delegates to `createPlanRouter()`. See [Plan API](/api/plan.md).
7. **Stats router** — `/api/stats` delegates to `createStatsRouter()`. See [Plan API](/api/plan.md).
8. **Cart router** — `/api/cart` delegates to `createCartRouter()`. See [Shopping Cart API](/api/cart.md).
9. **Admin router** — `/api/admin` delegates to `createAdminRouter()`. Exposes the destructive `POST /api/admin/reset` endpoint. See [Admin API](/api/admin.md).

# Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | HTTP port the server binds to. |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (the web dev server). |
| `DATABASE_URL` | (required by Prisma) | Connection string for the SQLite database. |

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/server.ts` | Bootstraps the database, then starts the HTTP server. |
| `apps/api/scripts/ensure-db.mjs` | Idempotent DB bootstrap (target resolution, `db push`, seed). See [Database Bootstrap](/architecture/db-bootstrap.md). |
| `apps/api/prisma/seed.sql` | Idempotent demo ingredient seed. |
| `apps/api/src/app.ts` | Composes middleware and routes, creates or accepts a Prisma client, and exports the app for tests. |
| `apps/api/src/ingredients.ts` | Implements ingredient validation and CRUD routes. See [Ingredients API](/api/ingredients.md). |
| `apps/api/src/recipes.ts` | Implements recipe CRUD routes. See [Recipes API](/api/recipes.md). |
| `apps/api/src/plan.ts` | Implements plan CRUD, stats, and `/cooked` routes. See [Plan API](/api/plan.md). |
| `apps/api/src/plan-utils.ts` | ISO week parsing, `HttpError` helpers, and the `PLAN_SLOTS` enum. |
| `apps/api/src/cart-recompute.ts` | Shared base-unit normalization and auto cart aggregation. See [Cart Recompute](/architecture/cart-recompute.md). |
| `apps/api/src/cart-snapshot.ts` | Builds live carts and freezes or lists historical weeks. See [Shopping Cart API](/api/cart.md). |
| `apps/api/src/cart.ts` | Implements cart reads and current-week manual-line CRUD. See [Shopping Cart API](/api/cart.md). |
| `apps/api/src/admin.ts` | Implements the destructive `POST /reset` handler that clears every user-managed table and re-seeds the demo set. See [Admin API](/api/admin.md). |
| `apps/api/src/seed.ts` | Idempotent seed invoked by the admin reset and by the startup auto-seed. See [Seed Data](/architecture/seed-data.md). |
| `apps/api/prisma/schema.prisma` | Data model (see [Database Schema](/database/schema.md)). |
| `apps/api/tests/health.test.ts` | Supertest check for `/api/health`. |
| `apps/api/tests/ingredients.test.ts` | Supertest coverage for ingredient CRUD and errors. |
| `apps/api/tests/db-bootstrap.test.ts` | Vitest coverage of the bootstrap resolution and short-circuit paths. |

# Registering New Routes

`createApp(prisma?)` accepts an optional Prisma client for isolated tests. Register routers in `apps/api/src/app.ts` after the CORS and JSON middleware, and inject the client into data-backed routers rather than constructing clients inside route handlers.

# Routing Diagram

```
Client (apps/web)
  └── HTTP ──► Express (apps/api/src/app.ts)
                     ├── CORS
                     ├── JSON parser
├── /api/health
                      ├── /api/ingredients ──► Prisma ──► SQLite
                      ├── /api/recipes ──► Prisma ──► SQLite
                      ├── /api/plan ──► Prisma ──► SQLite
                      │       └── recomputeAutoCartForWeek (CartItem)
                       └── /api/cart ──► live aggregation + CartItem + CartHistory
                       └── /api/admin ──► destructive reset + reseed
```

Before the HTTP server starts, `apps/api/src/server.ts` calls `bootstrap()` from `apps/api/scripts/ensure-db.mjs` so the SQLite file exists, has the current schema, and contains the demo seed. See [Database Bootstrap](/architecture/db-bootstrap.md).
