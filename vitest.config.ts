import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // PostgreSQL from DATABASE_URL, or a Testcontainers PostgreSQL + pgvector when it is not set.
    globalSetup: ['tests/setup/postgres-container.ts'],
    // ArchUnitTS registers its Vitest matcher on import and needs the global `expect`.
    globals: true,
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
    // `pnpm test:coverage`: backend, shared domain and services. Thresholds are floors, raise them as coverage grows.
    coverage: {
      provider: 'v8',
      include: ['apps/api/src/**/*.ts', 'packages/shared/src/**/*.ts', 'apps/agent-runner/src/**/*.ts', 'apps/publisher/src/**/*.ts'],
      // Entry points only wire real timers, signals and servers; their logic lives in tested modules (worker-loop.ts).
      exclude: ['**/*.d.ts', 'apps/api/src/index.ts', 'apps/api/src/worker.ts'],
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage/backend',
      thresholds: { statements: 90, branches: 80, functions: 92, lines: 90 },
    },
  },
});
