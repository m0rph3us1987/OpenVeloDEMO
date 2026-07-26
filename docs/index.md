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

# Database

* [Prisma Schema](/database/schema.md) - Models for ingredients, recipes, meal plans, cook logs, and shopping cart snapshots.

# Web

* [Layout Component](/web/layout.md) - Responsive persistent sidebar navigation, theme toggle, and content outlet.
* [Theme Store](/web/theme-store.md) - Zustand store with persistence and OS preference fallback.
* [Focus Ring Design Token](/web/focus-ring.md) - Shared `ring-ring` focus-visible style and `--ring` CSS variable.

# Shared Packages

* [Shared Types](/packages/types.md) - `@openvelo/types` constants and enums.

# Guides

* [Running the App Locally](/guides/local-setup.md) - Install, configure the database, and run dev/test/typecheck.
* [Tester Walkthrough](/guides/tester-walkthrough.md) - Navigation steps and expected UI behavior for each route.
