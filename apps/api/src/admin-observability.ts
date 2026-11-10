import type { FastifyInstance } from 'fastify';
import { db } from './db';
import { HttpError } from './projects';
import type { Auth } from './auth-types';
import { can } from '../../../packages/shared/src/domain';
import { metricsSummary } from './observability';

/** Links to the operator's observability tools; only http(s) URLs configured by environment are shown. */
export function observabilityTools(env: NodeJS.ProcessEnv = process.env) {
  const tools = [
    { id: 'grafana', name: 'Grafana', url: env.GRAFANA_URL, purpose: 'Dashboards: traffic, latency, errors, jobs' },
    { id: 'prometheus', name: 'Prometheus', url: env.PROMETHEUS_URL, purpose: 'Metric history and alert rules' },
    { id: 'netdata', name: 'Netdata', url: env.NETDATA_URL, purpose: 'Host and container resources in real time' },
    { id: 'traces', name: 'Traces (OpenTelemetry)', url: env.TRACES_URL, purpose: 'Request traces exported over OTLP' },
  ];
  return tools.map((t) => ({ ...t, url: t.url && /^https?:\/\//.test(t.url) ? t.url : null }));
}

export async function registerObservability(app: FastifyInstance, auth: Auth) {
  const admin = async (req: any) => {
    await auth(req);
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
  };
  app.get('/api/v1/admin/observability', { preHandler: admin }, async () => {
    const jobs = await db.collection('jobs').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray();
    const [pendingProposals, failedJobs] = await Promise.all([
      db.collection('proposals').countDocuments({ status: 'pending' }),
      db.collection('jobs').find({ status: 'failed' }, { projection: { _id: 0, id: 1, kind: 1, error: 1, finishedAt: 1 } }).sort({ finishedAt: -1 }).limit(5).toArray(),
    ]);
    let database = { ok: true, latencyMs: 0 };
    const started = performance.now();
    try {
      await db.command({ ping: 1 });
      database = { ok: true, latencyMs: Math.round(performance.now() - started) };
    } catch {
      database = { ok: false, latencyMs: Math.round(performance.now() - started) };
    }
    return {
      ...metricsSummary(),
      database,
      jobs: Object.fromEntries(jobs.map((j) => [String(j._id), j.n])),
      recentFailedJobs: failedJobs,
      pendingProposals,
      tracing: !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      metricsProtected: !!process.env.METRICS_TOKEN,
      tools: observabilityTools(),
      checkedAt: new Date().toISOString(),
    };
  });
}
