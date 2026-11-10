FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
ENV DO_NOT_TRACK=1 OPENUI_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.23.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm remove -Dw @fission-ai/openspec --ignore-scripts
USER pwuser
# Started without pnpm: Corepack would download pnpm again for pwuser, and the publisher needs no network.
CMD ["node","node_modules/tsx/dist/cli.mjs","apps/publisher/src/index.ts"]
