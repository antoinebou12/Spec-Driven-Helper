import 'dotenv/config';
import { defineConfig } from '@playwright/test';

/**
 * Browser journeys run against an isolated stack: its own API/web/worker ports, a throwaway
 * database and a deterministic fake Ollama. Developers' running servers and data are untouched.
 */
const webPort = Number(process.env.E2E_WEB_PORT ?? 5174),
  apiPort = Number(process.env.E2E_API_PORT ?? 3101),
  ollamaPort = Number(process.env.E2E_OLLAMA_PORT ?? 11998);
// The `sdd_test_` prefix is the only namespace the store allows teardown to delete.
process.env.E2E_DATABASE ??= `sdd_test_e2e_${Date.now()}`;
export const e2eOwner = { email: 'e2e-owner@example.test', password: 'e2e-only-password-123' };

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalTeardown: './tests/e2e/teardown.ts',
  use: {
    baseURL: `http://localhost:${webPort}`,
    headless: true,
    channel: process.env.CI ? undefined : 'chrome',
    viewport: { width: 1440, height: 1000 },
    // Journeys check settled states (axe, colours), never a dialog or card mid-animation.
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: 'pnpm exec tsx tests/e2e/fake-ollama.ts',
      url: `http://127.0.0.1:${ollamaPort}/api/tags`,
      reuseExistingServer: false,
      env: { FAKE_OLLAMA_PORT: String(ollamaPort) },
    },
    {
      command: 'pnpm e2e:server',
      // Through the Vite proxy: ready only when both the web server and the API are up.
      url: `http://localhost:${webPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        HOST: '127.0.0.1',
        PORT: String(apiPort),
        WEB_PORT: String(webPort),
        API_URL: `http://127.0.0.1:${apiPort}`,
        APP_ORIGIN: `http://localhost:${webPort}`,
        DATABASE_NAMESPACE: process.env.E2E_DATABASE,
        OLLAMA_URL: `http://127.0.0.1:${ollamaPort}`,
        BOOTSTRAP_EMAIL: e2eOwner.email,
        BOOTSTRAP_PASSWORD: e2eOwner.password,
        ENCRYPTION_KEY: 'e'.repeat(64),
        AGENT_RUNNER_URL: '',
        LOG_LEVEL: 'warn',
        // Every journey shares 127.0.0.1; the production default (300/min) would throttle the suite.
        RATE_LIMIT_MAX: '5000',
      },
    },
  ],
});
