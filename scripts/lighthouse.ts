import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Lighthouse on the production build, for the public sign-in page and signed-in views.
 * Chrome is started by Playwright (the Chrome launcher Lighthouse ships with fails to clean up on
 * Windows), the owner signs in, and Lighthouse audits through the same browser so cookies apply.
 *
 * Needs `pnpm build` and a PostgreSQL DATABASE_URL (a throwaway namespace is used). Budgets below
 * fail the run; HTML and JSON reports go to lighthouse-report/.
 */
const port = Number(process.env.LIGHTHOUSE_PORT ?? 3151);
const origin = `http://127.0.0.1:${port}`;
const owner = { email: 'lighthouse-owner@example.test', password: 'lighthouse-only-password-123' };
const budgets = { performance: 0.85, accessibility: 0.95, 'best-practices': 0.9, seo: 0.8 } as const;
const metricBudgets = { 'largest-contentful-paint': 2500, 'cumulative-layout-shift': 0.1, 'total-blocking-time': 300 } as const;

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a PostgreSQL database');
// Lighthouse is installed with @lhci/cli; resolve it from there instead of adding a second copy.
const lhciRequire = createRequire(createRequire(import.meta.url).resolve('@lhci/cli/package.json'));
const { default: lighthouse, desktopConfig } = (await import(pathToFileURL(lhciRequire.resolve('lighthouse')).href)) as any;
const desktop = desktopConfig ?? (await import(pathToFileURL(join(dirname(lhciRequire.resolve('lighthouse')), 'config', 'desktop-config.js')).href)).default;

const namespace = `sdd_test_lighthouse_${Date.now()}`;
const server = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/index.ts'], {
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    APP_ORIGIN: origin,
    DATABASE_NAMESPACE: namespace,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? 'c'.repeat(64),
    BOOTSTRAP_EMAIL: owner.email,
    BOOTSTRAP_PASSWORD: owner.password,
    LOG_LEVEL: 'warn',
    RATE_LIMIT_MAX: '5000',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const stop = async () => {
  server.kill();
  process.env.DATABASE_NAMESPACE = namespace;
  process.env.DATABASE_NAMESPACE = namespace;
  const { client, db } = await import('../apps/api/src/db');
  await client.connect();
  await db.dropDatabase().catch(() => {});
  await client.close();
};

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not start');
}

let failed = false;
const profile = mkdtempSync(join(tmpdir(), 'sdd-lighthouse-'));
try {
  await waitForServer();
  const debugPort = 9333;
  const browser = await chromium.launchPersistentContext(profile, { headless: true, args: [`--remote-debugging-port=${debugPort}`] });
  const page = browser.pages()[0] ?? (await browser.newPage());
  await page.addInitScript(() => localStorage.setItem('sdd-tour-done', 'true'));

  const audit = async (name: string, url: string) => {
    const result = await lighthouse(url, { port: debugPort, output: ['html', 'json'], logLevel: 'error', onlyCategories: Object.keys(budgets) }, desktop);
    const lhr = result.lhr;
    mkdirSync('lighthouse-report', { recursive: true });
    writeFileSync(`lighthouse-report/${name}.html`, result.report[0]);
    writeFileSync(`lighthouse-report/${name}.json`, result.report[1]);
    const lines: string[] = [];
    for (const [category, min] of Object.entries(budgets)) {
      const score = lhr.categories[category]?.score ?? 0;
      const ok = score >= min;
      failed ||= !ok;
      lines.push(`${ok ? 'ok  ' : 'FAIL'} ${category.padEnd(15)} ${Math.round(score * 100)} (min ${Math.round(min * 100)})`);
    }
    for (const [id, max] of Object.entries(metricBudgets)) {
      const value = lhr.audits[id]?.numericValue ?? 0;
      const ok = value <= max;
      failed ||= !ok;
      lines.push(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(26)} ${value < 1 ? value.toFixed(3) : Math.round(value)} (max ${max})`);
    }
    const failing = Object.values(lhr.audits as Record<string, any>)
      .filter((a) => a.score !== null && a.score < 0.9 && ['binary', 'numeric'].includes(a.scoreDisplayMode) && lhr.categories.accessibility.auditRefs.some((r: any) => r.id === a.id))
      .map((a) => `     accessibility: ${a.id} — ${a.title}`);
    console.log(`\n${name} (${url})\n${[...lines, ...failing].join('\n')}`);
  };

  await audit('sign-in', `${origin}/`);
  await page.goto(`${origin}/`);
  await page.getByLabel('Email address').fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('navigation', { name: 'Project views' }).waitFor();
  const created = await page.evaluate(async () => {
    const r = await fetch('/api/v1/projects', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Lighthouse', sample: true }) });
    return (await r.json()) as { id: string };
  });
  for (const view of ['overview', 'specification', 'board'])
    await audit(view, `${origin}/#/p/${created.id}/${view}`);
  await browser.close();
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await stop();
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}
console.log(failed ? '\nLighthouse budgets: FAILED (reports in lighthouse-report/)' : '\nLighthouse budgets: all met (reports in lighthouse-report/)');
process.exit(failed ? 1 : 0);
