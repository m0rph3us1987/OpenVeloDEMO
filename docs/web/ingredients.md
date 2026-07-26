---
type: Guide
title: Ingredients Page
description: Architecture and tester workflow for browsing and managing ingredients in the web application.
tags: [web, ingredients, guide, tester]
timestamp: 2026-07-26T19:32:25Z
---

# Purpose

The `/ingredients` route replaces the former placeholder with an ingredient management page. It lists persisted ingredients and lets users filter, create, edit, and delete them through the [Ingredients API](/api/ingredients.md).

# Navigation

1. Start the application using [Running the App Locally](/guides/local-setup.md).
2. Open `http://localhost:5173`.
3. Select **Ingredients** in the persistent sidebar, or navigate directly to `http://localhost:5173/ingredients`.

# Visual Elements

| Element | Expected appearance and purpose |
|---------|---------------------------------|
| `Ingredients` heading | Identifies the active page. |
| `Add ingredient` button | Expands the create form; its label changes to `Close` while the form is open. |
| Category filter buttons | `All`, `Meat`, `Vegetables`, `Dairy`, `Grains`, `Spices`, and `Other`; the active filter uses the filled button style. |
| Ingredients table | Shows `Name`, `Category`, `Base unit`, and row actions. |
| `Edit` action | Opens a modal with the selected ingredient values prefilled. |
| `Delete` action | Opens a confirmation dialog naming the ingredient. |

# Loading, Empty, and Error States

- While the initial list request is pending, the page shows `Loading ingredients...`.
- If the selected category has no records, it shows `No ingredients match this filter.`
- If loading fails, it shows `Could not load ingredients.` and a `Retry` button.
- Mutation failures are displayed as inline alert text inside the active form or delete dialog.

# Examples

## Filter the list

1. Wait for the ingredients table to load.
2. Select a category such as **Dairy**.
3. Confirm only rows in that category remain visible.
4. Select **All** and confirm the full list returns.

Filtering is client-side and does not issue a category-specific API request.

## Create an ingredient

1. Select **Add ingredient**.
2. Enter a **Name**.
3. Choose a **Category**.
4. Choose a **Base unit** (`g`, `ml`, or `pcs`).
5. Select **Create**.
6. While saving, the button displays `Saving...`.
7. On success, the form closes and the refreshed table includes the new ingredient in API name order.

Selecting **Create** with missing fields keeps existing input and displays `Name is required`, `Category is required`, or `Base unit is required` as applicable. A duplicate name displays `Ingredient name already exists`.

## Edit an ingredient

1. Select **Edit** on a table row.
2. Confirm the modal fields contain the current name, category, and base unit.
3. Change one or more values and select **Save**.
4. While saving, the button displays `Saving...`.
5. On success, the modal closes and the refreshed row displays the changes.
6. Select **Cancel** to close the modal without saving.

## Delete an ingredient

1. Select **Delete** on a table row.
2. Confirm a modal asks `Delete ingredient?` and names the selected ingredient.
3. Select **Delete** to proceed; the button displays `Deleting...` while pending.
4. On success, the modal closes and the ingredient disappears after the list refreshes.
5. Select **Cancel** to close the dialog without deleting.

If the API rejects the delete (for example because the ingredient is referenced by a relation the cascade does not cover), the dialog stays open and the inline alert shows the API error string followed by the stable code in parentheses — for example `Ingredient is referenced by other records (REFERENCED_BY_OTHER_RECORD)`.

When an ingredient is deleted, any recipe rows, cook-log rows, or current/historical shopping-cart lines that reference it are also removed. Recipes themselves and other ingredients are unaffected.

# Architecture

`apps/web/src/App.tsx` binds `/ingredients` to `Ingredients` from `apps/web/src/pages/Ingredients.tsx`. The page uses TanStack Query with the `['ingredients']` query key. Each successful mutation invalidates that query so the table is fetched again.

```text
/apps/web/src/App.tsx route
  └── Ingredients page
        ├── useQuery → GET /api/ingredients
        ├── useMutation → POST /api/ingredients
        ├── useMutation → PATCH /api/ingredients/:id
        └── useMutation → DELETE /api/ingredients/:id
              └── invalidate ['ingredients'] after success
```

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/App.tsx` | Registers the `/ingredients` route. |
| `apps/web/src/pages/Ingredients.tsx` | Page UI, forms, filtering, dialogs, fetch functions, and query cache invalidation. |
| `apps/web/src/main.tsx` | Supplies the shared TanStack Query client. |
| `apps/web/vite.config.ts` | Proxies browser `/api` requests to `http://localhost:3001` during development. |
| `apps/web/tests/ingredients.test.tsx` | Covers loading data, filtering, validation, create, edit, delete, and cancellation. |
| `packages/types/src/index.ts` | Defines the allowed categories and base units shared with the API. |
