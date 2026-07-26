---
okf_version: "0.1"
---

# Overview

OpenVelo is a meal-planning application composed of an Express API, a React web client, and a shared types package. These documents describe the architecture, data model, and user-facing flows for the current build. The Dashboard drives the [Plan API](/api/plan.md) for weekly planning and cooking history; plan mutations feed the [Cart Recompute](/architecture/cart-recompute.md) pipeline. The [Shopping Cart API](/api/cart.md) and [Shopping Cart Page](/web/shopping-cart.md) combine plan-derived totals with editable current-week manual lines and frozen read-only history.

# Architecture

* [Monorepo Layout](/architecture/monorepo.md) - Workspaces, root scripts, and cross-workspace dependencies.
* [API Server](/architecture/api-server.md) - Express bootstrap, middleware order, and environment variables.
* [Database Bootstrap](/architecture/db-bootstrap.md) - Idempotent script that creates the SQLite database, applies the Prisma schema, and seeds demo ingredients on every API startup.
* [Seed Data](/architecture/seed-data.md) - Idempotent TypeScript seed that populates 13 demo ingredients and 4 demo recipes and is invoked on startup and after an admin reset.
* [Cart Recompute](/architecture/cart-recompute.md) - Shared base-unit aggregation for persisted auto cart rows and live cart reads.
* [Web Application](/architecture/web-app.md) - React bootstrap, routing, state management, and styling tokens.

# API

* [Health Endpoint](/api/health.md) - `GET /api/health` liveness check.
* [Ingredients API](/api/ingredients.md) - Ingredient listing, creation, updates, deletion, validation, and error contracts.
* [Recipes API](/api/recipes.md) - Recipe listing, creation, updates, deletion, ingredient rows, and error contracts.
* [Plan API](/api/plan.md) - Weekly meal-plan CRUD, the week-scoped `/api/plan/stats` and global `/api/stats` summaries, and the `/cooked` endpoint.
* [Shopping Cart API](/api/cart.md) - Current and historical weekly carts plus current-week manual-line CRUD.
* [Admin API](/api/admin.md) - Destructive `POST /api/admin/reset` that clears every user-managed table and re-seeds the demo data.

# Database

* [Prisma Schema](/database/schema.md) - Models for ingredients, recipes, meal plans, cook logs, live cart items, recipe snapshots, and frozen weekly cart history.

# Web

* [Dashboard Page](/web/dashboard.md) - Weekly meal-planner UI: seven-day grid, working pre-filled edit dialog, add/delete dialogs, cook tracking, and per-recipe summary.
* [Ingredients Page](/web/ingredients.md) - Tester workflow and technical wiring for filtering and managing ingredients.
* [Recipes Page](/web/recipes.md) - Tester workflow and technical wiring for managing recipes and their ingredient rows.
* [Shopping Cart Page](/web/shopping-cart.md) - Grouped weekly cart, current-week manual lines, and read-only historical snapshots.
* [Settings Page](/web/settings.md) - Workspace information card and the destructive `Clear all data` action that triggers the admin reset.
* [Layout Component](/web/layout.md) - Responsive persistent sidebar navigation (NavLink), theme toggle, and content outlet.
* [NotFound Page](/web/not-found.md) - Wildcard fallback page rendered for any unmatched route.
* [RouterErrorElement](/web/router-error-element.md) - Root route error boundary for thrown 404 responses and unexpected errors.
* [Theme Store](/web/theme-store.md) - Zustand store with persistence and OS preference fallback.
* [Focus Ring Design Token](/web/focus-ring.md) - Shared `ring-ring` focus-visible style and `--ring` CSS variable.

# Shared Packages

* [Shared Types](/packages/types.md) - `@openvelo/types` constants and enums.

# Guides

* [Running the App Locally](/guides/local-setup.md) - Install, configure the database, and run dev/test/typecheck.
* [Tester Walkthrough](/guides/tester-walkthrough.md) - Navigation steps and expected UI behavior for each route.