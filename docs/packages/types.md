---
type: Package
title: Shared Types
description: Constants and TypeScript types exported from `@openvelo/types` and consumed by both API and web.
tags: [types, package, shared]
timestamp: 2026-07-26T11:39:07Z
---

# Purpose

`packages/types` is the single source of truth for cross-workspace enums and constant lists. It is depended on by both `@openvelo/api` and `@openvelo/web`.

# Exports

| Export | Kind | Description |
|--------|------|-------------|
| `IngredientCategory` | const object + type | Allowed ingredient categories: `Meat`, `Vegetables`, `Dairy`, `Grains`, `Spices`, `Other`. |
| `INGREDIENT_CATEGORIES` | readonly array | Iteration-safe list of all categories. |
| `BaseUnit` | const object + type | Allowed base units: `g`, `ml`, `pcs`. |
| `BASE_UNITS` | readonly array | Iteration-safe list of all base units. |

# Usage

```ts
import { IngredientCategory, BASE_UNITS } from '@openvelo/types';

const category: IngredientCategory = IngredientCategory.Vegetables;
const units = BASE_UNITS; // ['g', 'ml', 'pcs']
```

# Source

`packages/types/src/index.ts` — the only source file in the package. Tests live in `packages/types/tests/types.test.ts`.
