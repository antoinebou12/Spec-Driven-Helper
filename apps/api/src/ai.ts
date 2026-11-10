import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from './db';
import { audit, encrypt } from './security';
import { HttpError, projectFor, type ProjectAccess } from './projects';
import { checkCapabilities, listModels, providerLabels, providerNames, ProviderError, type ProviderName } from './providers';
import type { Auth } from './auth-types';
import { requireFeature } from './features';
import { can } from '../../../packages/shared/src/domain';
import { runtimeConfig } from './admin';
import { clearOllamaCache, ollamaStatus } from './ollama';
import { nimSelfHosted } from './nim';
import { registerIdeaDraft } from './idea-draft';

const terminal = ['completed', 'failed', 'canceled'];
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};
export async function projectUsage(projectId: string) {
  const rows = await db
    .collection('jobs')
    .aggregate([
      { $match: { projectId, createdAt: { $gte: monthStart() } } },
      {
        $group: {
          _id: { provider: '$provider', model: '$model' },
          runs: { $sum: 1 },
          inputTokens: { $sum: { $ifNull: ['$usage.inputTokens', 0] } },
          outputTokens: { $sum: { $ifNull: ['$usage.outputTokens', 0] } },
        },
      },
    ])
    .toArray();
  const byModel = rows.map((r) => ({
    provider: r._id.provider,
    model: r._id.model,
    runs: r.runs,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
  }));
  return {
    since: monthStart(),
    byModel,
    tokens: byModel.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0),
  };
}

/**
 * Queues an AI run after enforcing the local-only rule, daily run limit, monthly token budget and
 * provider capability checks. Material is untrusted input passed to the model as data.
 */
export async function queueAiJob(
  p: ProjectAccess,
  userId: string,
  b: { provider: ProviderName; model: string; prompt: string; includeRepository?: boolean; material?: Record<string, string>; purpose?: string },
) {
  await requireFeature('ai');
  if (b.provider === 'claude-agent') await requireFeature('agentRunner');
  if (p.spec.localOnly && b.provider !== 'ollama') throw new HttpError(403, 'This project permits local Ollama only');
  const since = new Date(Date.now() - 86400000).toISOString();
  // Conversation turns (kind "chat") count toward the token budget only.
  const used = await db.collection('jobs').countDocuments({ projectId: p.id, createdAt: { $gte: since }, kind: { $ne: 'chat' } });
  if (used >= p.aiRunLimit) throw new HttpError(429, 'Daily project AI run limit reached');
  const usage = await projectUsage(p.id);
  if (usage.tokens >= p.aiTokenBudget) throw new HttpError(429, 'Monthly project AI token budget reached');
  try {
    await checkCapabilities(b.provider, b.model, p.spec);
  } catch (error) {
    throw new HttpError(error instanceof ProviderError ? 503 : 500, (error as Error).message);
  }
  const job = {
    id: crypto.randomUUID(),
    projectId: p.id,
    userId,
    kind: 'proposal',
    provider: b.provider,
    model: b.model,
    prompt: b.prompt,
    purpose: b.purpose ?? 'assist',
    includeRepository: b.provider === 'claude-agent' && !!b.includeRepository,
    ...(b.material ? { material: b.material } : {}),
    baseRevision: p.spec.revision,
    spec: p.spec,
    status: 'queued',
    attempts: 0,
    createdAt: new Date().toISOString(),
    events: [],
  };
  await db.collection('jobs').insertOne(job);
  await audit(userId, 'ai.run-queued', p.id, { jobId: job.id, provider: b.provider, model: b.model, purpose: job.purpose });
  return job;
}

