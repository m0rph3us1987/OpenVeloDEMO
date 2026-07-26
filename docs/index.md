---
okf_version: "0.1"
---

# Overview

OpenVelo is a meal-planning application composed of an Express API, a React web client, and a shared types package. These documents describe the architecture, data model, and user-facing flows for the current build. The Recipes API performs a transactional cleanup of `MealPlanSlot`, `CookLog`, `CartSnapshot`, and `RecipeIngredient` dependents when a recipe is deleted, returning `409 REFERENCED_BY_OTHER_RECORD` on leftover foreign-key conflicts. The web Recipes Page renders API error messages as `<error> (<code>)` so testers can see the stable error code inline. The Dashboard now drives the [Plan API](/api/plan.md) for adding, editing, marking cooked, and deleting weekly planned slots; the [Cart Recompute](/architecture/cart-recompute.md) pipeline re-aggregates the auto `CartItem` rows for the active ISO week after every plan mutation.

# Architecture

* [Monorepo Layout](/architecture/monorepo.md) - Workspaces, root scripts, and cross-workspace dependencies.
* [API Server](/architecture/api-server.md) - Express bootstrap, middleware order, and environment variables.
* [Database Bootstrap](/architecture/db-bootstrap.md) - Idempotent script that creates the SQLite database, applies the Prisma schema, and seeds demo ingredients on every API startup.
* [Cart Recompute](/architecture/cart-recompute.md) - Auto `CartItem` aggregation that runs after every Plan API mutation.
* [Web Application](/architecture/web-app.md) - React bootstrap, routing, state management, and styling tokens.

# API

* [Health Endpoint](/api/health.md) - `GET /api/health` liveness check.
* [Ingredients API](/api/ingredients.md) - Ingredient listing, creation, updates, deletion, validation, and error contracts.
* [Recipes API](/api/recipes.md) - Recipe listing, creation, updates, deletion, ingredient rows, and error contracts.
* [Plan API](/api/plan.md) - Weekly meal-plan CRUD, stats, and the `/cooked` endpoint.

# Database

* [Prisma Schema](/database/schema.md) - Models for ingredients, recipes, meal plans, cook logs, shopping cart snapshots, and the auto `CartItem` table.

# Web

* [Dashboard Page](/web/dashboard.md) - Weekly meal-planner UI: seven-day grid, add/edit/delete dialogs, cook tracking, and per-recipe summary.
* [Ingredients Page](/web/ingredients.md) - Tester workflow and technical wiring for filtering and managing ingredients.
* [Recipes Page](/web/recipes.md) - Tester workflow and technical wiring for managing recipes and their ingredient rows.
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