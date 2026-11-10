# syntax=docker/dockerfile:1
# Backend image: Fastify API and the durable worker (same image, different command).
# Build from the repository root: docker build -f docker/api.Dockerfile -t sdd-studio-api .

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV DO_NOT_TRACK=1 OPENUI_TELEMETRY_DISABLED=1 COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/agent-runner/package.json ./apps/agent-runner/package.json
COPY apps/publisher/package.json ./apps/publisher/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY apps/api ./apps/api
COPY packages ./packages
COPY scripts ./scripts
# Type-check the server before shipping it.
RUN pnpm exec tsc --noEmit -p tsconfig.json || (echo "Type check failed" && exit 1)
RUN pnpm remove -Dw @fission-ai/openspec --ignore-scripts

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production DO_NOT_TRACK=1 OPENUI_TELEMETRY_DISABLED=1 COREPACK_HOME=/opt/corepack HOST=0.0.0.0 PORT=3001
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /opt/corepack /opt/corepack
RUN corepack enable && chmod -R a+rX /opt/corepack
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api ./apps/api
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/scripts ./scripts
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
# The image holds only the backend slice of the workspace, so run tsx directly (pnpm scripts
# would try to reinstall the missing frontend package). Worker: override the command with
# ["/app/node_modules/.bin/tsx", "apps/api/src/worker.ts"].
CMD ["/app/node_modules/.bin/tsx", "apps/api/src/index.ts"]
