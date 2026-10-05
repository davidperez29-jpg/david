#!/bin/sh
# All-in-one start for managed hosts (Render, docs/DEPLOY_RENDER.md). Idempotent on every start:
# migrations → reference catalogues → first administrator → optional demo data → web server.
set -e
cd /app/packages/db
node node_modules/tsx/dist/cli.mjs scripts/migrate.ts
node node_modules/tsx/dist/cli.mjs scripts/seed.ts
cd /app/packages/application
node node_modules/tsx/dist/cli.mjs scripts/bootstrap.ts
if [ "$DEMO_DATA" = "true" ]; then
  # Demo users share the administrator's password: nothing public is ever valid online.
  DEMO_IF_EMPTY=1 DEMO_PASSWORD="${DEMO_PASSWORD:-$ADMIN_PASSWORD}" \
    node node_modules/tsx/dist/cli.mjs scripts/seed-demo.ts \
    || echo "Demo data could not be loaded (see above); the app starts anyway."
fi
cd /app/apps/web/.next/standalone
exec node apps/web/server.js
