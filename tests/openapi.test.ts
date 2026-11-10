import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { setupApp, type Harness } from './helpers';
import { openApiPath, routeDocs } from '../apps/api/src/openapi';

let h: Harness;
beforeAll(async () => {
  h = await setupApp('openapi');
});
afterAll(async () => h?.teardown());

describe('OpenAPI documentation', () => {
  it('documents every registered API route and nothing that does not exist', () => {
    const routes = (h.app as unknown as { apiRoutes: { method: string; url: string }[] }).apiRoutes.map((r) => `${r.method} ${openApiPath(r.url)}`);
    expect(routes.length).toBeGreaterThan(60);
    expect(routes.filter((r) => !routeDocs[r])).toEqual([]);
    expect(Object.keys(routeDocs).filter((r) => !routes.includes(r))).toEqual([]);
  });
  it('serves the document and Swagger UI to signed-in users only', async () => {
    expect((await h.app.inject('/api/docs/json')).statusCode).toBe(401);
    const doc = (await h.app.inject({ url: '/api/docs/json', headers: { cookie: h.cookie } })).json();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/api/v1/projects/{id}'].patch.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/patch');
    expect(doc.components.schemas.specification.properties.sections).toBeDefined();
    await h.app.ready();
    const ui = await h.app.inject({ url: '/api/docs', headers: { cookie: h.cookie } });
    expect(ui.statusCode).toBe(200);
    expect(ui.body).toContain('swagger');
  });
});
