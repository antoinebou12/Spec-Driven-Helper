# syntax=docker/dockerfile:1
# Frontend image: the built React client served by unprivileged nginx, proxying /api to the backend.
# Build from the repository root: docker build -f docker/web.Dockerfile -t sdd-studio-web .
# Run with API_UPSTREAM=http://api:3001 (default).

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV DO_NOT_TRACK=1 COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/agent-runner/package.json ./apps/agent-runner/package.json
COPY apps/publisher/package.json ./apps/publisher/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts ./
COPY apps/web ./apps/web
COPY packages ./packages
# Documentation website sources (served at /docs/).
COPY README.md PRODUCT.md DESIGN.md AGENTS.md ./
COPY docs ./docs
COPY fixtures/README.md ./fixtures/README.md
COPY scripts/build-docs-site.ts ./scripts/build-docs-site.ts
RUN pnpm exec vite build && DOCS_LINK_CHECK=warn pnpm exec tsx scripts/build-docs-site.ts

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ENV API_UPSTREAM=http://api:3001
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/web /usr/share/nginx/html
COPY --from=build /app/dist/docs-site /usr/share/nginx/html/docs
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
