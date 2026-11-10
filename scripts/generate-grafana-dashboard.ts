import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Generates deploy/observability/grafana/dashboards/sdd-studio.json from code, so panels stay in
 * step with the metric names in apps/api/src (sdd_http_*, sdd_jobs, sdd_pending_proposals).
 * Run with `pnpm grafana:dashboard`; the output is committed.
 */
const ds = { type: 'prometheus', uid: 'prometheus' };
type Threshold = { color: string; value: number | null };
const green: Threshold = { color: 'green', value: null };
let id = 0;
const stat = (title: string, expr: string, x: number, unit = 'short', steps?: Threshold[]) => ({
  id: ++id,
  type: 'stat',
  title,
  datasource: ds,
  gridPos: { x, y: 0, w: 4, h: 4 },
  fieldConfig: { defaults: { unit, ...(steps ? { thresholds: { mode: 'absolute', steps } } : {}) }, overrides: [] },
  targets: [{ refId: 'A', expr, datasource: ds }],
});
const series = (title: string, queries: [string, string][], x: number, y: number, unit = 'short') => ({
  id: ++id,
  type: 'timeseries',
  title,
  datasource: ds,
  gridPos: { x, y, w: 12, h: 8 },
  fieldConfig: { defaults: { unit }, overrides: [] },
  targets: queries.map(([expr, legendFormat], i) => ({ refId: String.fromCharCode(65 + i), expr, legendFormat, datasource: ds })),
});
const rate = 'sum(rate(sdd_http_requests_total[5m]))';
const quantile = (q: number, by = 'le') => `histogram_quantile(${q}, sum by (${by}) (rate(sdd_http_request_duration_seconds_bucket[5m])))`;

const dashboard = {
  uid: 'sdd-studio',
  title: 'SDD Studio',
  tags: ['sdd-studio'],
  timezone: 'browser',
  schemaVersion: 39,
  version: 1,
  refresh: '30s',
  time: { from: 'now-6h', to: 'now' },
  panels: [
    stat('API up', 'up{job="sdd-studio"}', 0, 'short', [{ color: 'red', value: null }, { color: 'green', value: 1 }]),
    stat('Requests / s', rate, 4, 'reqps'),
    stat('Server error rate', `sum(rate(sdd_http_requests_total{status=~"5.."}[5m])) / clamp_min(${rate}, 1e-9)`, 8, 'percentunit', [green, { color: 'orange', value: 0.01 }, { color: 'red', value: 0.05 }]),
    stat('Latency p95', quantile(0.95), 12, 's', [green, { color: 'orange', value: 1 }, { color: 'red', value: 2.5 }]),
    stat('Pending proposals', 'sdd_pending_proposals', 16),
    stat('API memory', 'sdd_process_resident_bytes', 20, 'bytes'),
    series('Requests by status', [['sum by (status) (rate(sdd_http_requests_total[5m]))', '{{status}}']], 0, 4, 'reqps'),
    series('Latency quantiles', [[quantile(0.5), 'p50'], [quantile(0.95), 'p95'], [quantile(0.99), 'p99']], 12, 4, 's'),
    series('Slowest routes (p95)', [[`topk(8, ${quantile(0.95, 'le, route')})`, '{{route}}']], 0, 12, 's'),
    series('Jobs by status', [['sdd_jobs', '{{status}}']], 12, 12),
    series('Host CPU (Netdata)', [['sum by (dimension) (netdata_system_cpu_percentage_average{dimension!="idle"})', '{{dimension}}']], 0, 20, 'percent'),
    series('Host memory (Netdata)', [['netdata_system_ram_MiB_average', '{{dimension}}']], 12, 20, 'mbytes'),
  ],
};

const dir = 'deploy/observability/grafana/dashboards';
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/sdd-studio.json`, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`wrote ${dir}/sdd-studio.json (${dashboard.panels.length} panels)`);
