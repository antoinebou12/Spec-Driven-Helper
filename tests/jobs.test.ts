import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import type { AddressInfo } from 'node:net';
import { setupApp, fakeOllama, type Harness } from './helpers';

let h: Harness, ollama: Awaited<ReturnType<typeof fakeOllama>>, jobs: typeof import('../apps/api/src/jobs');
beforeAll(async () => {
  ollama = await fakeOllama();
  process.env.OLLAMA_URL = ollama.url;
  // A large window keeps these runs on the full proposal format; the compact path is in ollama.test.ts.
  process.env.OLLAMA_NUM_CTX = '131072';
  h = await setupApp('jobs');
  jobs = await import('../apps/api/src/jobs');
});
afterAll(async () => {
  await h?.teardown();
  await ollama?.close();
});

const proposal = (extra: Record<string, unknown> = {}) => ({
  title: 'Clarify the problem',
  patch: {
    sections: [
      {
        id: 'discovery',
        answers: { 'discovery.1': { value: 'Customers lose track of requests.', state: 'answered', reason: '' } },
      },
    ],
    items: [{ id: 'REQ-001', type: 'requirement', title: 'Track requests', status: 'accepted', acceptance: 'Within 2 s' }],
  },
  assumptions: ['Based on the request text only.'],
  sources: [],
  ...extra,
});
const queue = async (projectId: string, body: Record<string, unknown> = {}) => {
  const res = await h.request('POST', `/projects/${projectId}/jobs`, { provider: 'ollama', model: 'fake-model', prompt: 'Help', ...body });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().id as string;
};
const job = (id: string) => h.db.collection('jobs').findOne({ id });
const proposals = (projectId: string) => h.db.collection('proposals').find({ projectId }).toArray();

