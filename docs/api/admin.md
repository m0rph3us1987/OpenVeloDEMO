---
type: API
title: Admin API
description: Destructive reset endpoint that clears all user-managed data and re-seeds the workspace with the demo ingredient and recipe set.
tags: [api, admin, reset, seed]
timestamp: 2026-07-26T19:12:38Z
---

# Overview

The router in `apps/api/src/admin.ts` is mounted at `/api/admin` by `apps/api/src/app.ts`. It exposes a single destructive endpoint that wipes every user-managed table and re-seeds the workspace with the canonical demo [Seed Data](/architecture/seed-data.md). The endpoint is intended for development and testing only — there is no authentication gate today.

# Endpoints

| Method | Route | Purpose | Success |
|--------|-------|---------|---------|
| `POST` | `/api/admin/reset` | Delete every row from all user-managed tables, then re-run the seed. | `200` reset response. |

# Reset Response

```json
{
  "ok": true,
  "reseeded": true,
  "ingredients": 13,
  "recipes": 4
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ok` | `true` | Always true on success. |
| `reseeded` | `true` | Always true on success. |
| `ingredients` | number | Number of new ingredients created by the seed (skips names that already existed). |
| `recipes` | number | Number of new recipes created by the seed (skips titles that already existed). |

> Because the reset transaction runs before the seed, the `ingredients` and `recipes` counts on a freshly cleared database equal the full seed contents: 13 ingredients and 4 recipes.

# Deletion Order

The transaction deletes child rows before parent rows so foreign key constraints are respected:

```text
1. RecipeIngredient
2. MealPlanSlot
3. CookLog
4. CartSnapshot
5. CartItem
6. CartHistory
7. Recipe
8. Ingredient
```

After the transaction commits, the [Seed Module](/architecture/seed-data.md) is invoked with the same `PrismaClient`. The seed is idempotent — it no-ops when both `Ingredient` and `Recipe` already have rows, but on a fresh reset it inserts the full demo set.

# Errors

| Status | Condition |
|--------|-----------|
| `500` | The transaction throws (e.g. database connection failure), or the seed throws. The error is forwarded to the Express error handler. |

# Wiring

```text
POST /api/admin/reset
  └── createAdminRouter (apps/api/src/admin.ts)
        └── prisma.$transaction
              └── deleteMany on every user-managed table
        └── seed(prisma) (apps/api/src/seed.ts)
              └── inserts SEED_INGREDIENTS + SEED_RECIPES
        └── 200 { ok, reseeded, ingredients, recipes }
```

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/admin.ts` | Defines the router and the `POST /reset` handler. |
| `apps/api/src/app.ts` | Registers the router at `/api/admin`. |
| `apps/api/src/seed.ts` | Reusable idempotent seed invoked by the reset handler. |
| `apps/api/src/server.ts` | Calls `seed()` on startup when the database is empty. |
| `apps/web/src/pages/Settings.tsx` | User-facing confirmation dialog that triggers the call. |
| `apps/api/tests/admin-reset.test.ts` | Supertest coverage of the clear + reseed contract. |
| `apps/api/tests/seed.test.ts` | Unit coverage of the seed module. |
| `apps/api/prisma/schema.prisma` | Models that the reset transaction targets. See [Prisma Schema](/database/schema.md). |

# Related

- [Seed Data](/architecture/seed-data.md) — canonical ingredients and recipes inserted by the reset.
- [Settings Page](/web/settings.md) — front-end trigger for the reset.
