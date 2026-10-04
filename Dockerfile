# Production image (Phase 15, docs/OPERATIONS.md). One image runs the web app and, with another
# command, the migrations and the daily jobs. Stateless: everything lives in PostgreSQL, except
# uploaded images (FILE_STORAGE_DIR, a shared volume when there are several replicas).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
# Optional extra CA bundle for TLS-intercepting proxies: --secret id=ca,src=/path/ca.pem
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile && pnpm build

FROM base AS run
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /app /app
# Uploaded images (mount a shared volume here when running several replicas).
RUN mkdir -p /data/files && chown node:node /data/files
ENV FILE_STORAGE_DIR=/data/files
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Plain node at runtime: nothing is downloaded when the container starts.
WORKDIR /app/apps/web
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
