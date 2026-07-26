---
type: API
title: Shopping Cart API
description: Current and historical weekly cart reads plus current-week manual line management.
tags: [api, cart, shopping, history]
timestamp: 2026-07-26T17:28:38Z
---

# Overview

The router in `apps/api/src/cart.ts` is mounted at `/api/cart` by `apps/api/src/app.ts`. It combines plan-derived ingredient totals with manual `CartItem` rows, groups results by ingredient category, and exposes immutable snapshots for past weeks.

Current-week totals are calculated from [meal-plan slots](/api/plan.md) and manual rows. Plan quantities and manual quantities remain separate in each response item and are added into `totalQuantity`.

# Endpoints

| Method | Route | Purpose | Success |
|--------|-------|---------|---------|
| `GET` | `/api/cart` | Return the current ISO week's live cart. | `200` cart response. |
| `GET` | `/api/cart/weeks` | List past weeks that have plan, manual-cart, or frozen history data. | `200` summary array, newest first. |
| `GET` | `/api/cart/weeks/:weekKey` | Return a current or past weekly cart. A past week is frozen on first read. | `200` cart response. |
| `POST` | `/api/cart/lines` | Add a manual line to the current week or increment an existing matching manual line. | `201` line record and `Location` header. |
| `PATCH` | `/api/cart/lines/:id` | Change a current-week manual line's quantity, unit, or note. | `200` line record. |
| `DELETE` | `/api/cart/lines/:id` | Remove a current-week manual line. | `204`. |

# Schema

## Cart response

| Field | Type | Description |
|-------|------|-------------|
| `weekKey` | string | ISO week label `YYYY-Www`. |
| `weekLabel` | string | Display label such as `Week 31, 2026 · Jul 27 – Aug 02`. |
| `dateRange` | object | Inclusive `start` and `end` dates in `YYYY-MM-DD` format. |
| `groups` | array | Non-empty category groups in shared ingredient-category order. |

Each group contains `category` and `items`. Each item contains `ingredientId`, `name`, `category`, `autoQuantity`, `manualQuantity`, `totalQuantity`, base `unit`, `source`, and `manualLineId`. `source` can contain `plan`, `manual`, or both. `manualLineId` is present only when the merged item has an editable manual contribution.

## Create manual line

```json
{
  "ingredientId": "ingredient-id",
  "quantity": 1.5,
  "unit": "kg",
  "note": "optional"
}
```

`quantity` must be finite and greater than zero. Supported display units are `g`, `kg`, `ml`, `l`, and `pcs`; `kg` is stored as `g`, and `l` as `ml`. Repeated creates for the same current-week `(ingredientId, base unit, manual)` tuple increment its quantity rather than creating another row. The original note is retained on increment and can be changed with `PATCH`.

## Patch manual line

At least one of `quantity`, `unit`, or `note` is required. When quantity and unit are supplied together, the API normalizes the display amount to its base unit. A quantity without a unit is interpreted as an amount in the row's existing base unit.

# Historical Weeks

Past weeks are read-only. On the first request for a past week, `apps/api/src/cart-snapshot.ts` aggregates that week's plan and manual data and upserts one `CartHistory` row. Later reads return the serialized snapshot, so subsequent plan or cart changes do not rewrite historical output.

`GET /api/cart/weeks` discovers past weeks across `CartHistory`, `CartItem`, and `MealPlanSlot`. It materializes missing past snapshots before returning each week's label, date range, and item count. Future weeks are excluded.

# Errors

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_INPUT` | Invalid week label, empty patch, unsupported unit, invalid quantity, or malformed payload. |
| `404` | `NOT_FOUND` | Ingredient or cart line does not exist, or a future weekly cart is requested. |
| `409` | `NOT_CURRENT_WEEK` | A mutation targets a past-week line. |
| `409` | `NOT_MANUAL_LINE` | A mutation targets a plan-derived auto line. |
| `409` | `INVALID_UNIT` | A stored line has a unit that cannot be normalized. |

# Wiring

```text
ShoppingCart (apps/web/src/pages/ShoppingCart.tsx)
  └── apps/web/src/lib/cart.ts
        └── HTTP /api/cart
              └── createCartRouter (apps/api/src/cart.ts)
                    ├── cart-snapshot.ts ──► MealPlanSlot + CartItem + CartHistory
                    ├── cart-recompute.ts ──► plan ingredient aggregation and unit normalization
                    └── Prisma ──► SQLite
```

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/app.ts` | Registers the router at `/api/cart`. |
| `apps/api/src/cart.ts` | Route validation, manual-line mutations, and API errors. |
| `apps/api/src/cart-snapshot.ts` | Live aggregation, category grouping, labels, week listing, and frozen history. |
| `apps/api/src/cart-recompute.ts` | Shared base-unit normalization and plan-slot summation. |
| `apps/api/prisma/schema.prisma` | `CartItem` and `CartHistory` persistence. See [Prisma Schema](/database/schema.md). |
| `apps/web/src/lib/cart.ts` | Typed HTTP client and display quantity formatting. |
| `apps/web/src/pages/ShoppingCart.tsx` | User-facing cart route. See [Shopping Cart Page](/web/shopping-cart.md). |
