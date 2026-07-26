---
type: Guide
title: Shopping Cart Page
description: Tester workflow and technical wiring for weekly plan-derived and manually added shopping-cart items.
tags: [web, cart, tester, shopping]
timestamp: 2026-07-26T18:44:22Z
---

# Purpose

The `/shopping-cart` route renders `ShoppingCart` from `apps/web/src/pages/ShoppingCart.tsx`. It shows the current weekly shopping list derived from the meal plan, allows manual additions, and provides read-only access to frozen past weeks.

# Navigation

1. Start the web and API applications.
2. Click `Shopping Cart` in the persistent sidebar, or navigate directly to `/shopping-cart`.
3. Confirm the heading reads `Shopping Cart` and the `Week` selector defaults to `Current week (<YYYY-Www>)`.

# Current-Week Layout

Items are grouped into bordered category sections such as `Meat`, `Dairy`, or `Grains`. Each section contains a table with these columns:

| Column | Expected content |
|--------|------------------|
| `Ingredient` | Ingredient name, category badge, and `Plan` and/or `Manual` source badges. |
| `Auto` | Quantity derived from planned recipe ingredients and servings. |
| `Manual` | Manual quantity; editable only when a manual contribution exists in the current week. |
| `Total` | Auto plus manual quantity. |
| Actions | `Delete` for current-week manual contributions only. |

Amounts below 1000 display in `g` or `ml`; amounts at or above 1000 display in `kg` or `l`. Piece counts display as whole `pcs` values.

If no rows exist, the page shows `Your cart is empty. Add an item below or plan a recipe.`

# Examples

## Verify plan-derived rows

1. On the [Dashboard](/web/dashboard.md), add a recipe with ingredient rows to the current week.
2. Open `/shopping-cart`.
3. Find those ingredients under their categories.
4. Confirm each row has a `Plan` badge, a value in `Auto`, and the same value in `Total` when no manual amount exists.
5. Confirm a plan-only row has no editable manual input and no `Delete` button.

Changing a current-week plan slot triggers the [Cart Recompute](/architecture/cart-recompute.md) pipeline; reloading or revisiting the cart reflects the new plan totals.

## Add a manual line

1. In `Add manual line`, use `Search ingredient` to select an existing ingredient.
2. Enter a positive `Quantity`.
3. Choose a `Unit` that matches the selected ingredient's base dimension: `g` or `kg` for a `g`-base ingredient, `ml` or `l` for an `ml`-base ingredient, `pcs` for a `pcs`-base ingredient. The Unit dropdown only offers units compatible with the currently selected ingredient.
4. Optionally enter a note.
5. Click `Add to cart`.
6. Confirm the row appears immediately under the ingredient's category with a `Manual` badge and the total includes the new amount.

The form shows `Quantity is required` when the quantity input is empty (or contains only whitespace), `Quantity must be greater than 0` for non-numeric, zero, or negative amounts, `Pick an ingredient` if no picker option is selected, and `Unit must match the ingredient's allowed base units (...)` if a non-compatible unit is submitted. The quantity value is trimmed before numeric parsing, so leading/trailing whitespace does not break validation. Validation checks run in this order: required-quantity → numeric-quantity → ingredient-selected → unit-compatible. While saving, the button reads `Saving...`. API failures appear in a dismissible red banner and the optimistic change is rolled back.

Adding the same ingredient and compatible unit again creates a new manual line that appears as a separate row beneath the previous one. Each manual line has its own quantity, unit, note, and `Delete` button; deleting one line never affects the others.

## Edit a manual contribution

1. Find a current-week row with a `Manual` badge.
2. Change its manual quantity and unit, then click `Save` or leave the input.
3. Confirm `Manual` and `Total` update while `Auto` remains unchanged.

A mixed-source row displays both `Plan` and `Manual`. Editing it changes only the manual contribution; the planned amount is not editable from this page. When multiple manual lines exist for the same `(ingredientId, unit)`, each line is rendered as a separate row that carries the matching `autoQuantity` alongside its own `manualQuantity`, and the two rows have independent edit controls and `Delete` buttons.

## Delete a manual contribution

1. Click `Delete` on a current-week manual row.
2. Confirm its manual contribution disappears.
3. For a mixed-source row, confirm the plan-derived contribution remains after the manual contribution is deleted.

## View a past week

1. Open the `Week` selector.
2. Choose a historical week.
3. Confirm a banner reads `Viewing <week label> — read only`.
4. Confirm there is no `Add manual line` form and no edit or delete controls.
5. Confirm manual badges are marked `Manual (read-only)`.

Past-week results are frozen by the [Shopping Cart API](/api/cart.md) and remain stable on subsequent reads.

# Loading and Error States

- While loading, the page shows `Loading cart...`.
- A failed cart read shows `Could not load cart.` and a `Retry` button.
- Failed mutations show a red message banner with a `Dismiss` button.
- All quantity inputs, selectors, and buttons use the shared keyboard focus ring.

# Accessibility (Manual Line Form)

The `Quantity` input in `Add manual line` is announced as required to assistive tech (`aria-required="true"`) instead of relying on the browser's native `required` attribute. When validation fails because of the quantity field, the input is also marked invalid (`aria-invalid="true"`), letting screen readers surface the error alongside the visible message. The form's existing `<label>` association and the live validation banner provide the linked error text.

# Technical Wiring

React Query caches carts under `['cart', weekKey]`, historical summaries under `['cart-weeks']`, and the ingredient picker data under `['ingredients']`. Create, update, and delete mutations optimistically update the current-week cache, roll back on failure, and invalidate it after settlement.

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/App.tsx` | Registers `/shopping-cart`. |
| `apps/web/src/pages/ShoppingCart.tsx` | Page state, grouped tables, forms, read-only mode, and optimistic mutations. |
| `apps/web/src/lib/cart.ts` | Cart types, HTTP requests, API error formatting, and metric display promotion. |
| `apps/web/src/components/IngredientPicker.tsx` | Searchable ingredient selection used by the manual-line form. |
| `apps/api/src/cart.ts` | Backing [Shopping Cart API](/api/cart.md). |
| `apps/web/tests/shopping-cart.test.tsx` | UI coverage for grouping, metric display, past-week mode, optimistic errors, and mixed-source edits. |
| `apps/web/tests/shopping-cart-validation.test.tsx` | UI coverage for manual-line form validation order, empty/whitespace/non-numeric/negative quantity handling, ingredient-required check, and unit compatibility errors. |
