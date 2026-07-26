---
type: Architecture
title: Seed Data
description: Idempotent seed module that populates the database with 13 demo ingredients and 4 demo recipes, invoked on startup and after an admin reset.
tags: [architecture, seed, demo, prisma]
timestamp: 2026-07-26T19:12:38Z
---

# Purpose

`apps/api/src/seed.ts` ships a reusable `seed(prisma)` function plus the typed `SEED_INGREDIENTS` and `SEED_RECIPES` constants. It is invoked from two call sites:

1. **API startup** — `apps/api/src/server.ts` runs `seed(prisma)` when both the `Ingredient` and `Recipe` tables are empty, so a fresh database is populated before the first HTTP request is served.
2. **Admin reset** — `apps/api/src/admin.ts` clears every user-managed table and then calls `seed(prisma)` to restore the demo data.

The seed is **idempotent**. Each ingredient is upserted by its unique `name`, and each recipe is skipped if a row with the same `title` already exists. Repeated calls are safe and only report newly created rows in the `SeedResult`.

# Behavior

```text
seed(prisma)
  ├── count existing Ingredient + Recipe rows
  │     └── if both non-zero → return { ingredientsCreated: 0, recipesCreated: 0 }
  ├── for each SEED_INGREDIENT
  │     └── ingredient.upsert({ where: { name }, update: {}, create: { name, category, defaultUnit: baseUnit } })
  │           └── increment ingredientsCreated only when the row is new
  ├── resolve ingredientId → name map
  └── for each SEED_RECIPE
        └── skip if a recipe with the same title already exists
        └── recipe.create({ title, description, servings: 1 })
        └── recipeIngredient.createMany for every line that resolves to an ingredient
        └── increment recipesCreated
```

The seed never edits rows it did not create — existing data is preserved and only missing rows are inserted.

# Seed Ingredients

13 rows, sourced from `SEED_INGREDIENTS` in `apps/api/src/seed.ts`.

| Name | Category | Base Unit |
|------|----------|-----------|
| Beef | Meat | `g` |
| Chicken Breast | Meat | `g` |
| Tomato | Vegetables | `pcs` |
| Onion | Vegetables | `pcs` |
| Garlic | Vegetables | `pcs` |
| Carrot | Vegetables | `pcs` |
| Milk | Dairy | `ml` |
| Butter | Dairy | `g` |
| Rice | Grains | `g` |
| Pasta | Grains | `g` |
| Salt | Spices | `g` |
| Pepper | Spices | `g` |
| Olive Oil | Other | `ml` |

> The [Database Bootstrap](/architecture/db-bootstrap.md) script additionally applies a hand-written `seed.sql` that pre-populates seven of these ingredients (`Beef`, `Tomato`, `Milk`, `Rice`, `Salt`, `Pepper`, `Olive Oil`) via `INSERT OR IGNORE` during `prisma db execute`. The TypeScript seed skips rows that already exist, so the two layers cooperate without duplicating rows.

# Seed Recipes

4 rows, sourced from `SEED_RECIPES` in `apps/api/src/seed.ts`. Each recipe is created with `servings: 1` and links to its ingredients through `RecipeIngredient` rows that reuse the ingredient IDs resolved earlier.

| Title | Description | Ingredient Lines |
|-------|-------------|------------------|
| Hearty Beef Stew | A warming stew with beef, tomato, and root vegetables. | Beef 400 g, Onion 1 pcs, Carrot 2 pcs, Tomato 2 pcs, Salt 5 g, Pepper 2 g |
| Garlic Butter Pasta | Simple pantry pasta tossed in garlic butter with a hint of pepper. | Pasta 200 g, Butter 60 g, Garlic 3 pcs, Salt 4 g, Pepper 1 g |
| Tomato Rice Bowl | Steamed rice topped with fresh tomato and a drizzle of olive oil. | Rice 150 g, Tomato 2 pcs, Olive Oil 15 ml, Salt 3 g |
| Creamy Chicken and Vegetables | Pan-cooked chicken with vegetables in a light milk sauce. | Chicken Breast 300 g, Onion 1 pcs, Carrot 2 pcs, Milk 200 ml, Butter 20 g, Salt 4 g |

# SeedResult

| Field | Type | Description |
|-------|------|-------------|
| `ingredientsCreated` | number | Number of new `Ingredient` rows inserted by this call. |
| `recipesCreated` | number | Number of new `Recipe` rows inserted by this call. |

Both counts are `0` when the seed bails out early because the database already has ingredients and recipes.

# Wiring

```text
apps/api/src/server.ts
  └── if ingredient.count() === 0 && recipe.count() === 0
        └── seed(prisma)

POST /api/admin/reset (apps/api/src/admin.ts)
  └── prisma.$transaction(deleteMany on every table)
        └── seed(prisma)
              └── upserts SEED_INGREDIENTS
              └── creates SEED_RECIPES + RecipeIngredient rows
```

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/seed.ts` | `seed()` function, `SEED_INGREDIENTS`, `SEED_RECIPES`, and `SeedResult` type. |
| `apps/api/src/server.ts` | Startup auto-seed for empty databases. |
| `apps/api/src/admin.ts` | Calls `seed()` after the destructive reset. |
| `apps/api/tests/seed.test.ts` | Vitest coverage of idempotent inserts and early bail-out. |
| `apps/api/prisma/schema.prisma` | Underlying models. See [Prisma Schema](/database/schema.md). |

# Related

- [Database Bootstrap](/architecture/db-bootstrap.md) — file-level seed that runs alongside this module.
- [Admin API](/api/admin.md) — the reset endpoint that calls `seed()` after wiping the tables.
- [Settings Page](/web/settings.md) — user-facing entry point that triggers the reset and reseed.
