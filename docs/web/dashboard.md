---
type: Web
title: Dashboard Page
description: Weekly meal-planner UI rendered at `/`, including the seven-day grid, add/edit/delete dialogs, cook tracking, and per-recipe cooking summary.
tags: [web, dashboard, plan, react, tanstack-query]
timestamp: 2026-07-26T16:48:00Z
---

# Overview

`apps/web/src/pages/Dashboard.tsx` renders the Dashboard at `/` (registered in `apps/web/src/App.tsx` as the index route). It composes `WeeklyPlan`, `PlanSlotDialog`, and `ConfirmDeleteDialog` and manages all state with React Query and local `useState` for dialogs/banner.

The page talks to the [Plan API](/api/plan.md) and the [Recipes API](/api/recipes.md) through the helpers exported by `apps/web/src/lib/plan.ts`.

# User Flows

## Navigate to the Dashboard

1. Open `http://localhost:5173/`.
2. The dashboard renders at the index route. You can also click `Dashboard` in the persistent sidebar.

## Browse the week

1. The header reads `Dashboard` with the subtitle `Plan your meals for the week and track what you have cooked.`
2. Below the header, a control row exposes `←`, `→`, and `Today` buttons plus a label `Week of <YYYY-MM-DD> – <YYYY-MM-DD>`.
3. The `Weekly plan` grid shows seven columns (Monday → Sunday). Each column header has the day name, numeric date, and month abbreviation (e.g. `Mon 27`, `Jul`).
4. The column that matches today's date when viewing the current week is highlighted with `border-accent ring-2 ring-ring`.
5. Each planned meal appears as a card with the meal-slot label (`Breakfast`, `Lunch`, `Dinner`, `Snack`), the recipe name, optional notes, an `I cooked this` button, and an `X` delete button.
6. Below the grid, a `Planned slots` table mirrors the planned slots for the week (Day, Slot, Recipe, Notes). The recipe name is rendered as an underlined button that opens the edit dialog.
7. At the bottom, a `Total times cooked per recipe` table lists every recipe with `Recipe`, `Times cooked`, and `Last cooked` columns. Recipes that have never been cooked appear with `Times cooked = 0` and an empty `Last cooked` value. The data is sourced from the global `GET /api/stats` endpoint.

## Add a planned meal

1. Click `+ Add` in the column for the desired day.
2. A modal titled `Add planned meal (<Day>)` appears with:
   - **Slot** — `<select>` listing `Breakfast`, `Lunch`, `Dinner`, `Snack`. Required.
   - **Recipe** — `<select>` listing every recipe (sorted alphabetically). Required. The list refreshes via `refreshRecipes()` when the dialog opens.
   - **Notes (optional)** — `<textarea>` with up to 2000 chars.
   - **Cancel** / **Add** buttons in the footer. Submit is disabled while pending; label flips to `Saving...`.
3. On success the dialog closes, the new slot appears in the column and in the `Planned slots` table, and the cook-log summary refreshes.
4. On failure the inline error message (`role="alert"`) renders inside the dialog and a banner with the same message appears at the top of the page.

## Edit a planned meal

1. Click the underlined recipe name in the `Planned slots` table (or anywhere a planned slot opens an editor).
2. The same modal opens pre-filled and titled `Edit planned meal`.
3. Submitting sends a `PATCH /api/plan/:id` and closes the dialog on success.

## Delete a planned meal

1. Click the red `X` button on a planned slot card (or another delete trigger).
2. A confirmation dialog titled `Are you sure?` with message `Are you sure? Remove this planned meal?` appears.
3. Confirm to call `DELETE /api/plan/:id`; cancel to close.
4. On failure an error message appears inside the dialog and the planned slot remains.

## Mark a slot as cooked

1. Click `I cooked this` on a planned meal card.
2. The button label flips to `Logging…` while the request is in flight, then returns to `I cooked this` once the response arrives.
3. The call `POST /api/plan/:id/cooked` creates a fresh `CookLog` row tied to the slot. Each click records another cook — the action is intentionally repeatable, so the same slot may be marked cooked any number of times.
4. On success, the dashboard refetches the plan, stats, and recipe overview so the slot counter, the `Total times cooked per recipe` row, and the recipe overview `timesCooked` field all update together. The `Last cooked` date advances to the new cook timestamp.
5. On failure, the cached values stay untouched, the button re-enables, and the parsed API/network error message renders in the existing `role="status"` banner for the user to dismiss.

