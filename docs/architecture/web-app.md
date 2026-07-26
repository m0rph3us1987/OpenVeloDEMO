---
type: Architecture
title: Web Application
description: React SPA structure, routing, state management, and styling.
tags: [web, react, vite, spa]
timestamp: 2026-07-26T11:39:07Z
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
| `/ingredients` | `Ingredients` | Placeholder page. |
| `/shopping-cart` | `ShoppingCart` | Placeholder page. |

All routes are children of the `Layout` component, which renders the sidebar and an `<Outlet />`.

# State

| Store | File | Purpose |
|-------|------|---------|
| `useThemeStore` | `apps/web/src/store/theme.ts` | Light/dark theme with `localStorage` persistence and `prefers-color-scheme` fallback. See [Theme Store](/web/theme-store.md). |

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/main.tsx` | App bootstrap, providers, theme init. |
| `apps/web/src/App.tsx` | Router and route table. |
| `apps/web/src/components/Layout.tsx` | Sidebar nav, theme toggle button, content outlet. |
| `apps/web/src/pages/PlaceholderPages.tsx` | Initial placeholder content for each route. |
| `apps/web/src/components/ui/button.tsx` | Shared button primitive (CVA variants). |
| `apps/web/src/lib/utils.ts` | `cn()` helper for conditional Tailwind classes. |

# Adding a New Page

1. Add a placeholder component in `apps/web/src/pages/` (or replace one in `PlaceholderPages.tsx`).
2. Register the route in `apps/web/src/App.tsx` under the `children` array of the root layout.
3. If the page is a top-level section, add a `NAV_ITEMS` entry in `apps/web/src/components/Layout.tsx` so it appears in the sidebar.
