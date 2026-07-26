---
type: Component
title: Layout Component
description: Top-level shell that renders the sidebar navigation, theme toggle, and the active route's content.
tags: [web, layout, navigation]
timestamp: 2026-07-26T11:39:07Z
---

# Source

`apps/web/src/components/Layout.tsx`. Used as the root route element in `apps/web/src/App.tsx`.

# Render Tree

```
<div class="flex h-full">
  <aside>
    <h1>OpenVelo</h1>
    <nav>{NAV_ITEMS.map(NavLink)}</nav>
    <Button variant="outline">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</Button>
  </aside>
  <main><Outlet /></main>
</div>
```

# Navigation Items

Defined in the `NAV_ITEMS` constant at the top of the file:

| Link | `to` | `end` |
|------|------|-------|
| Dashboard | `/` | `true` |
| Recipes | `/recipes` | `false` |
| Ingredients | `/ingredients` | `false` |
| Shopping Cart | `/shopping-cart` | `false` |

# Active Link Styling

`NavLink` receives a function-form `className` that returns:

- `bg-accent text-background` for the active route.
- `hover:bg-muted` for inactive routes.

# Theme Toggle

The footer button reads `theme` from [Theme Store](/web/theme-store.md) and calls `toggle()` on click. The label is `Light mode` when the current theme is dark, else `Dark mode`.

# Accessibility

The toggle button has `aria-label="Toggle theme"` so screen readers announce the action regardless of the visible label.

# Adding a New Sidebar Entry

1. Append a new entry to `NAV_ITEMS` in `apps/web/src/components/Layout.tsx`.
2. Register the corresponding route in `apps/web/src/App.tsx`.
3. Implement the page component (replace a placeholder in `PlaceholderPages.tsx` or create a new file under `apps/web/src/pages/`).
