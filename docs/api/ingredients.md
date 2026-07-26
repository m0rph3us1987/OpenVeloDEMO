---
type: API
title: Ingredients API
description: CRUD endpoints for listing, creating, updating, and deleting persisted ingredients.
tags: [api, ingredients, express, prisma]
timestamp: 2026-07-26T19:32:25Z
---

# Overview

The Express router in `apps/api/src/ingredients.ts` exposes ingredient CRUD operations under `/api/ingredients`. `apps/api/src/app.ts` creates a Prisma client when one is not injected and registers the router after CORS and JSON parsing middleware.

The web [Ingredients Page](/web/ingredients.md) calls these routes through the Vite `/api` development proxy.

# Schema

## Ingredient response

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Prisma-generated ingredient identifier. |
| `name` | `string` | Unique, trimmed display name. |
| `category` | `IngredientCategory` | One of the shared [ingredient categories](/packages/types.md). |
| `baseUnit` | `BaseUnit` | One of `g`, `ml`, or `pcs`. Maps to `Ingredient.defaultUnit` in the database. |

## Error response

| Field | Type | Description |
|-------|------|-------------|
| `error` | `string` | Human-readable request failure. |
| `code` | `string?` | Stable code such as `INVALID_INPUT`, `NAME_CONFLICT`, or `NOT_FOUND`. |
| `details` | `{ field, message }[]?` | Field-level validation or conflict details. |

# Endpoints

| Method | Path | Request body | Success | Behavior |
|--------|------|--------------|---------|----------|
| `GET` | `/api/ingredients` | None | `200` with `Ingredient[]` | Lists all ingredients sorted by name ascending. |
| `POST` | `/api/ingredients` | `name`, `category`, `baseUnit` | `201` with `Ingredient` and a `Location` header | Creates an ingredient. All fields are required. |
| `PATCH` | `/api/ingredients/:id` | Any non-empty subset of `name`, `category`, `baseUnit` | `200` with updated `Ingredient` | Updates only supplied fields. |
| `DELETE` | `/api/ingredients/:id` | None | `204` with no body | Deletes the ingredient along with any `RecipeIngredient`, `CookLog` (with this `ingredientId`), and `CartItem` rows that reference it. Recipes and remaining rows are not affected. |

# Validation and Errors

- Names are trimmed and cannot be empty.
- Categories and base units must match values from `@openvelo/types`.
- An empty `PATCH` body returns `400 INVALID_INPUT`.
- A duplicate name on create or rename returns `409 NAME_CONFLICT`.
- Updating or deleting an unknown identifier returns `404 NOT_FOUND`.
- If a foreign key outside `RecipeIngredient`, `CookLog`, and `CartItem` prevents deletion, the API responds with `409 REFERENCED_BY_OTHER_RECORD`.
- Unexpected Prisma or server failures pass to Express error handling.

# Wiring

```text
Ingredients page
  └── fetch /api/ingredients
        └── Vite development proxy → http://localhost:3001
              └── apps/api/src/app.ts
                    └── createIngredientsRouter(prisma)
                          └── Prisma Ingredient model
                                └── SQLite database
```

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/ingredients.ts` | Request validation, response mapping, CRUD handlers, and API errors. |
| `apps/api/src/app.ts` | Registers the router at `/api/ingredients` and supplies Prisma. |
| `apps/api/prisma/schema.prisma` | Defines the unique ingredient name and persisted fields. |
| `apps/api/tests/ingredients.test.ts` | Supertest coverage for CRUD, sorting, validation, conflicts, and missing records. |
| `apps/web/src/pages/Ingredients.tsx` | API consumer and user-facing ingredient management flow. |

# Examples

```bash
curl http://localhost:3001/api/ingredients
```

```bash
curl -X POST http://localhost:3001/api/ingredients \
  -H 'Content-Type: application/json' \
  -d '{"name":"Salt","category":"Spices","baseUnit":"g"}'
```
