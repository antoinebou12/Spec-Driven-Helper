import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { setupApp, type Harness } from './helpers';

import { filesOfProject, projectRoot } from './arch/rules';

/**
 * Project-specific architecture checks. File dependencies, cycles, naming, size budgets and the
 * slice diagram are enforced with ArchUnitTS in tests/archunit.test.ts; this file keeps what that
 * library cannot express: bans on external packages, feature registration, view reachability and
 * the route security sweep.
 */
const read = (file: string) => readFileSync(join(projectRoot, file), 'utf8');
const production = /\.(test|stories)\.tsx?$|\/test\//;

describe('package boundaries', () => {
  it('keeps the shared domain free of I/O and frameworks', () => {
    expect(filesOfProject().inFolder('packages/shared').shouldNot().importPackagesMatching(/^(node:|fs$|path$|child_process$|fastify|@fastify\/|pg$|react|@radix-ui|monaco)/).check()).toEqual([]);
  });

  it('keeps Node built-ins and server packages out of the web client', () => {
    const web = filesOfProject().inFolder('apps/web/src').excluding(production);
    expect(web.shouldNot().importPackagesMatching(/^(node:|fastify|pg$)/).check()).toEqual([]);
  });

  it('keeps React out of the API', () => {
    expect(filesOfProject().inFolder('apps/api/src').shouldNot().importPackagesMatching(/^react(-dom)?$/).check()).toEqual([]);
  });

  it('lets only the storage modules talk to the database drivers', () => {
    const rule = filesOfProject().inFolder('apps/api/src').excluding(/\/(db|postgres)\.ts$/).shouldNot().importPackagesMatching(/^pg$/);
    expect(rule.check()).toEqual([]);
  });
});

describe('naming and structure', () => {
  it('names test files *.test.ts', () => {
    const tests = filesOfProject().matchingPattern(/^tests\/[^/]+\.ts$/).excluding(/helpers\.ts$/);
    expect(tests.should().haveNameMatching(/^[a-z][a-z0-9-]*\.test\.ts$/).check()).toEqual([]);
  });

  it('registers every API feature module in the application', () => {
    const app = read('apps/api/src/app.ts');
    const modules = filesOfProject().inFolder('apps/api/src').files();
    const registrations = modules.flatMap((f) => [...read(f).matchAll(/export async function (register\w+)\(/g)].map((m) => [f, m[1]] as const));
    expect(registrations.length).toBeGreaterThan(10);
    expect(registrations.filter(([, name]) => !app.includes(`await ${name}(`)).map(([f, name]) => `${f}: ${name}`)).toEqual([]);
  });

  it('makes every view reachable: lazily loaded by the app or embedded by another view', () => {
    const app = read('apps/web/src/App.tsx');
    const views = filesOfProject()
      .inFolder('apps/web/src/views')
      .files()
      .filter((f) => !/\.(test|stories)\.tsx?$/.test(f));
    const embedded = (name: string) => views.some((v) => read(v).includes(`from './${name}'`) || read(v).includes(`import('./${name}')`));
    const unreachable = views.map((f) => basename(f, '.tsx')).filter((name) => !app.includes(`import('./views/${name}')`) && !app.includes(`from './views/${name}'`) && !embedded(name));
    expect(unreachable).toEqual([]);
  });
});

describe('route security sweep', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('architecture');
  });
  afterAll(async () => h?.teardown());

  /** Routes that must work without a session (sign-in, health, public docs and callbacks). */
  const publicRoutes = new Set([
    'GET /api/health',
    'GET /api/health/live',
    // Metrics use their own bearer token or a local request instead of a session.
    'GET /api/metrics',
    'GET /api/v1/auth/options',
    'POST /api/v1/auth/login',
    'POST /api/v1/auth/logout',
    'POST /api/v1/auth/signup',
    'POST /api/v1/auth/accept-invite',
    'GET /api/v1/auth/oidc',
    'GET /api/v1/auth/oidc/callback',
    'GET /api/v1/auth/google',
    'GET /api/v1/auth/google/callback',
    // AI optimisation: public product description and crawler rules (no project data).
    'GET /llms.txt',
    'GET /llms-full.txt',
    'GET /robots.txt',
    'GET /sitemap.xml',
  ]);

  it('lists only public routes that exist', () => {
    const routes = new Set((h.app as unknown as { apiRoutes: { method: string; url: string }[] }).apiRoutes.map((r) => `${r.method} ${r.url.replace(/:(\w+)/g, '{$1}')}`));
    expect([...publicRoutes].filter((r) => !routes.has(r))).toEqual([]);
  });

  it('answers 401 or 403 without a session on every non-public route', async () => {
    const routes = (h.app as unknown as { apiRoutes: { method: string; url: string }[] }).apiRoutes;
    const failures: string[] = [];
    for (const { method, url } of routes) {
      const key = `${method} ${url.replace(/:(\w+)/g, '{$1}')}`;
      if (publicRoutes.has(key) || url.startsWith('/api/docs') || method === 'HEAD') continue;
      const path = url.replace(/:(\w+)/g, '00000000-0000-4000-8000-000000000000');
      const res = await h.app.inject({ method: method as never, url: path, payload: ['POST', 'PUT', 'PATCH'].includes(method) ? {} : undefined });
      // The MCP endpoint answers 405 to GET by protocol and 401 to POST without a token.
      if (key === 'GET /api/v1/mcp' && res.statusCode === 405) continue;
      if (![401, 403].includes(res.statusCode)) failures.push(`${key} → ${res.statusCode}`);
    }
    expect(failures).toEqual([]);
  });
});
