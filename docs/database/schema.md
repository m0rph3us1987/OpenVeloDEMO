---
type: Database
title: Prisma Schema
description: Core data model for OpenVelo — ingredients, recipes, meal plans, cook logs, and shopping cart snapshots.
tags: [database, prisma, schema]
timestamp: 2026-07-26T13:54:15Z
---

# Overview

Source of truth: `apps/api/prisma/schema.prisma`. The data layer is SQLite via Prisma with `DATABASE_URL` from the environment. The database file is created and seeded automatically by the bootstrap script — see [Database Bootstrap](/architecture/db-bootstrap.md). The schema is applied via `prisma db push` on first run; an idempotent `INSERT OR IGNORE` seed in `apps/api/prisma/seed.sql` populates seven demo ingredients (`Beef`, `Tomato`, `Milk`, `Rice`, `Salt`, `Pepper`, `Olive Oil`).

# Models

## Ingredient

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `name` | `String` | Unique display name; enforced by the `Ingredient_name_key` database index. |
| `category` | `String` | One of [IngredientCategory](/packages/types.md) values. |
| `defaultUnit` | `String` | One of [BaseUnit](/packages/types.md) values. |
| `createdAt` | `DateTime` | Auto-set on create. |
| `updatedAt` | `DateTime` | Auto-updated on write. |
| `recipeIngredients` | relation | See [RecipeIngredient](#recipeingredient). |
| `cookLogs` | relation | Optional join to [CookLog](#cooklog). |

## Recipe

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `title` | `String` | Recipe name. |
| `description` | `String?` | Optional summary. |
| `servings` | `Int` | Defaults to `1`. |
| `createdAt` / `updatedAt` | `DateTime` | Timestamps. |
| `ingredients` | relation | Join through [RecipeIngredient](#recipeingredient). |
| `mealSlots` | relation | [MealPlanSlot](#mealplanslot) entries per date. |
| `cookLogs` | relation | History of when this recipe was cooked. |
| `cartSnapshots` | relation | [CartSnapshot](#cartsnapshot) history. |

## RecipeIngredient

Join table linking [Recipe](#recipe) to [Ingredient](#ingredient).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `recipeId` | `String` | FK → `Recipe.id` (indexed). |
| `ingredientId` | `String` | FK → `Ingredient.id` (indexed). |
| `quantity` | `Float` | Numeric amount. |
| `unit` | `String` | Display unit (free-form, e.g. `g`, `cup`). |

## MealPlanSlot

A scheduled recipe for a specific date and meal slot.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `date` | `DateTime` | Calendar date. |
| `slot` | `String` | Free-form label (e.g. `breakfast`, `dinner`). |
| `recipeId` | `String` | FK → `Recipe.id` (indexed). |
| `servings` | `Int` | Defaults to `1`. |

## CookLog

Historical record of a recipe being cooked, optionally tied to an ingredient variant.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `recipeId` | `String` | FK → `Recipe.id` (indexed). |
| `ingredientId` | `String?` | Optional FK → `Ingredient.id`. |
| `cookedAt` | `DateTime` | Defaults to `now()`. |
| `notes` | `String?` | Optional free-form notes. |

## CartSnapshot

Persisted shopping cart state for a recipe.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `recipeId` | `String?` | Optional FK → `Recipe.id` (indexed). |
| `takenAt` | `DateTime` | Defaults to `now()`. |
| `itemsJson` | `String` | Serialized JSON snapshot of the cart items. |

# Relationships

```
Ingredient ──< RecipeIngredient >── Recipe
   │                                  │
   │                                  ├──< MealPlanSlot
   └──< CookLog                       ├──< CookLog
                                      └──< CartSnapshot
```

# Migrations

The migration at `apps/api/prisma/migrations/20260726124114_ingredient_name_unique/migration.sql` creates the current SQLite tables, relationship indexes, and the unique `Ingredient.name` index used by the [Ingredients API](/api/ingredients.md) to return `409 NAME_CONFLICT` for duplicates.

In addition to the migration history, the API server runs `prisma db push` on first startup (via the [Database Bootstrap](/architecture/db-bootstrap.md) script) so a fresh environment does not need a manual `prisma migrate` step before the API can start.

| Script | Purpose |
|--------|---------|
| `npm run prisma:generate -w @openvelo/api` | Regenerate the Prisma client. |
| `npm run prisma:migrate -w @openvelo/api` | Create and apply a migration named `init` (or next pending name). |
| `node scripts/ensure-db.mjs` (from `apps/api`) | Idempotent DB bootstrap — used by `setup.sh` and the API server. |

# Citations

[1] [apps/api/prisma/schema.prisma](https://github.com/openvelo/...) — canonical schema source.
