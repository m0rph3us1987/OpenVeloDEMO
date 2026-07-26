---
type: Architecture
title: Cart Recompute
description: Base-unit plan aggregation and persisted auto CartItem recomputation used by the Plan and Shopping Cart APIs.
tags: [architecture, cart, plan, recompute]
timestamp: 2026-07-26T17:28:38Z
---

# Overview

`apps/api/src/cart-recompute.ts` exports shared helpers that bridge the [Plan API](/api/plan.md), [Shopping Cart API](/api/cart.md), and [Database Schema](/database/schema.md):

- `unitToBase(unit)` — normalizes `kg` to `g`, `l` to `ml`, and accepts `g`, `ml`, and `pcs` directly.
- `sumMealPlanSlots(slots, ingredientBaseUnit?)` — calculates plan totals in memory for persisted recomputation and live cart reads.
- `recomputeAutoCartForWeek(prisma, week, tx?)` — rebuilds every `CartItem` row with `source = 'auto'` for the given ISO week.
- `fetchCurrentWeek(prisma)` — returns the current local ISO week label (`YYYY-Www`).

The Plan router calls `recomputeIfCurrentWeek()` after `POST`, `PATCH`, and `DELETE`. The function delegates to `recomputeAutoCartForWeek()` only when the affected week equals `fetchCurrentWeek()`.

# Algorithm

1. Read every `MealPlanSlot` for the given `week` with the related `Recipe` and its `RecipeIngredient` rows, plus ingredient base units.
2. Normalize ingredient quantities into `g`, `ml`, or `pcs`; incompatible unit dimensions are skipped.
3. For each slot, scale every valid ingredient row by `slot.servings` (default `1`).
4. Sum `(ingredientId, base unit)` tuples into a `Map`.
5. Delete every existing `CartItem` row with `week = <week>` and `source = 'auto'`. `source = 'manual'` rows are preserved (multiple manual rows for the same `(ingredientId, base unit)` are kept side-by-side).
6. Bulk-insert the aggregated rows with `source = 'auto'`.

The function accepts an optional Prisma `TransactionClient`. When supplied, all reads/writes execute inside the outer `$transaction`; when omitted, the function executes directly against `prisma`.

# Wiring

```text
Plan router (apps/api/src/plan.ts)
  ├── POST   /api/plan            → recomputeIfCurrentWeek → recomputeAutoCartForWeek
  ├── PATCH  /api/plan/:id        → recomputeIfCurrentWeek → recomputeAutoCartForWeek
  └── DELETE /api/plan/:id        → recomputeIfCurrentWeek → recomputeAutoCartForWeek

recomputeAutoCartForWeek
  └── sumMealPlanSlots → CartItem (week, ingredientId, base unit, source, quantity)

GET /api/cart or historical snapshot creation
  └── aggregateCartForWeek → sumMealPlanSlots + manual CartItem rows → grouped response

CartItem source IN ('auto', 'manual') ← enforced by CartItem_source_enum[_update] triggers

GET /api/cart POST /api/cart/lines → one CartItem row per POST (distinct manual lines)
```

# Invariants

- `quantity = normalized recipeIngredient.quantity * slot.servings` summed across all slots sharing `(ingredientId, base unit)`.
- Supported inputs normalize as `kg → g` and `l → ml`; `g`, `ml`, and `pcs` remain unchanged.
- `source = 'auto'` rows are recomputed wholesale; `source = 'manual'` rows are user-added and are never touched by this function.
- The non-unique index `CartItem_week_ingredientId_idx` keeps manual-row reads cheap. Multiple `source = 'manual'` rows for the same `(week, ingredientId, base unit)` are allowed and are rendered as distinct response items by the cart snapshot pipeline.

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/cart-recompute.ts` | Unit normalization, pure plan-slot summation, `recomputeAutoCartForWeek()`, and `fetchCurrentWeek()`. |
| `apps/api/src/cart-snapshot.ts` | Reuses `sumMealPlanSlots()` for live and historical [Shopping Cart API](/api/cart.md) responses. |
| `apps/api/src/plan.ts` | Calls `recomputeIfCurrentWeek()` after every mutation. |
| `apps/api/prisma/schema.prisma` | `CartItem` model definition. |
| `apps/api/prisma/constraints.sql` | Idempotent triggers enforcing `CartItem.source IN ('auto','manual')`. |
| `apps/api/scripts/ensure-db.mjs` | Installs the constraint triggers during bootstrap. |