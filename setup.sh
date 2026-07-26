#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
cd /repo
npm ci
cd /repo/apps/api
npx prisma generate