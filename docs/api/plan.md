---
type: API
title: Plan API
description: Endpoints for managing the weekly meal-plan slots, viewing per-recipe cooking stats, and marking planned slots as cooked.
tags: [api, plan, meal-plan, express, prisma]
timestamp: 2026-07-26T15:59:39Z
---

# Overview

The Express router in `apps/api/src/plan.ts` exposes weekly meal-plan operations under `/api/plan`. It is registered in `apps/api/src/app.ts` after CORS and JSON middleware. ISO weeks are validated by helpers in `apps/api/src/plan-utils.ts` (shared with `apps/web/src/lib/plan.ts`), and weekly cart aggregation lives in `apps/api/src/cart-recompute.ts`.

The web [Dashboard Page](/web/dashboard.md) consumes these endpoints through the Vite `/api` development proxy. The router is composed via `createPlanRouter(prisma)` and mounted at `/api/plan`.

# Schema

## PlanSlotRecord response

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Prisma-generated `MealPlanSlot` identifier. |
| `day` | `number` | Day of week 1–7 (1 = Monday, 7 = Sunday). |
| `date` | `string` (`YYYY-MM-DD`) | Resolved calendar date for the slot's day. |
| `slot` | `string` | One of `Breakfast`, `Lunch`, `Dinner`, `Snack` (see [PlanSlot enum](/packages/types.md)). |
| `recipeId` | `string` | FK to `Recipe.id`. |
| `recipeName` | `string` | Title of the referenced recipe (joined server-side). |
| `notes` | `string \| null` | Optional free-form notes (max 2000 chars). |
| `cookedCount` | `number` | Count of `CookLog` rows tied to this slot. |

## PlanResponse

| Field | Type | Description |
|-------|------|-------------|
| `week` | `string` | ISO week label in `YYYY-Www` format (e.g. `2026-W30`). |
| `weekStart` | `string` (`YYYY-MM-DD`) | Monday of the week (UTC). |
| `weekEnd` | `string` (`YYYY-MM-DD`) | Sunday of the week (UTC). |
| `slots` | `PlanSlotRecord[]` | Ordered by `day` ascending, then by `id` for stability. |

## StatsResponse

| Field | Type | Description |
|-------|------|-------------|
| `week` | `string` | ISO week label. |
| `items` | `StatsItem[]` | One row per recipe with at least one `MealPlanSlot` in the week. Sorted by count desc, then name asc, then id asc. |

### StatsItem

| Field | Type | Description |
|-------|------|-------------|
| `recipeId` | `string` | Recipe identifier. |
| `recipeName` | `string` | Recipe title. |
| `count` | `number` | Number of `CookLog` rows tied to slots of this recipe in the week. |
| `lastCookedAt` | `string \| null` | ISO timestamp of the most recent cook log, or `null`. |

## Error response

| Field | Type | Description |
|-------|------|-------------|
| `error` | `string` | Human-readable failure message. |
| `code` | `string?` | Stable code such as `INVALID_INPUT`, `INVALID_WEEK`, or `NOT_FOUND`. |
| `details` | `{ field, message }[]?` | Field-level validation details when present. |

# Endpoints

| Method | Path | Body | Success | Notes |
|--------|------|------|---------|-------|
| `GET` | `/api/plan` | — | `200` with `PlanResponse` | Optional `?week=YYYY-Www`; defaults to the current ISO week. |
| `GET` | `/api/plan/stats` | — | `200` with `StatsResponse` | Same `?week` semantics as `/api/plan`. |
| `POST` | `/api/plan` | `{ day, slot, recipeId, notes?, week? }` | `201` with `PlanSlotRecord` and a `Location` header pointing at `/api/plan/:id` | `day` is 1–7, `slot` is one of the four meal-slot enums. |
| `PATCH` | `/api/plan/:id` | Any non-empty subset of `{ day?, slot?, recipeId?, notes? }` | `200` with `PlanSlotRecord` | `notes` may be `null` to clear. |
| `DELETE` | `/api/plan/:id` | — | `204` empty | Triggers cart recompute when the deleted slot's week is the current week. |
| `POST` | `/api/plan/:id/cooked` | — | `200` with `PlanSlotRecord` | Creates a `CookLog` row tied to the slot. Increments `cookedCount`. |

## POST body shape

```json
{
  "week": "2026-W30",
  "day": 3,
  "slot": "Dinner",
  "recipeId": "rec-1",
  "notes": "Use the cast iron pan"
}
```

