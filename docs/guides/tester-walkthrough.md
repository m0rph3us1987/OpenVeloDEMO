---
type: Guide
title: Tester Walkthrough
description: Navigation steps and expected UI behaviors for each route in the OpenVelo web app.
tags: [guide, tester, ui]
timestamp: 2026-07-26T19:32:25Z
---

# Prerequisites

1. Start the app per [Running the App Locally](/guides/local-setup.md).
2. Open `http://localhost:5173` in a browser.

# Global Layout

The UI is a two-column flex layout. The sidebar is **always visible** (it never collapses) and resizes responsively; the right area scrolls independently.

## Sidebar Widths

| Viewport | Sidebar Width |
|----------|---------------|
| Default (mobile / `< md`) | `w-56` (224px) |
| `md` and up (≥ 768px) | `w-60` (240px) |
| `lg` and up (≥ 1024px) | `w-64` (256px) |

The main content area uses `p-4` padding on small screens and `p-6` from the `md` breakpoint up. Resize the window and confirm the sidebar stays put while only its width changes.

## Sidebar Contents

- **Left sidebar** — branded `OpenVelo` heading, five navigation links (`Dashboard`, `Recipes`, `Ingredients`, `Shopping Cart`, `Settings`), and a `Light mode` / `Dark mode` toggle button at the bottom.
- **Right content area** — the active page renders inside an `<Outlet />` and scrolls independently of the sidebar.

If the viewport is short, the sidebar scrolls internally (`overflow-y-auto`) instead of clipping the toggle button off-screen.

# Route: Dashboard (`/`)

**How to reach it:** Default landing page, or click `Dashboard` in the sidebar.

**Expected behavior:**
- Heading: `Dashboard`.
- Subtitle: `Plan your meals for the week and track what you have cooked.`
- A control row with `←`, `→`, and `Today` buttons plus a `Week of <YYYY-MM-DD> – <YYYY-MM-DD>` label.
- A seven-column `Weekly plan` grid (Monday → Sunday). Today's column is highlighted with `border-accent ring-2 ring-ring` when viewing the current ISO week.
- Each column has a `+ Add` button. Each planned meal shows the meal-slot label, the recipe name, optional notes, an `I cooked this` button, and a red `X` delete button.
- Below the grid, a `Planned slots` table (Day / Slot / Recipe / Notes) mirrors the planned slots. Click an underlined recipe name to open the pre-filled `Edit planned meal` dialog; changing a field and clicking `Save` updates the slot and closes the dialog.
- At the bottom, a `Total times cooked per recipe` table (Recipe / Times cooked / Last cooked) summarises lifetime cook logs across every recipe. Never-cooked recipes appear with `0` and an empty `Last cooked` cell.

See [Dashboard Page](/web/dashboard.md) for the full add/edit/delete/cook interaction steps.

# Route: Recipes (`/recipes`)

**How to reach it:** Click `Recipes` in the sidebar.

**Expected behavior:**
- Heading: `Recipes`.
- `Add Recipe` button, an ingredients-driven recipe table, and per-row `Edit` / `Delete` actions.
- Inline create editor, modal edit dialog, and inline delete confirm block with the expected inline validation messages (`Recipe name is required`, `Pick an ingredient`, `Quantity must be greater than 0`).
- API error messages from create, edit, or delete are surfaced inside the relevant editor. When the API responds with both an `error` string and a stable `code`, the page renders `<error> (<code>)` — for example `Recipe cannot be deleted because it is referenced by other records (REFERENCED_BY_OTHER_RECORD)`.

See [Recipes Page](/web/recipes.md) for the full add/edit/delete interaction steps.

# Route: Ingredients (`/ingredients`)

**How to reach it:** Click `Ingredients` in the sidebar.

**Expected behavior:**
- Heading: `Ingredients`.
- An `Add ingredient` button, category filters, and a table of persisted ingredients.
- On a fresh database the table is pre-populated with seven demo ingredients (`Beef`, `Tomato`, `Milk`, `Rice`, `Salt`, `Pepper`, `Olive Oil`) inserted by the [Database Bootstrap](/architecture/db-bootstrap.md) seed.
- Users can create, edit, and delete ingredients through forms and confirmation dialogs.
- Deleting an ingredient that is referenced by a recipe, a cook-log row, or a shopping-cart line succeeds and silently removes those dependent rows (Recipes themselves, other ingredients, and unrelated cart lines are untouched). If a deletion is blocked by a foreign key the cascade does not cover, the dialog surfaces the API error inline as `<error> (<code>)` — for example `Ingredient is referenced by other records (REFERENCED_BY_OTHER_RECORD)`.
- Loading, empty-filter, request-error, and field-validation states are visible and actionable.

Follow the complete interaction steps in [Ingredients Page](/web/ingredients.md).

# Route: Shopping Cart (`/shopping-cart`)

**How to reach it:** Click `Shopping Cart` in the sidebar.

