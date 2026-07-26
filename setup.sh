#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
cd /repo
npm ci
cd /repo/apps/api
npx prisma generate

# Ensure the SQLite database exists, has the current schema, and is seeded
# with demo ingredients. The helper defaults to /data/openvelo/dev.db when
# DATABASE_URL is not set, which absorbs the persistent named volume mounted
# across jobs/containers.
node scripts/ensure-db.mjs
