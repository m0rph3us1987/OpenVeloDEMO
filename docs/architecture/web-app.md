---
type: Architecture
title: Web Application
description: React SPA structure, routing, state management, and styling.
tags: [web, react, vite, spa]
timestamp: 2026-07-26T12:57:49Z
---

# Overview

The web app is a React 18 single-page application built with Vite, styled with Tailwind CSS, and bundled through shadcn/ui-style components.

# Bootstrap

`apps/web/src/main.tsx` mounts the React root and:

1. Creates a TanStack Query `QueryClient`.
2. Calls `useThemeStore.init()` on mount to apply the persisted light/dark theme.
3. Wraps the app in `QueryClientProvider` and `React.StrictMode`.

# Routing

Routing is configured in `apps/web/src/App.tsx` using `react-router-dom` and a single layout wrapper:

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `Dashboard` | Index route, default landing page. |
| `/recipes` | `Recipes` | Placeholder page. |
| `/ingredients` | `Ingredients` | Data-backed ingredient list with filters and CRUD dialogs. See [Ingredients Page](/web/ingredients.md). |
| `/shopping-cart` | `ShoppingCart` | Placeholder page. |
| `*` | `NotFound` | Wildcard; matches any unmatched path (including nested ones like `/recipes/new`). See [NotFound Page](/web/not-found.md). |

All routes are children of the `Layout` component, which renders the sidebar and an `<Outlet />`. The root layout also sets `errorElement: <RouterErrorElement />` so thrown errors (including 404 responses) are caught and rendered inside the same persistent shell. See [RouterErrorElement](/web/router-error-element.md).

# State

| Store | File | Purpose |
|-------|------|---------|
| `useThemeStore` | `apps/web/src/store/theme.ts` | Light/dark theme with `localStorage` persistence and `prefers-color-scheme` fallback. See [Theme Store](/web/theme-store.md). |

# Data Fetching

The [Ingredients Page](/web/ingredients.md) uses TanStack Query with the `['ingredients']` query key. Browser requests target relative `/api/ingredients` URLs; the Vite development server proxies `/api` to `http://localhost:3001`. Successful create, update, and delete mutations invalidate the query and refresh the list.

# Layout & Styling

The shell uses a persistent two-column flex layout: a responsive sidebar (always visible, never collapses) and a scrollable main area. See [Layout Component](/web/layout.md) for breakpoint widths and the `focus-visible` ring contract. The shared ring style is documented in [Focus Ring Design Token](/web/focus-ring.md).

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/main.tsx` | App bootstrap, providers, theme init. |
| `apps/web/src/App.tsx` | Router and route table. |
| `apps/web/src/components/Layout.tsx` | Persistent responsive sidebar, nav links, theme toggle, content outlet. |
| `apps/web/src/components/RouterErrorElement.tsx` | Root route error boundary; handles thrown 404/500 responses and unexpected errors. See [RouterErrorElement](/web/router-error-element.md). |
| `apps/web/src/pages/PlaceholderPages.tsx` | Placeholder content for Dashboard, Recipes, and Shopping Cart. |
| `apps/web/src/pages/Ingredients.tsx` | Ingredient list, filters, forms, dialogs, and [API](/api/ingredients.md) integration. |
| `apps/web/src/pages/NotFound.tsx` | Unmatched-route fallback (wildcard `*` child). See [NotFound Page](/web/not-found.md). |
| `apps/web/src/components/ui/button.tsx` | Shared button primitive (CVA variants) with focus-ring base. |
| `apps/web/src/index.css` | CSS custom properties (background, foreground, muted, accent, ring) for light + dark. |
| `apps/web/tailwind.config.ts` | Tailwind theme tokens (background, foreground, muted, accent, ring). |
| `apps/web/src/lib/utils.ts` | `cn()` helper for conditional Tailwind classes. |
| `apps/web/tests/layout.test.tsx` | Vitest + Testing Library tests for the sidebar. |
| `apps/web/tests/ingredients.test.tsx` | UI tests for ingredient filtering and CRUD workflows. |
| `apps/web/vite.config.ts` | Vite setup, test environment, aliases, and `/api` proxy to the API server. |

# Tests

`apps/web/tests/layout.test.tsx` (Vitest + `@testing-library/react`) covers:

1. The four nav links render inside the sidebar.
2. The active route receives the `bg-accent text-background` classes while siblings do not.
3. Nav links and the theme toggle both carry the `focus-visible:ring-2` and `focus-visible:ring-ring` classes.
4. Unknown routes (e.g. `/unknown-route`, `/recipes/new`) keep the sidebar visible and render the [NotFound Page](/web/not-found.md).

# Adding a New Page

1. Add a placeholder component in `apps/web/src/pages/` (or replace one in `PlaceholderPages.tsx`).
2. Register the route in `apps/web/src/App.tsx` under the `children` array of the root layout.
3. If the page is a top-level section, add a `NAV_ITEMS` entry in `apps/web/src/components/Layout.tsx` so it appears in the sidebar.