**Expected behavior:**
- Heading: `Shopping Cart`, with a `Week` selector defaulting to the current ISO week.
- Ingredient rows grouped by category with `Ingredient`, `Auto`, `Manual`, and `Total` columns plus `Plan` and/or `Manual` badges.
- Plan-derived quantities are read-only; current-week manual contributions can be added, edited, and deleted without changing the auto amount.
- The `Add manual line` form provides an ingredient search picker, positive quantity input, unit selector (`g`, `kg`, `ml`, `l`, `pcs`), optional note, and `Add to cart` button.
- Empty carts show `Your cart is empty. Add an item below or plan a recipe.`
- Choosing a past week shows a `Viewing <week label> — read only` banner and hides add, edit, and delete controls.
- Loading, retryable read errors, validation errors, and dismissible mutation-error banners are visible.

Follow the complete interaction steps in [Shopping Cart Page](/web/shopping-cart.md).

# Sidebar Active State

The currently selected nav link receives an `bg-accent text-background` background, while inactive links show a `hover:bg-muted` hover state. Click each link and confirm the active state moves with the selection.

## Browser History

1. Visit `/`, then click `Recipes`, then click `Shopping Cart`.
2. Use the browser Back button and confirm `Recipes` becomes highlighted and its page is shown.
3. Use Back again and confirm `Dashboard` becomes highlighted.
4. Use Forward and confirm `Recipes` becomes highlighted again.

The highlight must always match the URL after browser history navigation; it must not remain on the previously clicked item.

# Keyboard Focus (Focus Rings)

**How to verify:** Press `Tab` repeatedly from the page load. Do **not** click anything with the mouse first.

**Expected behavior:**
- Each nav link and the theme toggle button shows a 2px blue ring (`ring-ring`) with a 2px gap to the underlying surface (`ring-offset-background`) when focused via keyboard.
- The ring color is blue in both light and dark themes; only the hue shifts.
- Clicking an element with the mouse does **not** show the ring (`focus-visible` is keyboard-only).
- Focus order: `Dashboard` → `Recipes` → `Ingredients` → `Shopping Cart` → `Settings` → theme toggle.

See [Focus Ring Design Token](/web/focus-ring.md) for the underlying token.

# Theme Toggle

**How to use it:** Click the `Light mode` / `Dark mode` button at the bottom of the sidebar. You can also reach it with the keyboard — `Tab` to it and press `Space`/`Enter`; the focus ring should be visible before activation.

**Expected behavior:**
- The button label flips between `Light mode` and `Dark mode`.
- The page background and text colors invert (driven by the `dark` class on `<html>`).
- The selection persists across reloads via `localStorage`. Reload the page and confirm the chosen theme is restored.
- If `localStorage` is empty, the theme follows the OS `prefers-color-scheme` setting.

# API Health Check

The Ingredients page calls the API through the Vite development proxy. The API can also be verified separately:

```bash
curl http://localhost:3001/api/health
# Expected: {"ok":true}

curl http://localhost:3001/api/ingredients
# Expected: a JSON array, initially [] for an empty database
```

See [Health Endpoint](/api/health.md) and [Ingredients API](/api/ingredients.md).

# Route: NotFound (any unmatched URL, e.g. `/unknown-route` or `/recipes/new`)

**How to reach it:** Type any URL that does not match a registered route into the address bar — for example `http://localhost:5173/unknown-route` or `http://localhost:5173/recipes/new`.

**Expected behavior:**
- The persistent sidebar remains visible with all four nav links and the theme toggle unchanged.
- The sidebar scrolls and the theme toggle still work.
- The main content area shows:
  - Heading: `Page not found`.
  - Subtext: `The page you are looking for does not exist.`
  - A `Back to Dashboard` link that routes to `/`.
- Clicking `Back to Dashboard` (or any sidebar link) returns to a normal page.

See [NotFound Page](/web/not-found.md) for the underlying component and [RouterErrorElement](/web/router-error-element.md) for the sibling error boundary that handles thrown 404 responses from loaders.

# Route: Settings (`/settings`)

**How to reach it:** Click `Settings` in the sidebar.

**Expected behavior:**
- Heading: `Settings`, with subtitle `Application information and data management.`
- An `About OpenVelo` card describing the product and showing `Version 0.1.0`.
- A `Data` card with explanatory copy and a `Clear all data` button (`Button` with `aria-haspopup="dialog"`).
- Clicking `Clear all data` opens a confirmation modal titled `Clear all data?` with the body `This will erase all recipes, ingredients, planned meals, cook history, and shopping cart, and re-seed the demo data.`
- The modal contains `Cancel` and `Clear all data` buttons. While the request is pending the primary button label becomes `Clearing…` and both buttons are disabled; pressing `Escape` is also ignored while pending.
- On success the modal closes, the success message `All data cleared and reseeded with the demo set.` appears in green, and the message auto-clears after 3 seconds. Every cached page (`Ingredients`, `Recipes`, `Dashboard`, `Shopping Cart`) re-reads its data on the next visit.
- On failure the modal stays open and the error message is rendered in red under the body text. Cancel and retry, or fix the underlying issue and click `Clear all data` again.

**API sanity check:**

```bash
curl -X POST http://localhost:3001/api/admin/reset
# Expected: {"ok":true,"reseeded":true,"ingredients":13,"recipes":4}
```

Follow the complete interaction steps in [Settings Page](/web/settings.md) and the destructive handler in [Admin API](/api/admin.md).
