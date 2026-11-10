# syntax=docker/dockerfile:1

# ---- build: install the workspace, type-check and bundle the web client ----
FROM node:24-bookworm-slim AS build
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
COPY . .
# The docs link check needs files the build context leaves out (.plan/); CI runs it strictly.
RUN DOCS_LINK_CHECK=warn pnpm build
# Repository-only CLI must not be copied into the runtime stage.
RUN pnpm remove -Dw @fission-ai/openspec --ignore-scripts

# ---- runtime: API, worker and static client; runs as the unprivileged node user ----
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production DO_NOT_TRACK=1 OPENUI_TELEMETRY_DISABLED=1 COREPACK_HOME=/opt/corepack HOST=0.0.0.0 PORT=3001
# git is required for repository import and publishing; tini reaps git child processes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
# pnpm is prepared into a shared COREPACK_HOME so the node user can run it without network access.
COPY --from=build /opt/corepack /opt/corepack
RUN corepack enable && chmod -R a+rX /opt/corepack
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/.runtime && chown node:node /app/.runtime
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["pnpm", "start"]
