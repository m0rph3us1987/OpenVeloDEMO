---
type: Architecture
title: Cart Recompute
description: Auto-derived CartItem aggregation that runs after every Plan API mutation when the affected week equals the current ISO week.
tags: [architecture, cart, plan, recompute]
timestamp: 2026-07-26T15:59:39Z
---

# Overview

`apps/api/src/cart-recompute.ts` exports two functions that bridge the [Plan API](/api/plan.md) and the [Database Schema](/database/schema.md):

- `recomputeAutoCartForWeek(prisma, week, tx?)` — rebuilds every `CartItem` row with `source = 'auto'` for the given ISO week.
- `fetchCurrentWeek(prisma)` — returns the current ISO week label (`YYYY-Www`) computed in UTC.

The Plan router calls `recomputeIfCurrentWeek()` after `POST`, `PATCH`, and `DELETE`. The function delegates to `recomputeAutoCartForWeek()` only when the affected week equals `fetchCurrentWeek()`.

# Algorithm

1. Read every `MealPlanSlot` for the given `week` with the related `Recipe` and its `RecipeIngredient` rows.
2. For each slot, scale every ingredient row by `slot.servings` (default `1`).
3. Sum `(ingredientId, unit)` tuples into a `Map`.
4. Delete every existing `CartItem` row with `week = <week>` and `source = 'auto'`. `source = 'manual'` rows are preserved.
5. Bulk-insert the aggregated rows with `source = 'auto'`.

The function accepts an optional Prisma `TransactionClient`. When supplied, all reads/writes execute inside the outer `$transaction`; when omitted, the function executes directly against `prisma`.

# Wiring

```text
Plan router (apps/api/src/plan.ts)
  ├── POST   /api/plan            → recomputeIfCurrentWeek → recomputeAutoCartForWeek
  ├── PATCH  /api/plan/:id        → recomputeIfCurrentWeek → recomputeAutoCartForWeek
  └── DELETE /api/plan/:id        → recomputeIfCurrentWeek → recomputeAutoCartForWeek

recomputeAutoCartForWeek
  └── CartItem (week, ingredientId, unit, source, quantity)
        source IN ('auto', 'manual')   ← enforced by CartItem_source_enum[_update] triggers
```

# Invariants

- `quantity = recipeIngredient.quantity * slot.servings` summed across all slots sharing `(ingredientId, unit)`.
- `source = 'auto'` rows are recomputed wholesale; `source = 'manual'` rows are user-added and are never touched by this function.
- The unique index `CartItem_week_ingredientId_unit_source_key` keeps duplicate `(week, ingredientId, unit, source)` rows from coexisting.

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/cart-recompute.ts` | `recomputeAutoCartForWeek()` and `fetchCurrentWeek()` helpers. |
| `apps/api/src/plan.ts` | Calls `recomputeIfCurrentWeek()` after every mutation. |
| `apps/api/prisma/schema.prisma` | `CartItem` model definition. |
| `apps/api/prisma/constraints.sql` | Idempotent triggers enforcing `CartItem.source IN ('auto','manual')`. |
| `apps/api/scripts/ensure-db.mjs` | Installs the constraint triggers during bootstrap. |