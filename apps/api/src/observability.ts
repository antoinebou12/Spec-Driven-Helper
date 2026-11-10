import pino from 'pino';

/** Log paths that may carry credentials. Shared by the API and worker loggers. */
export const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.secret',
  '*.token',
  '*.apiKey',
  '*.authorization',
];
export const log = pino({
  name: process.env.OTEL_SERVICE_NAME ?? 'sdd-studio',
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: redactPaths, censor: '[redacted]' },
});

/** Removes common secret shapes from free text before it is stored or logged. */
export function scrubSecrets(text: string) {
  return text
    .replace(/\b(sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,})\b/g, '[redacted-key]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,})\b/g, '[redacted-token]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[redacted]')
    .replace(/(:\/\/)[^/\s:@]+:[^/\s@]+@/g, '$1[redacted]@');
}

type Labels = Record<string, string>;
const counters = new Map<string, Map<string, number>>();
const histograms = new Map<string, { buckets: number[]; series: Map<string, { counts: number[]; sum: number; count: number }> }>();
const help = new Map<string, string>();
const key = (labels: Labels) =>
  Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
    .join(',');

export const metrics = {
  counter(name: string, description: string, labels: Labels = {}, value = 1) {
    help.set(name, description);
    const series = counters.get(name) ?? new Map();
    counters.set(name, series);
    series.set(key(labels), (series.get(key(labels)) ?? 0) + value);
  },
  observe(name: string, description: string, labels: Labels, value: number, buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    help.set(name, description);
    const h = histograms.get(name) ?? { buckets, series: new Map() };
    histograms.set(name, h);
    const s = h.series.get(key(labels)) ?? { counts: h.buckets.map(() => 0), sum: 0, count: 0 };
    h.series.set(key(labels), s);
    h.buckets.forEach((b, i) => {
      if (value <= b) s.counts[i]++;
    });
    s.sum += value;
    s.count++;
  },
  /** Prometheus text exposition, with extra gauges computed at scrape time. */
  render(gauges: { name: string; description: string; labels?: Labels; value: number }[] = []) {
    const lines: string[] = [];
    for (const [name, series] of counters) {
      lines.push(`# HELP ${name} ${help.get(name)}`, `# TYPE ${name} counter`);
      for (const [labels, value] of series) lines.push(`${name}${labels ? `{${labels}}` : ''} ${value}`);
    }
    for (const [name, h] of histograms) {
      lines.push(`# HELP ${name} ${help.get(name)}`, `# TYPE ${name} histogram`);
      for (const [labels, s] of h.series) {
        const prefix = labels ? `${labels},` : '';
        h.buckets.forEach((b, i) => lines.push(`${name}_bucket{${prefix}le="${b}"} ${s.counts[i]}`));
        lines.push(`${name}_bucket{${prefix}le="+Inf"} ${s.count}`);
        lines.push(`${name}_sum${labels ? `{${labels}}` : ''} ${s.sum}`, `${name}_count${labels ? `{${labels}}` : ''} ${s.count}`);
      }
    }
    const seen = new Set<string>();
    for (const g of gauges) {
      if (!seen.has(g.name)) lines.push(`# HELP ${g.name} ${g.description}`, `# TYPE ${g.name} gauge`);
      seen.add(g.name);
      const labels = key(g.labels ?? {});
      lines.push(`${g.name}${labels ? `{${labels}}` : ''} ${g.value}`);
    }
    return lines.join('\n') + '\n';
  },
};

/** Quantile estimate from cumulative histogram buckets (upper bound of the bucket that reaches q). */
function quantile(buckets: number[], counts: number[], total: number, q: number) {
  if (!total) return null;
  const rank = total * q;
  for (let i = 0; i < buckets.length; i++) if (counts[i] >= rank) return buckets[i];
  return Infinity;
}

/** In-process summary for the admin dashboard; Prometheus remains the source for history. */
export function metricsSummary() {
  const requests = counters.get('sdd_http_requests_total') ?? new Map<string, number>();
  let total = 0,
    errors = 0,
    clientErrors = 0;
  const byRoute = new Map<string, { count: number; errors: number }>();
  for (const [labels, value] of requests) {
    const status = Number(/status="(\d+)"/.exec(labels)?.[1] ?? 0);
    const route = /route="([^"]*)"/.exec(labels)?.[1] ?? 'unknown';
    total += value;
    if (status >= 500) errors += value;
    else if (status >= 400) clientErrors += value;
    const r = byRoute.get(route) ?? { count: 0, errors: 0 };
    r.count += value;
    if (status >= 500) r.errors += value;
    byRoute.set(route, r);
  }
  const h = histograms.get('sdd_http_request_duration_seconds');
  let latency: { p50: number | null; p95: number | null; p99: number | null; mean: number | null } = { p50: null, p95: null, p99: null, mean: null };
  if (h) {
    const counts = h.buckets.map((_, i) => [...h.series.values()].reduce((n, s) => n + s.counts[i], 0));
    const count = [...h.series.values()].reduce((n, s) => n + s.count, 0);
    const sum = [...h.series.values()].reduce((n, s) => n + s.sum, 0);
    latency = { p50: quantile(h.buckets, counts, count, 0.5), p95: quantile(h.buckets, counts, count, 0.95), p99: quantile(h.buckets, counts, count, 0.99), mean: count ? sum / count : null };
  }
  const memory = process.memoryUsage();
  return {
    requests: { total, serverErrors: errors, clientErrors, errorRate: total ? errors / total : 0 },
    latencySeconds: latency,
    topRoutes: [...byRoute].map(([route, r]) => ({ route, ...r })).sort((a, b) => b.count - a.count).slice(0, 8),
    process: { uptimeSeconds: Math.round(process.uptime()), rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, node: process.version },
  };
}
