---
type: Guide
title: Recipes Page
description: Architecture and tester workflow for creating, editing, and deleting recipes on the web application.
tags: [web, recipes, guide, tester]
timestamp: 2026-07-26T14:09:19Z
---

# Purpose

The `/recipes` route replaces the former placeholder with a recipe management page. It lists persisted recipes and lets users add, edit, and delete them through the [Recipes API](/api/recipes.md).

# Navigation

1. Start the application using [Running the App Locally](/guides/local-setup.md).
2. Open `http://localhost:5173`.
3. Select **Recipes** in the persistent sidebar, or navigate directly to `http://localhost:5173/recipes`.

# Visual Elements

| Element | Expected appearance and purpose |
|---------|---------------------------------|
| `Recipes` heading | Identifies the active page. |
| `Add Recipe` button | Expands the inline create editor; its label changes to `Close` while the editor is open. |
| Recipes table | Shows `Name`, `Ingredients` (each row's name, quantity, and unit), `Times cooked`, and row actions. |
| `Edit` action | Opens a modal dialog with the selected recipe values prefilled. |
| `Delete` action | Reveals an inline confirm block `Delete this recipe?` and a `Delete`/`Cancel` pair. |
| Recipe editor | A name input, an ingredient rows list with `Add row` / per-row `Remove`, and `Save` / `Cancel` controls. Each row contains a searchable `Ingredient` picker, a numeric `Quantity` input, and a `Unit` select (`g`, `ml`, `pcs`). |

# Loading, Empty, and Error States

- While the initial list request is pending, the page shows `Loading recipes...`.
- If there are no recipes after loading, the page shows `No recipes yet — add your first one`.
- If loading fails, the page shows `Could not load recipes.` and a `Retry` button.
- Mutation failures are displayed as inline alert text inside the editor or delete confirm block.

# Examples

## Add a recipe

1. Select **Add Recipe**.
2. Enter a **Recipe name**.
3. Select **Add row**, type in the ingredient field, and pick an existing ingredient from the dropdown (case-insensitive substring match).
4. Enter a **Quantity** greater than `0`.
5. Choose a **Unit** (`g`, `ml`, or `pcs`). The unit defaults to the ingredient's base unit the first time the row is filled.
6. Repeat to add more rows; use **Remove** to delete a row.
7. Select **Save**. While saving, the button displays `Saving...`.
8. On success, the editor closes and the refreshed table includes the new recipe in API name order.

Saving with a missing name displays `Recipe name is required`. Saving with a row that has no ingredient selected displays `Pick an ingredient` next to that row. Saving with a non-positive quantity displays `Quantity must be greater than 0` under the quantity field. Server-side validation errors are surfaced as inline text inside the editor.

## Edit a recipe

1. Select **Edit** on a table row.
2. Confirm the modal fields contain the current name and ingredients.
3. Change the name, the rows, or both. Adding and removing rows is supported. Selecting **Save** while pending displays `Saving...`.
4. On success, the modal closes and the refreshed row displays the changes.
5. Select **Cancel` to close the modal without saving.

## Delete a recipe

1. Select **Delete** on a table row.
2. The row reveals `Delete this recipe?` with a `Delete`/`Cancel` pair.
3. Select **Delete** to remove the recipe; the button displays `Deleting...` while pending.
4. On success, the confirm block closes and the recipe disappears after the list refreshes.
5. Select **Cancel` to close the confirm block without deleting.

# Architecture

`apps/web/src/App.tsx` binds `/recipes` to `Recipes` from `apps/web/src/pages/Recipes.tsx`. The page uses TanStack Query with the `['recipes']` query key and consumes the `['ingredients']` query to drive the picker. Each successful mutation invalidates `['recipes']` so the table is fetched again.

```text
/recipes route
  └── Recipes page
        ├── useQuery → GET /api/recipes
        ├── useQuery → GET /api/ingredients
        ├── useMutation → POST /api/recipes
        ├── useMutation → PATCH /api/recipes/:id
        └── useMutation → DELETE /api/recipes/:id
              └── invalidate ['recipes'] after success
```

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/pages/Recipes.tsx` | Page UI, list rendering, editor, validation, and query cache invalidation. |
| `apps/web/src/components/IngredientPicker.tsx` | Searchable combobox that filters ingredients by case-insensitive substring. |
| `apps/web/src/App.tsx` | Registers the `/recipes` route. |
| `apps/web/src/main.tsx` | Supplies the shared TanStack Query client. |
| `apps/web/vite.config.ts` | Proxies browser `/api` requests to `http://localhost:3001` during development. |
| `apps/web/tests/recipes.test.tsx` | Covers rendering, validation, the searchable picker, edit, and delete flows. |
| `packages/types/src/index.ts` | Defines `BaseUnit` and `BASE_UNITS` used to constrain the unit dropdown and API validation. |
