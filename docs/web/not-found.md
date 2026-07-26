---
type: Component
title: NotFound Page
description: Fallback page rendered for any route that does not match a registered route, including nested unmatched paths.
tags: [web, routing, 404]
timestamp: 2026-07-26T12:03:52Z
---

# Source

`apps/web/src/pages/NotFound.tsx`. Registered as the wildcard child route in `apps/web/src/App.tsx`.

# Purpose

React Router renders `NotFound` for any URL that doesn't match a more specific route declared in the router. This includes:

- Top-level paths that have no entry under the root layout (e.g. `/settings`, `/help`).
- Nested paths that fall under a known parent but have no matching child (e.g. `/recipes/new`, `/ingredients/123`).

Because the `NotFound` route is declared as a child of the root `Layout`, the persistent sidebar remains visible — only the content area of `<main>` is replaced.

# Render Tree

```
<main class="flex-1 min-w-0 p-4 md:p-6 overflow-auto">  <!-- inherited from Layout -->
  <div class="flex flex-col gap-3">
    <h2 class="text-2xl font-semibold">Page not found</h2>
    <p class="text-sm opacity-80">
      The page you are looking for does not exist.
    </p>
    <Link to="/" class="text-sm underline">Back to Dashboard</Link>
  </div>
</main>
```

# How It Is Wired

In `apps/web/src/App.tsx`, the wildcard route is the last child of the root layout:

```ts
{
  path: '/',
  element: <Layout />,
  errorElement: <RouterErrorElement />,
  children: [
    { index: true, element: <Dashboard /> },
    { path: 'recipes', element: <Recipes /> },
    { path: 'ingredients', element: <Ingredients /> },
    { path: 'shopping-cart', element: <ShoppingCart /> },
    { path: '*', element: <NotFound /> },
  ],
}
```

The `*` matcher is intentionally listed **after** the named routes so that the named routes still win when both could match.

# Related

- [RouterErrorElement](/web/router-error-element.md) — sibling error boundary that also handles 404s when thrown via `useRouteError`.
- [Layout Component](/web/layout.md) — wraps the page so the sidebar stays visible.
- [Web Application](/architecture/web-app.md) — full route table.
