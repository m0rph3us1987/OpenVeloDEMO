---
type: Component
title: RouterErrorElement
description: React Router error boundary used as the root route's `errorElement` — handles thrown route errors including 404 responses and unexpected exceptions.
tags: [web, routing, error-boundary]
timestamp: 2026-07-26T12:03:52Z
---

# Source

`apps/web/src/components/RouterErrorElement.tsx`. Registered as `errorElement` on the root layout route in `apps/web/src/App.tsx`.

# Purpose

`RouterErrorElement` is the single error boundary that catches anything thrown while the router is matching or rendering a route. It uses `useRouteError()` to inspect the error and renders one of three messages:

| Condition | Heading | Body |
|-----------|---------|------|
| `isRouteErrorResponse(error)` and `error.status === 404` | `Page not found` | `The page you are looking for does not exist.` |
| `isRouteErrorResponse(error)` (any other status) | `Unexpected Application Error` | `{error.status} {error.statusText}` |
| `error instanceof Error` | `Unexpected Application Error` | `error.message` |
| Anything else | `Unexpected Application Error` | `Something went wrong.` |

Every branch ends with a `Back to Dashboard` link to `/` so the user always has a recovery path.

# Relationship with NotFound

The router is configured with **two** 404 surfaces:

1. `NotFound` (`/pages/NotFound.tsx`) — handles *unmatched* routes via the wildcard child path `*`.
2. `RouterErrorElement` — handles *thrown* `404` responses, e.g. when a loader or component explicitly calls `throw new Response(..., { status: 404 })`.

Because the `errorElement` is set on the root layout, the sidebar remains visible in both cases. The error UI replaces only the `<Outlet />` content.

# Wiring

```ts
{
  path: '/',
  element: <Layout />,
  errorElement: <RouterErrorElement />,   // <-- this component
  children: [ ... ],
}
```

Test coverage lives in `apps/web/tests/layout.test.tsx`, which mounts the layout with `errorElement={<RouterErrorElement />}` and a wildcard child route to verify both surfaces.

# Related

- [NotFound Page](/web/not-found.md) — handles unmatched routes synchronously.
- [Layout Component](/web/layout.md) — the parent route this element wraps.
- [Web Application](/architecture/web-app.md) — full route table.
