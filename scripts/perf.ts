import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { signInCookie, startTestServer } from './lib/test-server';

/**
 * Backend load test with budgets. Starts the API on a throwaway namespace, loads the realistic
 * SDD Studio fixture (14 sections, 100+ cards), then drives each scenario with concurrent clients
 * for a fixed time. Fails when p95 latency, error rate or throughput misses its budget.
 * Reports: perf-report/report.json and report.md. Run: `pnpm perf` (needs DATABASE_URL).
 * PERF_SECONDS (default 5) and PERF_CONCURRENCY (default 8) tune the run.
 */
const seconds = Number(process.env.PERF_SECONDS ?? 5);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 8);
type Scenario = { name: string; p95: number; minRps: number; run: (client: number) => Promise<Response> };

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;

async function drive(s: Scenario) {
  const latencies: number[] = [];
  let errors = 0;
  const end = performance.now() + seconds * 1000;
  await Promise.all(
    Array.from({ length: concurrency }, async (_, client) => {
      while (performance.now() < end) {
        const started = performance.now();
        try {
          const res = await s.run(client);
          await res.arrayBuffer();
          if (!res.ok) errors++;
        } catch {
          errors++;
        }
        latencies.push(performance.now() - started);
      }
    }),
  );
  latencies.sort((a, b) => a - b);
  const total = latencies.length;
  return {
    scenario: s.name,
    requests: total,
    rps: Math.round((total / seconds) * 10) / 10,
    p50: Math.round(percentile(latencies, 50)),
    p95: Math.round(percentile(latencies, 95)),
    p99: Math.round(percentile(latencies, 99)),
    errorRate: total ? errors / total : 1,
    budget: { p95: s.p95, minRps: s.minRps },
  };
}

const server = await startTestServer(Number(process.env.PERF_PORT ?? 3161), 'perf');
let failed = false;
try {
  const origin = server.origin;
  const cookie = await signInCookie(origin);
  const headers = { cookie, Origin: origin, 'Content-Type': 'application/json' };
  const api = (path: string, init: RequestInit = {}) => fetch(`${origin}/api/v1${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

  // Realistic data: the SDD Studio fixture imported and accepted, with its board.
  const zip = await JSZip.loadAsync(readFileSync(join('fixtures', 'sdd-studio.plan.zip')));
  const files: Record<string, string> = {};
  for (const e of Object.values(zip.files)) if (!e.dir) files[e.name] = await e.async('string');
  const project = (await (await api('/projects', { method: 'POST', body: JSON.stringify({ name: 'Perf', sample: true }) })).json()) as { id: string };
  const preview = (await (await api(`/projects/${project.id}/plan-folder/import`, { method: 'POST', body: JSON.stringify({ files }) })).json()) as { board: { revision: number } };
  await api(`/projects/${project.id}/plan-folder/import`, { method: 'POST', body: JSON.stringify({ files, preview: false, expectedBoardRevision: preview.board.revision }) });
  const token = ((await (await api(`/projects/${project.id}/mcp/tokens`, { method: 'POST', body: JSON.stringify({ name: 'perf' }) })).json()) as { token: string }).token;

  // Writes are serialised per project by revision; each client edits its own project.
  const writers = await Promise.all(
    Array.from({ length: concurrency }, async (_, i) => {
      const p = (await (await api('/projects', { method: 'POST', body: JSON.stringify({ name: `Perf writer ${i}` }) })).json()) as { id: string };
      return { id: p.id, revision: 0 };
    }),
  );

  const mcpCall = (name: string, args: Record<string, unknown>) =>
    fetch(`${origin}/api/v1/mcp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });

  const scenarios: Scenario[] = [
    { name: 'GET /api/health', p95: 50, minRps: 200, run: () => fetch(`${origin}/api/health`) },
    { name: 'GET /projects (list)', p95: 150, minRps: 50, run: () => api('/projects') },
    { name: 'GET /projects/:id (spec + readiness)', p95: 250, minRps: 30, run: () => api(`/projects/${project.id}`) },
    { name: 'GET /projects/:id/board (100+ cards)', p95: 200, minRps: 40, run: () => api(`/projects/${project.id}/board`) },
    { name: 'GET /projects/:id/export/json', p95: 400, minRps: 15, run: () => api(`/projects/${project.id}/export/json`) },
    {
      name: 'PATCH /projects/:id (autosave)',
      p95: 400,
      minRps: 15,
      run: async (client) => {
        // Each client edits its own project, as one person's autosave would.
        const w = writers[client];
        const res = await api(`/projects/${w.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ expectedRevision: w.revision, patch: { sections: [{ id: 'discovery', answers: { 'discovery.1': { value: `Load test answer ${w.revision}`, state: 'answered', reason: '' } } }] } }),
        });
        if (res.ok) w.revision++;
        return res;
      },
    },
    { name: 'MCP get_board (tools/call)', p95: 300, minRps: 20, run: () => mcpCall('get_board', { limit: 50 }) },
    { name: 'GET /llms-full.txt (public)', p95: 150, minRps: 50, run: () => fetch(`${origin}/llms-full.txt`) },
  ];

  const results = [];
  for (const s of scenarios) {
    const r = await drive(s);
    const ok = r.p95 <= s.p95 && r.rps >= s.minRps && r.errorRate < 0.01;
    failed ||= !ok;
    results.push({ ...r, ok });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.name.padEnd(40)} ${String(r.rps).padStart(7)} req/s  p50 ${String(r.p50).padStart(4)} ms  p95 ${String(r.p95).padStart(4)} ms (≤ ${s.p95})  p99 ${String(r.p99).padStart(4)} ms  errors ${(r.errorRate * 100).toFixed(2)}%`);
  }
  mkdirSync('perf-report', { recursive: true });
  const meta = { at: new Date().toISOString(), seconds, concurrency, node: process.version };
  writeFileSync('perf-report/report.json', `${JSON.stringify({ ...meta, results }, null, 2)}\n`);
  writeFileSync(
    'perf-report/report.md',
    `# Backend load test\n\n${seconds} s per scenario, ${concurrency} concurrent clients, ${meta.node}.\n\n| Scenario | req/s | p50 ms | p95 ms (budget) | p99 ms | errors | |\n| --- | --- | --- | --- | --- | --- | --- |\n${results
      .map((r) => `| ${r.scenario} | ${r.rps} | ${r.p50} | ${r.p95} (≤ ${r.budget.p95}) | ${r.p99} | ${(r.errorRate * 100).toFixed(2)} % | ${r.ok ? 'ok' : 'FAIL'} |`)
      .join('\n')}\n`,
  );
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await server.stop();
}
console.log(failed ? '\nLoad test budgets: FAILED (perf-report/)' : '\nLoad test budgets: all met (perf-report/)');
process.exit(failed ? 1 : 0);
