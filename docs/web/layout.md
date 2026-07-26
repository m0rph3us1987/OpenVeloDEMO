---
type: Component
title: Layout Component
description: Top-level shell that renders a responsive persistent sidebar, sidebar navigation, theme toggle, and the active route's content.
tags: [web, layout, navigation, a11y]
timestamp: 2026-07-26T11:53:07Z
---

# Source

`apps/web/src/components/Layout.tsx`. Used as the root route element in `apps/web/src/App.tsx`.

# Integration

`App.tsx` mounts `Layout` for `/`, then renders each matched child route through its `<Outlet />`. The sidebar links use `useLocation()` and `matchPath()` to derive the active state, while the theme button reads and updates [Theme Store](/web/theme-store.md).

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/Layout.tsx` | Persistent shell, navigation, active-route styling, and theme control. |
| `apps/web/src/App.tsx` | Registers the layout and its child routes. |
| `apps/web/src/store/theme.ts` | Stores the selected theme and applies the document class. |
| `apps/web/src/components/ui/button.tsx` | Provides the outline button used by the theme control. |
| `apps/web/tests/layout.test.tsx` | Verifies navigation, active states, focus rings, history navigation, and unmatched routes. |

# Render Tree

```
<div class="flex h-full min-h-0">          <!-- flex row, min-h-0 so children can shrink/scroll -->
  <aside class="w-56 md:w-60 lg:w-64 shrink-0 ... h-full overflow-y-auto">
    <h1>OpenVelo</h1>
    <nav>{NAV_ITEMS.map(NavLink)}</nav>    <!-- focus-visible ring on each link -->
    <Button variant="outline">             <!-- focus-visible ring via Button base -->
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </Button>
  </aside>
  <main class="flex-1 min-w-0 p-4 md:p-6 overflow-auto">
    <Outlet />
  </main>
</div>
```

# Responsive Sidebar Widths

The sidebar is **always visible** (no collapse/toggle) and adapts to the viewport:

| Breakpoint | Sidebar Width |
|------------|---------------|
| `< md` (default) | `w-56` (224px) |
| `md` (≥ 768px) | `w-60` (240px) |
| `lg` (≥ 1024px) | `w-64` (256px) |

The main content uses responsive padding (`p-4 md:p-6`) and `min-w-0` so wide children (tables, code blocks) do not force horizontal scroll on the page — they scroll inside `<main>` instead.

# Navigation Items

Defined in the `NAV_ITEMS` constant at the top of the file:

| Link | `to` | `end` |
|------|------|-------|
| Dashboard | `/` | `true` |
| Recipes | `/recipes` | `false` |
| Ingredients | `/ingredients` | `false` |
| Shopping Cart | `/shopping-cart` | `false` |

# Active Link Styling

The layout compares `location.pathname` with each item using `matchPath()` and applies:

- `bg-accent text-background` for the active route.
- `hover:bg-muted` for inactive routes.
- `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` on every link so keyboard users see a clear focus indicator.

Because the active state follows the router location, browser Back and Forward navigation immediately updates the highlighted link.

# Theme Toggle

The footer button reads `theme` from [Theme Store](/web/theme-store.md) and calls `toggle()` on click. The label is `Light mode` when the current theme is dark, else `Dark mode`. It uses the shared `Button` primitive, which also applies the focus ring.

# Accessibility

- The toggle button has `aria-label="Toggle theme"` so screen readers announce the action regardless of the visible label.
- Every nav link and the toggle button renders a 2px focus ring (`ring-ring`) with a 2px offset against the page background when focused via keyboard (`focus-visible`).
- Sidebar uses `shrink-0` so it never collapses, and `overflow-y-auto` so long nav lists scroll inside the aside instead of overflowing the viewport.

# Adding a New Sidebar Entry

1. Append a new entry to `NAV_ITEMS` in `apps/web/src/components/Layout.tsx`.
2. Register the corresponding route in `apps/web/src/App.tsx`.
3. Implement the page component (replace a placeholder in `PlaceholderPages.tsx` or create a new file under `apps/web/src/pages/`).

# Related

- [Web Application](/architecture/web-app.md) — routing and providers wired around the layout.
- [Theme Store](/web/theme-store.md) — backing store for the toggle button.
- [Tester Walkthrough](/guides/tester-walkthrough.md) — what to verify in the UI.
