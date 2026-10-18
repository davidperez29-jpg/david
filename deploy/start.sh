#!/bin/sh
# All-in-one start for managed hosts (Render, docs/DEPLOY_RENDER.md). Idempotent on every start:
# migrations → reference catalogues → legacy text encryption → first administrator → optional
# demo data → web server.
set -e
cd /app/packages/db
# Restructure phase 22: a free instance starts from scratch every time it wakes up. The setup
# runs once per release and set of start-up settings; waking up again skips it.
if node scripts/startup-gate.mjs check; then
  :
else
  node node_modules/tsx/dist/cli.mjs scripts/migrate.ts
  node node_modules/tsx/dist/cli.mjs scripts/seed.ts
  cd /app/packages/application
  # Restructure phases 11, 20 and 21: legacy injury text is encrypted; its old columns are marked
  # with this release (RENDER_GIT_COMMIT on Render, or APP_VERSION) and dropped when a different
  # release starts. Without a release id nothing is marked or dropped (idempotent).
  node node_modules/tsx/dist/cli.mjs scripts/encrypt-injury-text.ts
  node node_modules/tsx/dist/cli.mjs scripts/bootstrap.ts
  setup_ok=1
  if [ "$DEMO_DATA" = "true" ]; then
    # Demo users share the administrator's password: nothing public is ever valid online.
    DEMO_IF_EMPTY=1 DEMO_PASSWORD="${DEMO_PASSWORD:-$ADMIN_PASSWORD}" \
      node node_modules/tsx/dist/cli.mjs scripts/seed-demo.ts \
      || { setup_ok=0; echo "Demo data could not be loaded (see above); the app starts anyway."; }
  fi
  # Recorded only when everything worked, so a failed demo load is tried again on the next start.
  if [ "$setup_ok" = 1 ]; then
    cd /app/packages/db
    node scripts/startup-gate.mjs done || true
  fi
fi
cd /app/apps/web/.next/standalone
exec node apps/web/server.js
