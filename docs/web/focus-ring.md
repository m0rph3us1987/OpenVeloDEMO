---
type: Design System
title: Focus Ring Design Token
description: The shared `ring-ring` focus-visible style and `--ring` CSS variable used by interactive elements across the web app.
tags: [web, a11y, tailwind, focus, design-system]
timestamp: 2026-07-26T11:53:07Z
---

# Purpose

Provides a single, consistent keyboard-focus indicator for all interactive elements (buttons, nav links, form controls that adopt the shared `Button` primitive). Implemented as a Tailwind theme color backed by a CSS custom property so light/dark themes can ship different ring hues.

# Token Definition

| Layer | File | Declaration |
|-------|------|-------------|
| Tailwind theme | `apps/web/tailwind.config.ts` | `ring: 'hsl(var(--ring))'` (added to `theme.extend.colors`). |
| Light theme CSS variable | `apps/web/src/index.css` | `--ring: 222 89% 55%;` (inside `:root`). |
| Dark theme CSS variable | `apps/web/src/index.css` | `--ring: 217 91% 60%;` (inside `.dark`). |

# Applied Classes

Interactive primitives apply the following `focus-visible` classes:

```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
focus-visible:ring-offset-background
```

| Component | File | Notes |
|-----------|------|-------|
| `Button` (all variants) | `apps/web/src/components/ui/button.tsx` | Added to the shared CVA base so every variant inherits the ring. |
| Sidebar `NavLink` | `apps/web/src/components/Layout.tsx` | Added per-link inside the function-form `className`. |

The `ring-offset-background` rule uses the same `--background` token the page already paints with, so the ring offset is invisible against the page but visible against solid controls (e.g. the outlined theme toggle).

# Behavior

- The ring only appears on **keyboard focus** (`focus-visible`), not on mouse clicks — preserving the visual design for pointer users.
- The ring color shifts automatically with the active theme because both `:root` and `.dark` define their own `--ring` value.
- `outline-none` is used to suppress the browser default outline so the Tailwind ring is the sole indicator.

# Extending

To apply the same focus treatment to a new interactive element (e.g. a custom link or icon button), add the `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` class string directly, or use the `Button` primitive.
