import type { ObservabilityData } from '../components/ObservabilityPanel';

/** Sample data for the observability story and component test. */
export const sampleObservability: ObservabilityData = {
  requests: { total: 18432, serverErrors: 12, clientErrors: 204, errorRate: 12 / 18432 },
  latencySeconds: { p50: 0.05, p95: 0.25, p99: 1, mean: 0.071 },
  topRoutes: [
    { route: '/api/v1/projects/:id', count: 7120, errors: 2 },
    { route: '/api/v1/projects/:id/jobs/:jobId/events', count: 3310, errors: 0 },
    { route: '/api/v1/projects/:id/board', count: 1290, errors: 10 },
  ],
  process: { uptimeSeconds: 93_600, rssBytes: 312 * 1_048_576, heapUsedBytes: 140 * 1_048_576, node: 'v24.21.0' },
  database: { ok: true, latencyMs: 3 },
  jobs: { succeeded: 412, failed: 3, running: 1, queued: 2 },
  recentFailedJobs: [{ id: 'j1', kind: 'ai', error: 'Provider timeout', finishedAt: '2026-09-27T20:10:00Z' }],
  pendingProposals: 7,
  tracing: false,
  metricsProtected: true,
  tools: [
    { id: 'grafana', name: 'Grafana', url: 'http://localhost:3300', purpose: 'Dashboards: traffic, latency, errors, jobs' },
    { id: 'prometheus', name: 'Prometheus', url: 'http://localhost:9090', purpose: 'Metric history and alert rules' },
    { id: 'netdata', name: 'Netdata', url: null, purpose: 'Host and container resources in real time' },
    { id: 'traces', name: 'Traces (OpenTelemetry)', url: null, purpose: 'Request traces exported over OTLP' },
  ],
  checkedAt: '2026-09-27T21:00:00Z',
};
