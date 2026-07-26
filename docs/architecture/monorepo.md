---
type: Architecture
title: Monorepo Layout
description: Top-level structure of the OpenVelo monorepo (apps, packages, and shared tooling).
tags: [architecture, monorepo]
timestamp: 2026-07-26T11:39:07Z
---

# Overview

OpenVelo is an npm-workspaces monorepo containing an Express API, a React/Vite web client, and a shared TypeScript types package.

# Workspaces

| Workspace | Path | Purpose |
|-----------|------|---------|
| `@openvelo/api` | `apps/api` | Express HTTP server, Prisma data layer, vitest tests. |
| `@openvelo/web` | `apps/web` | React SPA (Vite + React Router + Zustand + TanStack Query), built with Tailwind. |
| `@openvelo/types` | `packages/types` | Shared TypeScript constants/types (e.g. `IngredientCategory`, `BaseUnit`). |

# Key Root Files

| File | Responsibility |
|------|----------------|
| `package.json` | Declares workspaces and root scripts (`dev`, `build`, `test`, `typecheck`). |
| `kilo.json` | Kilo agent permissions. |
| `.gitignore` | Excludes generated build artifacts (e.g. `tsconfig.tsbuildinfo`, `vite.config.js`). |

# Root Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Runs API and web in parallel via `concurrently`. |
| `npm run build` | Builds every workspace that defines a `build` script. |
| `npm run test` | Runs vitest in every workspace that defines a `test` script. |
| `npm run typecheck` | Runs `tsc --noEmit` across every workspace. |

# Cross-Workspace Dependencies

The web and API workspaces both depend on `@openvelo/types` to share the `IngredientCategory` and `BaseUnit` enums. See [Shared Types](/packages/types.md).
