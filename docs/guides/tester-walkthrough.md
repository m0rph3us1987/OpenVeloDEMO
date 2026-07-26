---
type: Guide
title: Tester Walkthrough
description: Navigation steps and expected UI behaviors for each route in the OpenVelo web app.
tags: [guide, tester, ui]
timestamp: 2026-07-26T12:57:49Z
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

- **Left sidebar** — branded `OpenVelo` heading, four navigation links (`Dashboard`, `Recipes`, `Ingredients`, `Shopping Cart`), and a `Light mode` / `Dark mode` toggle button at the bottom.
- **Right content area** — the active page renders inside an `<Outlet />` and scrolls independently of the sidebar.

If the viewport is short, the sidebar scrolls internally (`overflow-y-auto`) instead of clipping the toggle button off-screen.

# Route: Dashboard (`/`)

**How to reach it:** Default landing page, or click `Dashboard` in the sidebar.

**Expected behavior:**
- Heading: `Dashboard`.
- Introductory paragraph: `Welcome to OpenVelo. Use the sidebar to navigate.`
- A bulleted list of three cross-links: `Recipes`, `Ingredients`, `Shopping Cart`.
- Each link is underlined and navigates to the corresponding route.

# Route: Recipes (`/recipes`)

**How to reach it:** Click `Recipes` in the sidebar.

**Expected behavior:**
- Heading: `Recipes`.
- No other content (placeholder page).

# Route: Ingredients (`/ingredients`)

**How to reach it:** Click `Ingredients` in the sidebar.

**Expected behavior:**
- Heading: `Ingredients`.
- An `Add ingredient` button, category filters, and a table of persisted ingredients.
- Users can create, edit, and delete ingredients through forms and confirmation dialogs.
- Loading, empty-filter, request-error, and field-validation states are visible and actionable.

Follow the complete interaction steps in [Ingredients Page](/web/ingredients.md).

# Route: Shopping Cart (`/shopping-cart`)

**How to reach it:** Click `Shopping Cart` in the sidebar.

**Expected behavior:**
- Heading: `Shopping Cart`.
- No other content (placeholder page).

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
- Focus order: `Dashboard` → `Recipes` → `Ingredients` → `Shopping Cart` → theme toggle.

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
