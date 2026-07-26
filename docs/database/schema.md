---
type: Database
title: Prisma Schema
description: Core data model for OpenVelo — ingredients, recipes, meal plans, cook logs, live cart items, and frozen cart history.
tags: [database, prisma, schema]
timestamp: 2026-07-26T19:32:25Z
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

Join table linking [Recipe](#recipe) to [Ingredient](#ingredient). Recipe ingredient units are constrained to `g`, `ml`, or `pcs` by API validation and by the database `CHECK`/bootstrap trigger.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `recipeId` | `String` | FK → `Recipe.id` (indexed); cascade-deleted with its recipe. |
| `ingredientId` | `String` | FK → `Ingredient.id` (indexed). |
| `quantity` | `Float` | Positive numeric amount when written through the recipes API. |
| `unit` | `String` | One of `g`, `ml`, or `pcs`; enforced at the API and database layers. |

## MealPlanSlot

A scheduled recipe for a specific ISO week, day, meal slot, and recipe. Consumed by the [Plan API](/api/plan.md) and the [Dashboard Page](/web/dashboard.md).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `week` | `String` | ISO week label `YYYY-Www` (e.g. `2026-W30`); indexed with `day`. |
| `day` | `Int` | Day of the week 1–7 (1 = Monday, 7 = Sunday); indexed with `week`. |
| `date` | `DateTime` | Resolved calendar date derived from `weekStart + (day - 1)`. |
| `slot` | `String` | One of `Breakfast`, `Lunch`, `Dinner`, `Snack`. Enforced at the API and database layers (see [Plan API](/api/plan.md)). |
| `recipeId` | `String` | FK → `Recipe.id` (indexed). |
| `servings` | `Int` | Defaults to `1`. Used as the scaling factor when auto-deriving the weekly cart. |
| `notes` | `String?` | Optional free-form notes (max 2000 chars at the API). |
| `createdAt` | `DateTime` | Auto-set on create. |
| `cookLogs` | relation | [CookLog](#cooklog) rows that originated from this slot (see below). |

## CookLog

Historical record of a recipe being cooked, optionally tied to an ingredient variant and a planned slot.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `recipeId` | `String` | FK → `Recipe.id` (indexed). |
| `ingredientId` | `String?` | Optional FK → `Ingredient.id`. |
| `mealPlanSlotId` | `String?` | Optional FK → `MealPlanSlot.id` (indexed). Set to `NULL` (`onDelete: SetNull`) when the originating slot is deleted. Historical cook logs created without a slot have `null`. |
| `cookedAt` | `DateTime` | Defaults to `now()` (indexed). |
| `notes` | `String?` | Optional free-form notes. |

## CartSnapshot

Persisted shopping cart state for a recipe.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `recipeId` | `String?` | Optional FK → `Recipe.id` (indexed). |
| `takenAt` | `DateTime` | Defaults to `now()`. |
| `itemsJson` | `String` | Serialized JSON snapshot of the cart items. |

## CartItem

The weekly shopping list persisted for a given ISO week. `auto` rows are maintained by the [Cart Recompute](/architecture/cart-recompute.md) pipeline after Plan mutations; `manual` rows are managed by the [Shopping Cart API](/api/cart.md).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `week` | `String` | ISO week label `YYYY-Www` (indexed). |
| `ingredientId` | `String` | FK → `Ingredient.id`. |
| `unit` | `String` | One of `g`, `ml`, or `pcs`. |
| `quantity` | `Float` | Base-unit amount. Auto rows contain summed `RecipeIngredient.quantity * slot.servings`; manual rows contain the user-entered contribution after normalization. |
| `source` | `String` | One of `auto` (derived from the plan) or `manual` (user-added). Enforced at the API and database layers. |
| `note` | `String?` | Optional free-form note for manual lines. |
| `updatedAt` | `DateTime` | Auto-updated on write. |
| `ingredient` | relation | FK → `Ingredient.id`. |

Unique index: `(week, ingredientId, unit, source)` — no two rows may share the same `(week, ingredient, unit, source)` tuple.

## CartHistory

An immutable-by-convention weekly shopping-cart snapshot used by the [Shopping Cart API](/api/cart.md). Past weeks are materialized lazily on their first read or while listing available historical weeks; later reads return `itemsJson` rather than recomputing from mutable plan and manual rows.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String` (cuid) | Primary key. |
| `week` | `String` | Unique ISO week label `YYYY-Www`; one snapshot per past week. |
| `weekStart` | `String` | Inclusive Monday date in `YYYY-MM-DD` format. |
| `weekEnd` | `String` | Inclusive Sunday date in `YYYY-MM-DD` format. |
| `weekLabel` | `String` | Persisted user-facing week and date-range label. |
| `itemsJson` | `String` | Serialized array of grouped cart items, including auto/manual quantities and sources. |
| `takenAt` | `DateTime` | Snapshot creation time, defaulting to `now()`. |

# Relationships

```
Ingredient ──< RecipeIngredient >── Recipe
    │                                  │
    │                                  ├──< MealPlanSlot ──< CookLog
    ├──< CookLog                       ├──< CookLog
    └──< CartItem                      └──< CartSnapshot

CartHistory (one frozen snapshot per ISO week; grouped cart data in itemsJson)
```

# Recipe Delete Cascade (API layer)

`DELETE /api/recipes/:id` in `apps/api/src/recipes.ts` runs a single Prisma `$transaction` to keep the database consistent. The table below summarizes which dependents are removed, nulled, or left intact for each relation:

| Dependent relation | On recipe delete | Reason |
|--------------------|------------------|--------|
| `RecipeIngredient` | Removed (`deleteMany` issued explicitly by the API). | The schema declares `onDelete: Cascade`, but the API also issues the deletion inside the transaction so a stale database without that FK rule still removes the rows correctly. |
| `MealPlanSlot` | Removed (`deleteMany`). | A meal-plan entry for a recipe that no longer exists is meaningless. |
| `CookLog` | Removed (`deleteMany`). | Cook history is meaningless once the recipe itself is gone. |
| `CartSnapshot` | `recipeId` set to `NULL` (`updateMany`). | Shopping-cart history is preserved as an anonymous snapshot; only the FK link is severed. |

If a foreign-key constraint still fires (Prisma error code `P2003`) after the steps above, the API responds with `409 REFERENCED_BY_OTHER_RECORD` — see [Recipes API](/api/recipes.md).

# Ingredient Delete Cascade (API layer)

`DELETE /api/ingredients/:id` in `apps/api/src/ingredients.ts` runs a single Prisma `$transaction` to keep the database consistent. The table below summarizes which dependents are removed and which are left intact for each relation:

| Dependent relation | On ingredient delete | Reason |
|--------------------|----------------------|--------|
| `RecipeIngredient` | Removed (`deleteMany` issued explicitly by the API). | Recipe rows referencing a now-missing ingredient are meaningless, and `Recipe.ingredients` must remain consistent. Recipes themselves are not deleted — only the join rows that pointed at this ingredient. |
| `CookLog` | Removed (`deleteMany` for rows with `ingredientId` equal to the deleted ingredient). | Cook history tied to an ingredient variant that no longer exists is meaningless. Cook log rows with `ingredientId = NULL` are untouched. |
| `CartItem` | Removed (`deleteMany` for the current and historical weeks). | Cart lines for an ingredient that no longer exists cannot be displayed or aggregated. |

If a foreign-key constraint still fires (Prisma error code `P2003`) after the steps above, the API responds with `409 REFERENCED_BY_OTHER_RECORD` — see [Ingredients API](/api/ingredients.md).

# Migrations

The migration at `apps/api/prisma/migrations/20260726124114_ingredient_name_unique/migration.sql` creates the current SQLite tables, relationship indexes, the unique `Ingredient.name` index used by the [Ingredients API](/api/ingredients.md), and the `RecipeIngredient.unit` check constraint. `apps/api/prisma/constraints.sql` and `apps/api/scripts/ensure-db.mjs` install the idempotent unit-enforcement trigger during database bootstrap.

In addition to the migration history, the API server runs `prisma db push` on first startup (via the [Database Bootstrap](/architecture/db-bootstrap.md) script) so a fresh environment does not need a manual `prisma migrate` step before the API can start.

| Script | Purpose |
|--------|---------|
| `npm run prisma:generate -w @openvelo/api` | Regenerate the Prisma client. |
| `npm run prisma:migrate -w @openvelo/api` | Create and apply a migration named `init` (or next pending name). |
| `node scripts/ensure-db.mjs` (from `apps/api`) | Idempotent DB bootstrap — used by `setup.sh` and the API server. |

# Citations

[1] [apps/api/prisma/schema.prisma](https://github.com/openvelo/...) — canonical schema source.
