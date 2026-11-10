import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp, type Harness } from './helpers';

// The shared logger reads LOG_LEVEL when the module loads.
process.env.LOG_LEVEL ??= 'silent';
const { metrics, redactPaths, scrubSecrets } = await import('../apps/api/src/observability');

describe('secret scrubbing', () => {
  it('removes provider keys, Git tokens, bearer tokens and URL credentials', () => {
    const text = [
      'openai sk-proj-abcdefghijklmnop1234',
      'anthropic sk-ant-abcdefghijklmnop1234',
      'github ghp_abcdefghijklmnopqrstuvwx',
      'pat github_pat_abcdefghijklmnopqrstuv',
      'gitlab glpat-abcdefghijklmnop',
      'Authorization: Bearer abcdefghijklmnop',
      'remote https://user:hunter2@git.example.com/repo.git',
    ].join('\n');
    const scrubbed = scrubSecrets(text);
    for (const secret of [
      'sk-proj-abcdefghijklmnop1234',
      'sk-ant-abcdefghijklmnop1234',
      'ghp_',
      'github_pat_',
      'glpat-',
      'abcdefghijklmnop\n',
      'hunter2',
    ])
      expect(scrubbed).not.toContain(secret);
    expect(scrubbed).toContain('https://[redacted]@git.example.com/repo.git');
  });

  it('leaves ordinary text alone', () => {
    const text = 'Deploy task-1234 to https://example.com/docs with a short Bearer x token.';
    expect(scrubSecrets(text)).toBe(text);
  });

  it('redacts credentials in request and payload logs', () => {
    expect(redactPaths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.apiKey',
      ]),
    );
  });
});

describe('Prometheus exposition', () => {
  it('renders counters, cumulative histograms and escaped labels', () => {
    metrics.counter('test_events_total', 'Test events', { kind: 'a"b' });
    metrics.counter('test_events_total', 'Test events', { kind: 'a"b' }, 2);
    for (const v of [0.07, 0.3, 20])
      metrics.observe('test_duration_seconds', 'Test durations', { route: '/x' }, v, [0.1, 0.5, 1]);
    const text = metrics.render([
      { name: 'test_gauge', description: 'A gauge', labels: { status: 'ok' }, value: 4 },
    ]);
    expect(text).toContain('# TYPE test_events_total counter');
    expect(text).toContain('test_events_total{kind="a\\"b"} 3');
    expect(text).toContain('test_duration_seconds_bucket{route="/x",le="0.1"} 1');
    expect(text).toContain('test_duration_seconds_bucket{route="/x",le="0.5"} 2');
    expect(text).toContain('test_duration_seconds_bucket{route="/x",le="1"} 2');
    expect(text).toContain('test_duration_seconds_bucket{route="/x",le="+Inf"} 3');
    expect(text).toContain('test_duration_seconds_count{route="/x"} 3');
    expect(text).toContain('# TYPE test_gauge gauge\ntest_gauge{status="ok"} 4');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('metrics endpoint', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('observability');
  });
  afterAll(async () => {
    delete process.env.METRICS_TOKEN;
    await h?.teardown();
  });

  it('serves local scrapes, refuses remote ones, and requires the token when one is set', async () => {
    await h.request('GET', '/projects');
    const local = await h.app.inject({ method: 'GET', url: '/api/metrics' });
    expect(local.statusCode).toBe(200);
    expect(local.body).toContain('# TYPE sdd_http_requests_total counter');
    expect(local.body).toContain('sdd_pending_proposals');
    expect(local.body).not.toMatch(/sdd_session=|test-only-password/);
    expect(
      (await h.app.inject({ method: 'GET', url: '/api/metrics', remoteAddress: '10.1.2.3' }))
        .statusCode,
    ).toBe(403);

    process.env.METRICS_TOKEN = 'scrape-token-123';
    expect((await h.app.inject({ method: 'GET', url: '/api/metrics' })).statusCode).toBe(403);
    const remote = await h.app.inject({
      method: 'GET',
      url: '/api/metrics',
      remoteAddress: '10.1.2.3',
      headers: { authorization: 'Bearer scrape-token-123' },
    });
    expect(remote.statusCode).toBe(200);
  });
});
