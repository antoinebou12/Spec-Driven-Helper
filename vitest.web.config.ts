import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Frontend component tests (jsdom). Run with `pnpm exec vitest run --config vitest.web.config.ts`. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['apps/web/src/**/*.test.tsx'],
    setupFiles: ['apps/web/src/test/setup.ts'],
    css: false,
    // CopilotKit's bundle imports its own stylesheet; let Vite handle it instead of Node's loader.
    server: { deps: { inline: [/@copilotkit/] } },
    // `pnpm test:coverage:web`: components are unit-tested here; views are covered by Playwright journeys.
    coverage: {
      provider: 'v8',
      include: ['apps/web/src/components/**/*.tsx', 'apps/web/src/*.{ts,tsx}', 'apps/web/src/views/Login.tsx'],
      // The shell and the Monaco editor only run in a real browser (Playwright journeys).
      exclude: ['**/*.stories.tsx', '**/*.test.tsx', 'apps/web/src/test/**', 'apps/web/src/main.tsx', 'apps/web/src/App.tsx', 'apps/web/src/monaco.ts', 'apps/web/src/components/Editors.tsx'],
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage/web',
      thresholds: { statements: 80, branches: 80, functions: 68, lines: 80 },
    },
  },
});
