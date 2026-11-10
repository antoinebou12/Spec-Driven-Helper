import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { observabilityTools } from '../apps/api/src/admin-observability';
import { metrics, metricsSummary } from '../apps/api/src/observability';
import { setupApp, type Harness } from './helpers';

describe('metrics summary', () => {
  it('computes totals, error rate and latency quantiles from the registry', () => {
    const before = metricsSummary().requests.total;
    metrics.counter('sdd_http_requests_total', 'HTTP requests by route and status', { method: 'GET', route: '/x-test', status: '200' }, 9);
    metrics.counter('sdd_http_requests_total', 'HTTP requests by route and status', { method: 'GET', route: '/x-test', status: '500' }, 1);
    for (let i = 0; i < 20; i++) metrics.observe('sdd_http_request_duration_seconds', 'HTTP request duration', { route: '/x-test' }, i < 19 ? 0.04 : 3);
    const s = metricsSummary();
    expect(s.requests.total - before).toBe(10);
    expect(s.requests.serverErrors).toBeGreaterThanOrEqual(1);
    expect(s.topRoutes.find((r) => r.route === '/x-test')).toMatchObject({ count: 10, errors: 1 });
    expect(s.latencySeconds.p50).not.toBeNull();
    expect(s.process.rssBytes).toBeGreaterThan(0);
  });

  it('only links observability tools with http(s) URLs', () => {
    const tools = observabilityTools({ GRAFANA_URL: 'https://grafana.example', NETDATA_URL: 'ftp://netdata.example' } as never);
    expect(tools.find((t) => t.id === 'grafana')?.url).toBe('https://grafana.example');
    expect(tools.find((t) => t.id === 'netdata')?.url).toBeNull();
    expect(tools.find((t) => t.id === 'prometheus')?.url).toBeNull();
  });
});

describe('admin observability API', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('observability_admin');
  });
  afterAll(async () => h?.teardown());

  it('returns live operating data to workspace admins only', async () => {
    await h.request('GET', '/projects');
    const res = await h.request('GET', '/admin/observability');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.database.ok).toBe(true);
    expect(body.requests.total).toBeGreaterThan(0);
    expect(body.tools.map((t: { id: string }) => t.id)).toEqual(['grafana', 'prometheus', 'netdata', 'traces']);
    const editor = await h.userWith('Editor');
    expect((await h.request('GET', '/admin/observability', undefined, editor.cookie)).statusCode).toBe(403);
  });
});