describe('AI runs', () => {
  it('fails queued runs whose feature was disabled after queueing, without a proposal', async () => {
    const p = await h.createProject();
    const id = await queue(p.id);
    await h.request('PUT', '/admin/features', { features: { ai: false } });
    try {
      await jobs.runOnce();
      expect(await job(id)).toMatchObject({ status: 'failed', error: expect.stringContaining('disabled') });
      expect(await proposals(p.id)).toEqual([]);
    } finally {
      await h.request('PUT', '/admin/features', { features: { ai: true } });
    }
  });

  it('turns model output into a pending proposal that changes nothing until accepted', async () => {
    const p = await h.createProject();
    ollama.respond(
      proposal({ ui: [{ kind: 'choice', questionId: 'quality.3', label: 'Availability', options: ['99.5%', '99.9%'] }] }),
    );
    const id = await queue(p.id);
    expect(await jobs.runOnce()).toBe(true);
    const done = await job(id);
    expect(done!.status).toBe('completed');
    expect(done!.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(done!.events.map((e: any) => e.type)).toEqual(
      expect.arrayContaining(['RUN_STARTED', 'STEP_STARTED', 'STEP_FINISHED', 'STATE_SNAPSHOT', 'RUN_FINISHED']),
    );
    const [pending] = await proposals(p.id);
    expect(pending).toMatchObject({ status: 'pending', origin: 'ai', baseRevision: 0 });
    expect(pending.changes.map((c: any) => c.path)).toEqual(
      expect.arrayContaining(['sections.discovery.answers.discovery.1', 'items.REQ-001']),
    );
    expect(pending.ui).toHaveLength(1);
    expect((await h.project(p.id)).spec.revision).toBe(0);
    const accepted = await h.request('POST', `/projects/${p.id}/proposals/${pending.id}/accept`);
    expect(accepted.json().sections[0].answers['discovery.1'].value).toBe('Customers lose track of requests.');
    const history = (await h.request('GET', `/projects/${p.id}/history`)).json();
    expect(history[0].provenance).toMatchObject({ origin: 'ai', proposalId: pending.id, jobId: id });
    // The generated choice control writes only its own question, with an offered option.
    const control = (v: string) =>
      h.request('POST', `/projects/${p.id}/proposals/${pending.id}/controls/0`, { expectedRevision: 1, value: v });
    expect((await control('100%')).statusCode).toBe(400);
    expect((await control('99.9%')).json().sections.find((s: any) => s.id === 'quality').answers['quality.3'].value).toBe('99.9%');
  });
  it('drops unsafe generated interfaces and keeps the ordinary form', async () => {
    const p = await h.createProject();
    ollama.respond(proposal({ ui: [{ kind: 'text', questionId: 'discovery.1', label: 'x', onClick: 'alert(1)' }] }));
    await queue(p.id);
    await jobs.runOnce();
    const [pending] = await proposals(p.id);
    expect(pending.ui).toBeUndefined();
    expect(pending.uiRejected).toBeTruthy();
  });
  it('fails malformed or schema-invalid output without creating proposals', async () => {
    const p = await h.createProject();
    ollama.respond('this is not json');
    const malformed = await queue(p.id);
    await jobs.runOnce();
    expect((await job(malformed))!).toMatchObject({ status: 'failed', error: 'The model returned malformed JSON' });
    ollama.respond({
      ...proposal(),
      patch: { sections: [{ id: 'discovery', answers: { 'discovery.1': { value: 'x', state: 'maybe', reason: '' } } }] },
    });
    const invalid = await queue(p.id);
    await jobs.runOnce();
    expect((await job(invalid))!.status).toBe('failed');
    expect(await proposals(p.id)).toHaveLength(0);
    expect((await h.project(p.id)).spec.revision).toBe(0);
  });

  it('leaves out answers filed under the wrong section and keeps the rest of the proposal', async () => {
    const p = await h.createProject();
    ollama.respond({
      ...proposal(),
      patch: { sections: [{ id: 'discovery', answers: { 'scope.1': { value: 'x', state: 'answered', reason: '' }, 'discovery.1': { value: 'Real problem', state: 'answered', reason: '' } } }] },
    });
    const id = await queue(p.id);
    await jobs.runOnce();
    expect(await job(id)).toMatchObject({ status: 'completed', context: { unknownDropped: 1 } });
    const [created] = await proposals(p.id);
    expect(Object.keys(created.patch.sections[0].answers)).toEqual(['discovery.1']);
  });
  it('lets only administrators check the Ollama connection, and records the run context', async () => {
    const status = await h.request('GET', '/integrations/ollama/status');
    expect(status.statusCode, status.body).toBe(200);
    expect(status.json()).toMatchObject({ url: ollama.url, numCtx: 131072 });
    const editor = await h.userWith('Editor');
    expect((await h.request('GET', '/integrations/ollama/status', undefined, editor.cookie)).statusCode).toBe(403);
    const p = await h.createProject();
    ollama.respond(proposal());
    const id = await queue(p.id);
    await jobs.runOnce();
    expect(await job(id)).toMatchObject({ status: 'completed', context: { mode: 'full', window: 131072 } });
  });

  it('retries unavailable providers and fails cleanly after the limit', async () => {
    const p = await h.createProject();
    expect(
      (await h.request('POST', `/projects/${p.id}/jobs`, { provider: 'ollama', model: 'missing-model', prompt: 'x' })).statusCode,
    ).toBe(503);
    const id = await queue(p.id);
    for (let attempt = 1; attempt <= 3; attempt++) {
      ollama.fail(503);
      await h.db.collection('jobs').updateOne({ id }, { $set: { availableAt: new Date(0) } });
      await jobs.runOnce();
    }
    const failed = await job(id);
    expect(failed).toMatchObject({ status: 'failed', attempts: 3 });
    expect(failed!.events.filter((e: any) => e.type === 'RUN_ERROR')).toHaveLength(3);
    expect(await proposals(p.id)).toHaveLength(0);
  });
  it('honours cancellation during a run', async () => {
    const p = await h.createProject();
    ollama.respond(proposal(), 1500);
    const id = await queue(p.id);
    const running = jobs.runOnce();
    await new Promise((r) => setTimeout(r, 300));
    expect((await h.request('POST', `/projects/${p.id}/jobs/${id}/cancel`)).json().canceled).toBe(true);
    await running;
    expect((await job(id))!.status).toBe('canceled');
    expect(await proposals(p.id)).toHaveLength(0);
  });
  it('recovers jobs abandoned by a crashed worker exactly once', async () => {
    const p = await h.createProject();
    const id = await queue(p.id);
    const claimed = await jobs.claimJob();
    expect(claimed!.job.id).toBe(id);
    // The worker dies here. Once the lease expires another worker takes over.
    await h.db.collection('jobs').updateOne({ id }, { $set: { leaseUntil: new Date(0) } });
    ollama.respond(proposal());
    await jobs.runOnce();
    expect((await job(id))!.status).toBe('completed');
    const created = await proposals(p.id);
    expect(created).toHaveLength(1);
    // Re-running the same job (duplicate delivery) cannot duplicate or overwrite the proposal.
    const { createProposal } = await import('../apps/api/src/projects');
    await createProposal({ id, spec: (await h.project(p.id)).spec, projectId: p.id, createdBy: 'x', origin: 'ai', title: 'dup', patch: {} });
    expect(await proposals(p.id)).toHaveLength(1);
    expect((await proposals(p.id))[0].title).toBe('Clarify the problem');
  });
  it('enforces monthly token budgets', async () => {
    const p = await h.createProject();
    await h.request('PUT', `/projects/${p.id}/settings`, { aiRunLimit: 10, aiTokenBudget: 100 });
    ollama.respond(proposal());
    await queue(p.id);
    await jobs.runOnce();
    const usage = (await h.request('GET', `/projects/${p.id}/usage`)).json();
    expect(usage.tokens).toBe(150);
    expect((await h.request('POST', `/projects/${p.id}/jobs`, { provider: 'ollama', model: 'fake-model', prompt: 'x' })).statusCode).toBe(429);
  });
});

describe('Claude Agent integration', () => {
  it('sends only scoped material, audits tool use and cannot bypass review', async () => {
    const received: any[] = [];
    const runner = Fastify();
    const token = 'r'.repeat(40);
    runner.addHook('onRequest', async (req, reply) => {
      if (req.headers.authorization !== `Bearer ${token}`) return reply.code(401).send();
    });
    runner.get('/models', async () => ({ models: ['claude-test'] }));
    runner.post('/run', async (req) => {
      received.push(req.body);
      return {
        text: JSON.stringify(proposal()),
        usage: { input_tokens: 10, output_tokens: 5 },
        toolLog: [
          { tool: 'Read', target: 'specification-context.json', decision: 'allow' },
          { tool: 'Write', target: '/app/.env', decision: 'deny', reason: 'Write is not available' },
        ],
      };
    });
    await runner.listen({ port: 0, host: '127.0.0.1' });
    process.env.AGENT_RUNNER_URL = `http://127.0.0.1:${(runner.server.address() as AddressInfo).port}`;
    process.env.AGENT_RUNNER_TOKEN = token;
    try {
      const p = await h.createProject();
      const id = (
        await h.request('POST', `/projects/${p.id}/jobs`, { provider: 'claude-agent', model: 'claude-test', prompt: 'Review scope' })
      ).json().id;
      await jobs.runOnce();
      expect((await job(id))!.status).toBe('completed');
      const files = Object.keys(received[0].files);
      expect(files).toContain('specification-context.json');
      expect(files).toContain('sections/discovery.md');
      expect(files.every((f) => !f.startsWith('/') && !f.includes('..'))).toBe(true);
      const audit = await h.db.collection('audit').find({ action: 'agent.tool', projectId: p.id }).toArray();
      expect(audit.map((a) => a.details.decision)).toEqual(['allow', 'deny']);
      const [pending] = await proposals(p.id);
      expect(pending.status).toBe('pending');
      expect((await h.project(p.id)).spec.revision).toBe(0);
    } finally {
      delete process.env.AGENT_RUNNER_URL;
      delete process.env.AGENT_RUNNER_TOKEN;
      await runner.close();
    }
  });
});