## Navigate between weeks

1. Click `←` to view the previous ISO week, `→` for the next.
2. Click `Today` to jump back to the current ISO week (today is calculated in the browser using `currentWeekLabel()`).
3. The displayed `Week of … – …` label updates accordingly.

# Visual Elements

| Element | Selector | Purpose |
|---------|----------|---------|
| Banner | top of page, `role="status"` | API/network error message with a `Dismiss` button. |
| Week controls | `←`, `→`, `Today` | Navigate ISO weeks. |
| `Weekly plan` grid | 7 columns (1 per day) | Today column highlighted with `border-accent ring-2 ring-ring`. |
| `+ Add` button | per column | Opens `PlanSlotDialog` in add mode. |
| `I cooked this` button | per slot | Becomes `Logging…` while the request is in flight; safe to click again afterwards to log another cook. |
| `X` button | per slot | Opens `ConfirmDeleteDialog`. |
| `Planned slots` table | below the grid | Day / Slot / Recipe / Notes. Recipe is an edit trigger. |
| `Total times cooked per recipe` table | bottom of the page | Recipe / Times cooked / Last cooked. Sourced from the global `GET /api/stats` and lists every recipe, including never-cooked rows with `0` and an em-dash placeholder for the date. |
| `PlanSlotDialog` | `role="dialog"`, `aria-modal="true"` | Add or edit dialog. |
| `ConfirmDeleteDialog` | `role="alertdialog"`, `aria-modal="true"` | Delete confirmation. |

# Wiring

```text
apps/web/src/App.tsx (createBrowserRouter)
  └── index route → Dashboard
        └── apps/web/src/pages/Dashboard.tsx
              ├── useQuery(['plan', activeWeek]) → fetchPlan() → /api/plan?week=…
              ├── useQuery(['stats']) → fetchStats() → /api/stats
              ├── useQuery(['recipes']) → fetchRecipes() → /api/recipes
              ├── useMutation(deletePlanSlot) → DELETE /api/plan/:id
              ├── WeeklyPlan (apps/web/src/components/WeeklyPlan.tsx)
              │     └── markSlotCooked → POST /api/plan/:id/cooked
              └── PlanSlotDialog / ConfirmDeleteDialog (apps/web/src/components/PlanSlotDialog.tsx)
                    └── createPlanSlot / patchPlanSlot → POST/PATCH /api/plan
```

State transitions:

- Add / edit / delete success: invalidates `['plan', activeWeek]`, `['stats']`, and `['recipes']`. When the active week equals the current week, it also invalidates `['cart', currentWeek]` so any cart UI refreshes from the auto cart aggregation.
- Cook success: same invalidations as add/edit/delete so the slot counter, summary, and recipe overview stay in sync. No local cache is mutated optimistically; the displayed counts and dates come from the fresh server data.
- Cook error: leaves the cached values untouched and surfaces the API/network message in the existing `role="status"` banner via `setBanner()`.

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/pages/Dashboard.tsx` | Page-level state, React Query wiring, dialog orchestration, and stats rendering. The dialog is mounted for both add and edit state (`addDay !== null || editing !== null`). |
| `apps/web/src/components/WeeklyPlan.tsx` | Seven-column grid of planned meals, per-slot actions, and cook handling. |
| `apps/web/src/components/PlanSlotDialog.tsx` | Add/edit dialog and `ConfirmDeleteDialog`. |
| `apps/web/src/lib/plan.ts` | ISO week helpers, typed API clients, and day-label constants. |
| `apps/web/src/App.tsx` | Router configuration (`/` → `Dashboard`). |

# Examples

```text
# Manual smoke test
1. Navigate to /
2. Click + Add on Wednesday
3. Pick slot "Dinner", recipe "Tomato Soup", notes "extra basil"
4. Submit → the slot appears in the Wednesday column and in the Planned slots table
5. Click `I cooked this` → label flips to `Logging…` while the request is pending, then returns to `I cooked this`; the per-recipe counter increments
6. Click the underlined "Tomato Soup" in the Planned slots table → the dialog opens pre-filled
7. Change the slot to "Lunch" → Save → the card moves to the Lunch slot of the same day
8. Click X on the slot → Confirm Delete → the row disappears
```