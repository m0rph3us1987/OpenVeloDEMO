---
type: Store
title: Theme Store
description: Zustand store that manages the application's light/dark theme with persistence and OS preference fallback.
tags: [web, state, theme, zustand]
timestamp: 2026-07-26T11:39:07Z
---

# Source

`apps/web/src/store/theme.ts`. The hook is `useThemeStore`.

# State Shape

| Field | Type | Description |
|-------|------|-------------|
| `theme` | `'light' \| 'dark'` | Current theme. Initial value is `'light'` until `init()` runs. |
| `init` | `() => void` | Reads stored/system theme and applies the `dark` class on `<html>`. |
| `toggle` | `() => void` | Flips the theme, persists to `localStorage`, and reapplies the class. |
| `setTheme` | `(theme: Theme) => void` | Sets a specific theme, persists, and reapplies. |

# Persistence

- Storage key: `theme` in `window.localStorage`.
- Valid stored values are `'light'` or `'dark'`; anything else is ignored.
- If no value is stored, the store falls back to `window.matchMedia('(prefers-color-scheme: dark)')`.

# DOM Effects

The store toggles the `dark` class on `document.documentElement`, which is what Tailwind's dark mode variant reads.

# Lifecycle

`useThemeStore.init()` is invoked once from `apps/web/src/main.tsx` when the React root mounts. After that, mutations only happen via the toggle button in the sidebar (see [Layout Component](/web/layout.md)).
