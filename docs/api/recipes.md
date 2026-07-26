---
type: API
title: Recipes API
description: CRUD endpoints for listing, creating, updating, and deleting persisted recipes, including the recipe ingredient rows.
tags: [api, recipes, express, prisma]
timestamp: 2026-07-26T15:24:43Z
---

# Overview

The Express router in `apps/api/src/recipes.ts` exposes recipe CRUD operations under `/api/recipes`. `apps/api/src/app.ts` creates a Prisma client when one is not injected and registers the router after CORS and JSON parsing middleware.

The web [Recipes Page](/web/recipes.md) calls these routes through the Vite `/api` development proxy.

# Schema

## Recipe response

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Prisma-generated recipe identifier. |
| `name` | `string` | Recipe display name (trimmed, non-empty). |
| `ingredients` | `RecipeIngredient[]` | The full list of ingredient rows (see below). |
| `timesCooked` | `number` | Count of `CookLog` rows for the recipe. |

## RecipeIngredient response

| Field | Type | Description |
|-------|------|-------------|
| `ingredientId` | `string` | Identifier of the referenced `Ingredient`. |
| `ingredientName` | `string` | Display name of the referenced `Ingredient` (joined server-side). |
| `quantity` | `number` | Numeric amount. |
| `unit` | `BaseUnit` | One of `g`, `ml`, or `pcs` (constrained at the API boundary). |

## Error response

| Field | Type | Description |
|-------|------|-------------|
| `error` | `string` | Human-readable request failure. |
| `code` | `string?` | Stable code such as `INVALID_INPUT` or `NOT_FOUND`. |
| `details` | `{ field, message }[]?` | Field-level validation details. |

# Endpoints

| Method | Path | Request body | Success | Behavior |
|--------|------|--------------|---------|----------|
| `GET` | `/api/recipes` | None | `200` with `Recipe[]` | Lists all recipes sorted by name ascending. |
| `GET` | `/api/recipes/:id` | None | `200` with `Recipe` | Returns a single recipe. |
| `POST` | `/api/recipes` | `name`, `ingredients` | `201` with `Recipe` and a `Location` header | Creates a recipe. |
| `PATCH` | `/api/recipes/:id` | Any non-empty subset of `name`, `ingredients` | `200` with `Recipe` | Updates supplied fields; `ingredients` replaces the full list. |
| `DELETE` | `/api/recipes/:id` | None | `204` with no body | Deletes the recipe and its ingredient rows. |

## POST / PATCH body shape

```json
{
  "name": "Tomato Soup",
  "ingredients": [
    { "ingredientId": "ing-tomato", "quantity": 2, "unit": "pcs" },
    { "ingredientId": "ing-salt", "quantity": 0.5, "unit": "g" }
  ]
}
```

`PATCH` accepts the same body but both fields are optional. If neither is supplied the response is `400 INVALID_INPUT`. When `ingredients` is supplied it replaces the full list in a single operation.

# Validation and Errors

- `name` is trimmed; an empty trimmed value returns `400 INVALID_INPUT` with `details[0].field === 'name'`.
- `ingredients` must be an array; every entry is validated:
  - `ingredientId` is required (non-empty string).
  - `quantity` must be a finite number greater than `0`.
  - `unit` must be one of `g`, `ml`, `pcs` (from `@openvelo/types`).
- Every entry whose `ingredientId` does not reference an existing `Ingredient` is reported in `details` as `ingredients.<index>.ingredientId`.
- `PATCH` to an unknown identifier returns `404 NOT_FOUND`.
- `DELETE` of an unknown identifier returns `404 NOT_FOUND`.
- `DELETE` wraps the delete and its dependent cleanup in a single Prisma `$transaction`:
  - Cascades: every `MealPlanSlot` and `CookLog` row referencing the recipe is removed first (these are children the application agrees should disappear with the recipe).
  - Nulls out: every `CartSnapshot.recipeId` referencing the recipe is set to `NULL` so the persisted cart history is preserved.
  - Then the application also issues an explicit `RecipeIngredient.deleteMany` for the recipe so deletion is correct even when the live database is missing the schema-level `ON DELETE CASCADE` rule on `RecipeIngredient_recipeId_fkey`.
  - Finally the `Recipe` row itself is deleted.
- If the transaction raises a Prisma `P2003` foreign-key error (a remaining FK reference the transaction above did not expect), the handler responds with `409 REFERENCED_BY_OTHER_RECORD` instead of a generic `500`.
- The database additionally enforces `unit IN ('g','ml','pcs')` via a `CHECK` constraint in the initial migration and an idempotent SQLite trigger (`RecipeIngredient_unit_enum`) installed by `apps/api/scripts/ensure-db.mjs` on every bootstrap. Direct database writers that bypass the API and supply an unsupported unit are rejected by the trigger with an `ABORT`. The API router's zod validation still rejects bad units upstream with `400 INVALID_INPUT`; the trigger is defence-in-depth.

# Wiring

```text
Recipes page
  └── fetch /api/recipes
        └── Vite development proxy → http://localhost:3001
              └── apps/api/src/app.ts
                    └── createRecipesRouter(prisma)
                          └── Prisma Recipe + RecipeIngredient models
                                └── SQLite database
```

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/recipes.ts` | Request validation, response mapping, CRUD handlers, and API errors. |
| `apps/api/prisma/constraints.sql` | Idempotent SQLite trigger that enforces the `unit` enum at the database layer. |
| `apps/api/scripts/ensure-db.mjs` | Applies the constraint trigger after the seed during bootstrap. |
| `apps/api/src/app.ts` | Registers the router at `/api/recipes` and supplies Prisma. |
| `apps/api/prisma/schema.prisma` | Defines the `Recipe` and `RecipeIngredient` models and the cascade-delete relation. |
| `apps/api/prisma/migrations/20260726124114_ingredient_name_unique/migration.sql` | Creates the schema and the database-level recipe ingredient unit check constraint. |
| `apps/api/tests/recipes.test.ts` | Supertest coverage for CRUD, validation, 404s, and cascade delete. |
| `apps/web/src/pages/Recipes.tsx` | API consumer and user-facing recipe management flow. |
| `apps/web/src/components/IngredientPicker.tsx` | Searchable ingredient picker used inside the editor rows. |

# Examples

```bash
curl http://localhost:3001/api/recipes
```

```bash
curl -X POST http://localhost:3001/api/recipes \
  -H 'Content-Type: application/json' \
  -d '{"name":"Tomato Soup","ingredients":[{"ingredientId":"ing-tomato","quantity":2,"unit":"pcs"}]}'
```

```bash
curl -X PATCH http://localhost:3001/api/recipes/rec-1 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Tomato Bisque"}'
```

```bash
curl -X DELETE http://localhost:3001/api/recipes/rec-1
```
