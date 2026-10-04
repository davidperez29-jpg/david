# Production images (docs/OPERATIONS.md).
# - target `web` (default): the self-contained Next.js server only (no dev dependencies).
# - target `jobs`: the whole workspace, for migrations, catalogues and the daily jobs.
# Stateless: everything lives in PostgreSQL; uploaded images in object storage (S3-compatible) or
# FILE_STORAGE_DIR.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
# Optional extra CA bundle for TLS-intercepting proxies: --secret id=ca,src=/path/ca.pem
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile && NEXT_OUTPUT=standalone pnpm build

FROM base AS jobs
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/packages/db
CMD ["node", "node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"]

FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# Uploaded images when no object storage is configured (shared volume with several replicas).
RUN mkdir -p /data/files && chown node:node /data/files
ENV FILE_STORAGE_DIR=/data/files
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Plain node at runtime: nothing is downloaded when the container starts.
CMD ["node", "apps/web/server.js"]
