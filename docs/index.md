---
okf_version: "0.1"
---

# Overview

OpenVelo is a meal-planning application composed of an Express API, a React web client, and a shared types package. These documents describe the architecture, data model, and user-facing flows for the current build.

# Architecture

* [Monorepo Layout](/architecture/monorepo.md) - Workspaces, root scripts, and cross-workspace dependencies.
* [API Server](/architecture/api-server.md) - Express bootstrap, middleware order, and environment variables.
* [Web Application](/architecture/web-app.md) - React bootstrap, routing, state management, and styling tokens.

# API

* [Health Endpoint](/api/health.md) - `GET /api/health` liveness check.
* [Ingredients API](/api/ingredients.md) - Ingredient listing, creation, updates, deletion, validation, and error contracts.

# Database

* [Prisma Schema](/database/schema.md) - Models for ingredients, recipes, meal plans, cook logs, and shopping cart snapshots.

# Web
* [Ingredients Page](/web/ingredients.md) - Tester workflow and technical wiring for filtering and managing ingredients.
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
