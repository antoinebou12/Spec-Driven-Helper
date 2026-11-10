import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  effectiveFeatures,
  featureFlags,
  featureForRequest,
  hiddenViews,
} from '../packages/shared/src/feature-flags';
import { setupApp, type Harness } from './helpers';

describe('feature flag catalog', () => {
  it('has unique ids, bilingual text and defaults', () => {
    expect(new Set(featureFlags.map((f) => f.id)).size).toBe(featureFlags.length);
    for (const f of featureFlags)
      expect(f.label.en && f.label.fr && f.description.en && f.description.fr).toBeTruthy();
    expect(Object.values(effectiveFeatures()).every(Boolean)).toBe(true);
    expect(effectiveFeatures({ board: false, unknown: false } as never)).toMatchObject({
      board: false,
    });
    expect(effectiveFeatures({ unknown: false } as never)).not.toHaveProperty('unknown');
  });

  it('maps requests and views to features', () => {
    expect(featureForRequest('POST', '/api/v1/projects/p1/board/pull-requests')).toEqual(
      expect.arrayContaining(['board', 'pullRequests']),
    );
    expect(featureForRequest('GET', '/api/v1/projects/p1/board?x=1')).toEqual(['board']);
    expect(featureForRequest('GET', '/api/v1/projects/p1/jobs')).toEqual([]);
    expect(featureForRequest('POST', '/api/v1/projects/p1/jobs')).toEqual(['ai']);
    expect([...hiddenViews(effectiveFeatures({ board: false, stack: false }))].sort()).toEqual([
      'board',
      'stack',
    ]);
  });
});

describe('feature flags API', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('features');
  });
  afterAll(async () => h?.teardown());

  it('has route patterns that all match registered routes', () => {
    const routes = (h.app as unknown as { apiRoutes: { method: string; url: string }[] }).apiRoutes;
    const unmatched = featureFlags.flatMap((f) =>
      ((f as { routes?: readonly string[] }).routes ?? []).filter((pattern) => {
        const [method, path] = pattern.split(' ');
        const regex = new RegExp(`^${path.replace(/:[A-Za-z]+/g, '[^/]+')}/?$`);
        return !routes.some((r) => (method === '*' || r.method === method) && regex.test(r.url));
      }),
    );
    expect(unmatched).toEqual([]);
  });

  it('lets only workspace admins change flags, and disabled features are refused', async () => {
    const p = await h.createProject();
    expect((await h.request('GET', '/features')).json().features.board).toBe(true);
    const editor = await h.userWith('Editor');
    expect(
      (await h.request('PUT', '/admin/features', { features: { board: false } }, editor.cookie))
        .statusCode,
    ).toBe(403);
    expect(
      (await h.request('PUT', '/admin/features', { features: { nope: false } })).statusCode,
    ).toBe(400);

    const off = await h.request('PUT', '/admin/features', {
      features: { board: false, mcp: false, sso: false },
    });
    expect(off.statusCode).toBe(200);
    expect(off.json().features).toMatchObject({ board: false, mcp: false, sso: false, ai: true });
    const refused = await h.request('GET', `/projects/${p.id}/board`);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'feature-disabled', feature: 'board' });
    expect(
      (await h.request('POST', `/projects/${p.id}/mcp/tokens`, { name: 'x' })).statusCode,
    ).toBe(403);
    expect((await h.app.inject({ method: 'GET', url: '/api/v1/auth/oidc' })).json()).toMatchObject({
      code: 'feature-disabled',
    });
    // Core routes are unaffected.
    expect((await h.request('GET', `/projects/${p.id}`)).statusCode).toBe(200);

    await h.request('PUT', '/admin/features', { features: { board: true, mcp: true, sso: true } });
    expect((await h.request('GET', `/projects/${p.id}/board`)).statusCode).toBe(200);
    const audits = await h.db.collection('audit').find({ action: 'features.updated' }).toArray();
    expect(audits.length).toBe(2);
  });

  it('refuses Claude Agent runs when that feature is off, but not other providers', async () => {
    const p = await h.createProject();
    await h.request('PUT', '/admin/features', { features: { agentRunner: false } });
    const agent = await h.request('POST', `/projects/${p.id}/jobs`, {
      provider: 'claude-agent',
      model: 'x',
      sectionId: 'discovery',
      prompt: 'hi',
    });
    expect(agent.json()).toMatchObject({ feature: 'agentRunner' });
    const other = await h.request('POST', `/projects/${p.id}/jobs`, {
      provider: 'ollama',
      model: 'x',
      sectionId: 'discovery',
      prompt: 'hi',
    });
    expect(other.json().feature).toBeUndefined();
    await h.request('PUT', '/admin/features', { features: { agentRunner: true } });
  });

  it('refuses AI import when AI is off but keeps rule-based import', async () => {
    const p = await h.createProject();
    await h.request('PUT', '/admin/features', { features: { ai: false } });
    const body = {
      name: 'notes.md',
      format: 'markdown',
      content: '## Problem to solve\nLost requests.',
    };
    const ai = await h.request('POST', `/projects/${p.id}/import/document`, {
      ...body,
      method: 'ai',
      provider: 'ollama',
      model: 'x',
    });
    expect(ai.json()).toMatchObject({ code: 'feature-disabled', feature: 'ai' });
    expect(
      (await h.request('POST', `/projects/${p.id}/import/document`, { ...body, method: 'rules' }))
        .statusCode,
    ).toBe(200);
    await h.request('PUT', '/admin/features', { features: { ai: true } });
  });

  it('hides SSO from the sign-in options when it is off', async () => {
    await h.request('PUT', '/admin/configuration', {
      oidcIssuer: 'https://issuer.example.com',
      oidcClientId: 'client',
    });
    const options = async () =>
      (await h.app.inject({ method: 'GET', url: '/api/v1/auth/options' })).json();
    expect((await options()).oidc).toBe(true);
    await h.request('PUT', '/admin/features', { features: { sso: false } });
    expect((await options()).oidc).toBe(false);
    await h.request('PUT', '/admin/features', { features: { sso: true } });
  });
});