export async function registerAiRoutes(app: FastifyInstance, auth: Auth) {
  registerIdeaDraft(app, auth, queueAiJob);
  app.get('/api/v1/integrations', { preHandler: auth }, async (req: any) => {
    const configs = await db
      .collection('integrations')
      .find({}, { projection: { id: 1, model: 1, secret: 1 } })
      .toArray();
    const admin = can(req.user.role, 'admin');
    // Secrets are write-only: only whether one is configured is ever returned.
    return providerNames.map((id) => ({
      id,
      label: providerLabels[id],
      model: configs.find((c) => c.id === id)?.model ?? '',
      local: id === 'ollama',
      configured:
        id === 'ollama'
          ? true
          : id === 'claude-agent'
            ? !!process.env.AGENT_RUNNER_URL && !!process.env.AGENT_RUNNER_TOKEN
            : id === 'nvidia-nim' && nimSelfHosted()
              ? true
              : configs.some((c) => c.id === id && c.secret),
      ...(admin && id === 'claude-agent' ? { runner: process.env.AGENT_RUNNER_URL ? 'configured' : 'missing' } : {}),
      // Whether NIM_BASE_URL points at the operator's own server; the address itself is not returned.
      ...(id === 'nvidia-nim' ? { endpoint: nimSelfHosted() ? 'self-hosted' : 'hosted' } : {}),
    }));
  });
  app.put('/api/v1/integrations/:provider', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
    const id = z.enum(providerNames).parse(req.params.provider);
    const b = z
      .object({ secret: z.string().max(10000).optional(), model: z.string().min(1).max(200) })
      .parse(req.body);
    await db
      .collection('integrations')
      .updateOne({ id }, { $set: { model: b.model, ...(b.secret ? { secret: encrypt(b.secret) } : {}) } }, { upsert: true });
    await audit(req.user.id, 'integration.updated', undefined, { provider: id, secretChanged: !!b.secret });
    return { ok: true };
  });
  app.get('/api/v1/integrations/ollama/status', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
    const [integration, config] = await Promise.all([db.collection('integrations').findOne({ id: 'ollama' }), runtimeConfig()]);
    clearOllamaCache();
    return ollamaStatus({
      chatModel: integration?.model || undefined,
      embeddingModel: config.embeddingProvider === 'ollama' ? config.embeddingModel : undefined,
    });
  });
  app.get('/api/v1/integrations/:provider/models', { preHandler: auth }, async (req: any) => {
    const id = z.enum(providerNames).parse(req.params.provider);
    try {
      return { models: await listModels(id) };
    } catch (error) {
      throw new HttpError(503, (error as Error).message);
    }
  });

  app.get('/api/v1/projects/:id/usage', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id);
    return { ...(await projectUsage(p.id)), budget: p.aiTokenBudget, dailyRunLimit: p.aiRunLimit };
  });
  app.post('/api/v1/projects/:id/jobs', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = z
      .object({
        provider: z.enum(providerNames),
        model: z.string().min(1).max(200),
        prompt: z.string().min(1).max(10000),
        includeRepository: z.boolean().default(false),
      })
      .parse(req.body);
    const job = await queueAiJob(p, req.user.id, b);
    return { id: job.id, status: job.status };
  });
  app.get('/api/v1/projects/:id/jobs', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id);
    return db
      .collection('jobs')
      .find({ projectId: req.params.id, kind: { $ne: 'chat' } }, { projection: { spec: 0, _id: 0, lease: 0 } })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
  });
  app.post('/api/v1/projects/:id/jobs/:jobId/cancel', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id, 'edit');
    const result = await db.collection('jobs').updateOne(
      { id: req.params.jobId, projectId: req.params.id, status: { $in: ['queued', 'running'] } },
      { $set: { status: 'canceled', canceledBy: req.user.id, finishedAt: new Date().toISOString() } },
    );
    if (result.modifiedCount) await audit(req.user.id, 'ai.run-canceled', req.params.id, { jobId: req.params.jobId });
    return { ok: true, canceled: result.modifiedCount === 1 };
  });
  /** AG-UI event stream for a run (server-sent events), resumable with Last-Event-ID. */
  app.get('/api/v1/projects/:id/jobs/:jobId/events', { preHandler: auth }, async (req: any, reply) => {
    await projectFor(req.user, req.params.id);
    const job = await db.collection('jobs').findOne({ id: req.params.jobId, projectId: req.params.id });
    if (!job) throw new HttpError(404, 'Job not found');
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    });
    let sent = Number(req.headers['last-event-id'] ?? -1) + 1,
      closed = false;
    req.raw.on('close', () => {
      closed = true;
    });
    const deadline = Date.now() + 15 * 60_000;
    while (!closed && Date.now() < deadline) {
      const current = await db.collection('jobs').findOne({ id: job.id }, { projection: { events: 1, status: 1 } });
      for (const event of current?.events ?? [])
        if (event.index >= sent) {
          reply.raw.write(`id: ${event.index}\ndata: ${JSON.stringify(event)}\n\n`);
          sent = event.index + 1;
        }
      if (!current || terminal.includes(current.status)) break;
      reply.raw.write(': heartbeat\n\n');
      await new Promise((r) => setTimeout(r, 1000));
    }
    reply.raw.end();
  });
}
