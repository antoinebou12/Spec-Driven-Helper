import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, ExternalLink, Gauge, RefreshCw, Timer } from 'lucide-react';
import { api } from '../api';
import { Badge, Button } from './ui';
import { formatDate, useL, useLang } from '../i18n';

export type ObservabilityData = {
  requests: { total: number; serverErrors: number; clientErrors: number; errorRate: number };
  latencySeconds: { p50: number | null; p95: number | null; p99: number | null; mean: number | null };
  topRoutes: { route: string; count: number; errors: number }[];
  process: { uptimeSeconds: number; rssBytes: number; heapUsedBytes: number; node: string };
  database: { ok: boolean; latencyMs: number };
  jobs: Record<string, number>;
  recentFailedJobs: { id: string; kind: string; error?: string; finishedAt?: string }[];
  pendingProposals: number;
  tracing: boolean;
  metricsProtected: boolean;
  tools: { id: string; name: string; url: string | null; purpose: string }[];
  checkedAt: string;
};

const ms = (s: number | null) => (s == null ? '—' : s === Infinity ? '> 10 s' : s < 1 ? `≤ ${Math.round(s * 1000)} ms` : `≤ ${s} s`);
const mb = (b: number) => `${Math.round(b / 1_048_576)} MB`;
const duration = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} d`);

/** Live operating data for workspace admins, with links to Grafana, Prometheus and Netdata. */
export function ObservabilityView({ data, onRefresh, busy }: { data: ObservabilityData; onRefresh?: () => void; busy?: boolean }) {
  const l = useL();
  const lang = useLang();
  const errorTone = data.requests.errorRate > 0.05 ? 'red' : data.requests.errorRate > 0.01 ? 'amber' : 'green';
  const tiles = [
    { icon: Activity, label: l('Requests since start', 'Requêtes depuis le démarrage'), value: data.requests.total.toLocaleString(lang), note: l(`${data.requests.clientErrors} client errors`, `${data.requests.clientErrors} erreurs client`) },
    { icon: Gauge, label: l('Server error rate', 'Taux d’erreurs serveur'), value: `${(data.requests.errorRate * 100).toFixed(2)} %`, note: l(`${data.requests.serverErrors} errors (5xx)`, `${data.requests.serverErrors} erreurs (5xx)`), tone: errorTone },
    { icon: Timer, label: l('Latency p95', 'Latence p95'), value: ms(data.latencySeconds.p95), note: `p50 ${ms(data.latencySeconds.p50)} · p99 ${ms(data.latencySeconds.p99)}` },
    { icon: Database, label: l('Database', 'Base de données'), value: data.database.ok ? `${data.database.latencyMs} ms` : l('Unreachable', 'Injoignable'), note: l('ping round trip', 'aller-retour ping'), tone: data.database.ok ? 'green' : 'red' },
  ];
  return (
    <div className="form-stack observability">
      <div className="inline-actions">
        <p className="muted small" role="status">
          {l(`Checked ${formatDate(data.checkedAt, lang)} · up ${duration(data.process.uptimeSeconds)} · memory ${mb(data.process.rssBytes)} · Node ${data.process.node}`, `Vérifié le ${formatDate(data.checkedAt, lang)} · actif depuis ${duration(data.process.uptimeSeconds)} · mémoire ${mb(data.process.rssBytes)} · Node ${data.process.node}`)}
        </p>
        {onRefresh && (
          <Button size="sm" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={14} aria-hidden /> {l('Refresh', 'Actualiser')}
          </Button>
        )}
      </div>
      <ul className="stat-tiles">
        {tiles.map((t) => (
          <li key={t.label} className="stat-tile">
            <span className="stat-label">
              <t.icon size={15} aria-hidden /> {t.label}
            </span>
            <strong className={t.tone ? `tone-${t.tone}` : undefined}>{t.value}</strong>
            <small className="muted">{t.note}</small>
          </li>
        ))}
      </ul>
      <div className="observability-grid">
        <section aria-labelledby="obs-jobs">
          <h4 id="obs-jobs">{l('Jobs and review queue', 'Tâches et file de révision')}</h4>
          <ul className="plain-list">
            {Object.entries(data.jobs).length ? (
              Object.entries(data.jobs).map(([status, n]) => (
                <li key={status}>
                  <Badge tone={status === 'failed' ? 'red' : status === 'running' ? 'blue' : status === 'queued' ? 'amber' : 'neutral'}>{status}</Badge> {n}
                </li>
              ))
            ) : (
              <li className="muted">{l('No jobs yet', 'Aucune tâche')}</li>
            )}
            <li>
              <Badge tone="violet">{l('pending proposals', 'propositions en attente')}</Badge> {data.pendingProposals}
            </li>
          </ul>
          {data.recentFailedJobs.length > 0 && (
            <>
              <h5>{l('Recent failures', 'Échecs récents')}</h5>
              <ul className="plain-list small">
                {data.recentFailedJobs.map((j) => (
                  <li key={j.id}>
                    <code>{j.kind}</code> {j.error ?? ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section aria-labelledby="obs-routes">
          <h4 id="obs-routes">{l('Busiest routes', 'Routes les plus sollicitées')}</h4>
          <table className="data-table compact">
            <caption className="sr-only">{l('Requests by route', 'Requêtes par route')}</caption>
            <thead>
              <tr>
                <th scope="col">{l('Route', 'Route')}</th>
                <th scope="col">{l('Requests', 'Requêtes')}</th>
                <th scope="col">5xx</th>
              </tr>
            </thead>
            <tbody>
              {data.topRoutes.map((r) => (
                <tr key={r.route}>
                  <td>
                    <code>{r.route}</code>
                  </td>
                  <td>{r.count}</td>
                  <td>{r.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <section aria-labelledby="obs-tools">
        <h4 id="obs-tools">{l('Observability tools', 'Outils d’observabilité')}</h4>
        <ul className="tool-links">
          {data.tools.map((t) => (
            <li key={t.id}>
              {t.url ? (
                <a href={t.url} target="_blank" rel="noreferrer noopener">
                  {t.name} <ExternalLink size={12} aria-hidden />
                  <span className="sr-only">{l('(opens in a new tab)', '(ouvre un nouvel onglet)')}</span>
                </a>
              ) : (
                <span>
                  {t.name} <Badge>{l('not configured', 'non configuré')}</Badge>
                </span>
              )}
              <small className="muted">{t.purpose}</small>
            </li>
          ))}
        </ul>
        <p className="muted small">
          {l(
            `Start Prometheus, Grafana and Netdata with docker compose -f compose.yaml -f compose.observability.yaml up -d, then set GRAFANA_URL, PROMETHEUS_URL and NETDATA_URL. Metrics endpoint ${data.metricsProtected ? 'protected by METRICS_TOKEN' : 'open to local requests only'}; tracing ${data.tracing ? 'on' : 'off'}.`,
            `Démarrez Prometheus, Grafana et Netdata avec docker compose -f compose.yaml -f compose.observability.yaml up -d, puis définissez GRAFANA_URL, PROMETHEUS_URL et NETDATA_URL. Point de métriques ${data.metricsProtected ? 'protégé par METRICS_TOKEN' : 'limité aux requêtes locales'}; traces ${data.tracing ? 'actives' : 'inactives'}.`,
          )}
        </p>
      </section>
    </div>
  );
}

export default function ObservabilityPanel() {
  const l = useL();
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setData(await api<ObservabilityData>('/admin/observability'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);
  return (
    <section className="card" aria-labelledby="observability-title">
      <h3 id="observability-title">{l('Observability', 'Observabilité')}</h3>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {data ? <ObservabilityView data={data} onRefresh={() => void load()} busy={busy} /> : !error && <p className="muted">{l('Loading…', 'Chargement…')}</p>}
    </section>
  );
}
