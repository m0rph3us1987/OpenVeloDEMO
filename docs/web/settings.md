---
type: Page
title: Settings Page
description: Workspace information and a destructive "Clear all data" action that wipes user-managed records and re-seeds the demo set via the Admin API.
tags: [web, settings, page, reset, admin]
timestamp: 2026-07-26T19:12:38Z
---

# Source

`apps/web/src/pages/Settings.tsx`. Registered as the `/settings` route in `apps/web/src/App.tsx` and rendered through the `<Outlet />` of the [Layout Component](/web/layout.md).

# Integration

The page is a leaf consumer of the [Admin API](/api/admin.md). It uses `@tanstack/react-query`'s `useMutation` to call `POST /api/admin/reset`, then invalidates every cached query (`ingredients`, `recipes`, `plan`, `stats`, `cart`, `cart-weeks`) so the rest of the app re-reads its freshest data after the reset.

# Render Tree

```text
<section aria-labelledby="settings-heading">
  <header>
    <h2 id="settings-heading">Settings</h2>
    <p>Application information and data management.</p>
  </header>

  <div class="bordered card">
    <h3>About OpenVelo</h3>
    <p>OpenVelo is a meal-planning workspace for tracking recipes,
       ingredients, weekly plans, cook history, and a derived shopping cart.</p>
    <p class="muted">Version 0.1.0</p>
  </div>

  <div class="bordered card">
    <h3>Data</h3>
    <p>Reset the workspace to its original demo state. …</p>
    <Button variant="outline" aria-haspopup="dialog">Clear all data</Button>
    {successMessage && <p role="status" aria-live="polite">{successMessage}</p>}
  </div>

  {modalOpen && <ConfirmModal … />}
</section>
```

# Visual Elements

| Element | Selector / Role | Notes |
|---------|-----------------|-------|
| Page heading | `h2#settings-heading` | Text: `Settings`. |
| About card | Static text block | Names the product and displays `Version 0.1.0`. |
| Data card | Static text block | Explains the destructive action. |
| `Clear all data` button | `Button` with `aria-haspopup="dialog"` | Opens the confirmation modal. |
| Success message | `p[role="status"][aria-live="polite"]` | Green confirmation. Auto-clears after 3 seconds. |
| `ConfirmModal` | `div[role="dialog"][aria-modal="true"]` | Modal overlay with title, body, error region, and `Cancel` / `Clear all data` actions. |
| Modal error region | `p[role="alert"][aria-live="polite"]` | Red text shown when the reset request fails. |

# Confirmation Modal

The modal is a controlled component rendered while `modalOpen` is true. It listens for `Escape` to cancel (ignored while the request is pending) and renders:

| Element | Text | Behavior |
|---------|------|----------|
| Heading | `Clear all data?` | Identifies the dialog via `aria-labelledby`. |
| Body | `This will erase all recipes, ingredients, planned meals, cook history, and shopping cart, and re-seed the demo data.` | Explains the destructive effect. |
| `Cancel` button | `Cancel` | Closes the modal and clears any prior error. |
| Primary button | `Clear all data` / `Clearing…` while pending | Triggers the reset mutation. Has `aria-label="Clear all data"`. |

# User Flow

1. Click `Settings` in the sidebar (or navigate to `/settings`).
2. Read the `About OpenVelo` and `Data` cards.
3. Click `Clear all data` to open the confirmation modal.
4. Click `Clear all data` in the modal to confirm, or `Cancel` to close it.
5. While the request is pending, the primary button label becomes `Clearing…` and both modal buttons are disabled.
6. On success the modal closes, the success message `All data cleared and reseeded with the demo set.` appears in green, and the cached queries for ingredients, recipes, plan, stats, cart, and cart history are invalidated. The success message auto-clears after 3 seconds.
7. On failure the modal stays open and shows a red error string under the body text. Cancel and retry, or fix the underlying issue and click `Clear all data` again.

# UX Guardrails

- **Destructive confirmation** — the reset is gated by a modal so a stray click cannot wipe the workspace.
- **Pending guard** — both modal buttons disable while the request is in flight, and `Escape` is ignored during the request.
- **Automatic refresh** — every TanStack Query key used by the rest of the app is invalidated on success, so navigating away and back displays the reseeded data without a manual reload.
- **Live region** — both the success and error messages use `aria-live="polite"` so screen readers announce the outcome.

# Key Files

| File | Responsibility |
|------|----------------|
| `apps/web/src/pages/Settings.tsx` | Page component, modal, mutation, and query invalidation. |
| `apps/web/src/App.tsx` | Registers the `/settings` route. |
| `apps/web/src/components/Layout.tsx` | Adds `Settings` to the sidebar `NAV_ITEMS`. |
| `apps/web/src/components/ui/button.tsx` | Variants (`outline`, default) used by the trigger and confirm buttons. |
| `apps/api/src/admin.ts` | Backs the reset request. See [Admin API](/api/admin.md). |
| `apps/web/tests/Settings.test.tsx` | Confirms the modal flow, mutation call, and cache invalidation. |

# Related

- [Admin API](/api/admin.md) — server contract invoked by the page.
- [Seed Data](/architecture/seed-data.md) — demo set that the reset re-applies.
- [Layout Component](/web/layout.md) — sidebar entry that links to `/settings`.
- [Tester Walkthrough](/guides/tester-walkthrough.md) — verification steps for the settings flow.