`week` is optional and defaults to the current ISO week.

## PATCH body shape

```json
{ "slot": "Lunch", "notes": null }
```

At least one field is required; empty bodies yield `400 INVALID_INPUT`.

# Validation and Errors

- `week` must match `^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$`. Invalid labels return `400 INVALID_WEEK`.
- `day` is an integer in `1..7`.
- `slot` must be one of `Breakfast`, `Lunch`, `Dinner`, `Snack` (from `@openvelo/types`).
- `recipeId` is required and must reference an existing `Recipe`. If the FK raises `P2003`, the response is `400 INVALID_INPUT` with `details[0].field === 'recipeId'`.
- `notes` is capped at 2000 chars; `null` is allowed on `PATCH`.
- Unknown `:id` returns `404 NOT_FOUND`.
- The router additionally enforces enums and the day range at the database layer:
  - `MealPlanSlot.slot IN ('Breakfast','Lunch','Dinner','Snack')` via `MealPlanSlot_slot_enum` and `MealPlanSlot_slot_enum_update` triggers.
  - `MealPlanSlot.day BETWEEN 1 AND 7` via `MealPlanSlot_day_range` and `MealPlanSlot_day_range_update` triggers.
- These triggers run on every API startup through `apps/api/scripts/ensure-db.mjs`; the API zod validation rejects bad values upstream so the triggers are defence-in-depth.

# Wiring

```text
Dashboard page (apps/web/src/pages/Dashboard.tsx)
  └── fetch /api/plan[?week=YYYY-Www]
        └── Vite dev proxy → http://localhost:3001
              └── apps/api/src/app.ts
                    └── createPlanRouter(prisma)
                          └── apps/api/src/plan.ts
                                ├── apps/api/src/plan-utils.ts (ISO week helpers)
                                └── apps/api/src/cart-recompute.ts (CartItem aggregation)
                                          └── Prisma → SQLite
```

After `POST`, `PATCH`, or `DELETE`, the router calls `recomputeIfCurrentWeek(prisma, week)` which re-runs the auto cart aggregation only when the affected week equals today's ISO week (see [Cart Recompute](/architecture/cart-recompute.md)).

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/api/src/plan.ts` | Request validation, response mapping, CRUD handlers, and `/cooked` endpoint. |
| `apps/api/src/plan-utils.ts` | ISO week parsing, week-range resolution, `HttpError` and `fieldError` helpers, the `PLAN_SLOTS` enum. |
| `apps/api/src/cart-recompute.ts` | `recomputeAutoCartForWeek()` aggregator and `fetchCurrentWeek()` helper. |
| `apps/api/src/errors.ts` | `PlanApiError` response shape used by plan + cart helpers. |
| `apps/api/src/app.ts` | Registers `/api/plan` with `createPlanRouter(prisma)`. |
| `apps/api/prisma/schema.prisma` | `MealPlanSlot`, `CookLog`, `CartItem`, and supporting relations. |
| `apps/api/prisma/constraints.sql` | Idempotent triggers for `MealPlanSlot.slot`, `MealPlanSlot.day`, and `CartItem.source` enums. |
| `apps/api/scripts/ensure-db.mjs` | Installs the constraint triggers after `db push` and seed. |
| `apps/api/tests/plan.test.ts` | Supertest coverage for plan CRUD, stats, `/cooked`, and validation. |
| `apps/web/src/lib/plan.ts` | Browser-side mirror of week helpers and typed fetchers. |

# Examples

```bash
# List current week
curl "http://localhost:3001/api/plan"

# List a specific week
curl "http://localhost:3001/api/plan?week=2026-W30"

# Stats for current week
curl "http://localhost:3001/api/plan/stats"

# Create a planned slot
curl -X POST http://localhost:3001/api/plan \
  -H 'Content-Type: application/json' \
  -d '{"day":3,"slot":"Dinner","recipeId":"rec-1","notes":"Use the cast iron pan"}'

# Move a slot to lunch
curl -X PATCH http://localhost:3001/api/plan/slot-1 \
  -H 'Content-Type: application/json' \
  -d '{"slot":"Lunch"}'

# Mark as cooked
curl -X POST http://localhost:3001/api/plan/slot-1/cooked

# Delete
curl -X DELETE http://localhost:3001/api/plan/slot-1
```