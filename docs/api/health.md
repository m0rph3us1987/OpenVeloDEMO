---
type: API
title: Health Endpoint
description: Liveness endpoint exposed by the API at `GET /api/health`.
tags: [api, health, endpoint]
timestamp: 2026-07-26T11:39:07Z
---

# Endpoint

| Method | Path | Auth | CORS |
|--------|------|------|------|
| `GET` | `/api/health` | None | Origin restricted to `WEB_ORIGIN` (default `http://localhost:5173`). |

# Response

```json
{ "ok": true }
```

| Status | When |
|--------|------|
| `200 OK` | Always. |

# Example

```bash
curl http://localhost:3001/api/health
# {"ok":true}
```

# Implementation

Defined in `apps/api/src/app.ts` as:

```ts
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});
```

# Tests

`apps/api/tests/health.test.ts` uses `supertest` against `createApp()` to assert the response body and status. The test does not bind a port, so it cannot run in parallel with `npm run dev` on the same machine.
