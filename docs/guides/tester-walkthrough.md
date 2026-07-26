---
type: Guide
title: Tester Walkthrough
description: Navigation steps and expected UI behaviors for each route in the OpenVelo web app.
tags: [guide, tester, ui]
timestamp: 2026-07-26T11:39:07Z
---

# Prerequisites

1. Start the app per [Running the App Locally](/guides/local-setup.md).
2. Open `http://localhost:5173` in a browser.

# Global Layout

The UI is a two-column layout:

- **Left sidebar** — branded `OpenVelo` heading, four navigation links, and a `Light/Dark mode` toggle button at the bottom.
- **Right content area** — the active page renders inside an `<Outlet />`.

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
- No other content (placeholder page).

# Route: Shopping Cart (`/shopping-cart`)

**How to reach it:** Click `Shopping Cart` in the sidebar.

**Expected behavior:**
- Heading: `Shopping Cart`.
- No other content (placeholder page).

# Sidebar Active State

The currently selected nav link receives an `bg-accent text-background` background, while inactive links show a `hover:bg-muted` hover state. Click each link and confirm the active state moves with the selection.

# Theme Toggle

**How to use it:** Click the `Light mode` / `Dark mode` button at the bottom of the sidebar.

**Expected behavior:**
- The button label flips between `Light mode` and `Dark mode`.
- The page background and text colors invert (driven by the `dark` class on `<html>`).
- The selection persists across reloads via `localStorage`. Reload the page and confirm the chosen theme is restored.
- If `localStorage` is empty, the theme follows the OS `prefers-color-scheme` setting.

# API Health Check

The web client does not yet call the API directly, but the API can be verified separately:

```bash
curl http://localhost:3001/api/health
# Expected: {"ok":true}
```

See [Health Endpoint](/api/health.md).
