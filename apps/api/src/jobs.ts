import { EventType } from '@ag-ui/core';
import { db } from './db';
import { generate, ProviderError, type AgentMaterial, type ProviderName } from './providers';
import { createProposal } from './projects';
import { processPublishing } from './publishing';
import { repositorySnapshot } from './git';
import { audit } from './security';
import { requireFeature } from './features';
import type { Spec } from '../../../packages/shared/src/schema';

export const maxAttempts = 3;
const leaseMs = 180_000;
const runTimeoutMs = Number(process.env.AI_RUN_TIMEOUT_MS ?? 150_000);
/** Local models on a CPU can need several minutes for one proposal. */
const localRunTimeoutMs = Number(process.env.OLLAMA_RUN_TIMEOUT_MS) || 600_000;

/** Claims the oldest runnable job, or an abandoned one whose lease expired (worker restart). */
export async function claimJob() {
  const lease = crypto.randomUUID();
  const now = new Date();
  const job = await db.collection('jobs').findOneAndUpdate(
    {
      attempts: { $lt: maxAttempts },
      $or: [
        { status: 'queued', $or: [{ availableAt: { $exists: false } }, { availableAt: { $lte: now } }] },
        { status: 'running', leaseUntil: { $lt: now } },
      ],
    },
    {
      $set: { status: 'running', lease, leaseUntil: new Date(Date.now() + leaseMs), startedAt: now.toISOString() },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  );
  if (!job)
    await db
      .collection('jobs')
      .updateMany(
        { status: 'running', leaseUntil: { $lt: now }, attempts: { $gte: maxAttempts } },
        { $set: { status: 'failed', error: 'Worker retry limit reached', finishedAt: now.toISOString() } },
      );
  return job ? { job, lease } : null;
}

async function material(job: any): Promise<AgentMaterial> {
  const spec = job.spec as Spec;
  const files: AgentMaterial = {};
  for (const s of spec.sections) files[`sections/${s.id}.md`] = s.markdown;
  if (job.includeRepository) Object.assign(files, await repositorySnapshot(job.projectId));
  Object.assign(files, job.material ?? {});
  return files;
}

export async function processJob(job: any, lease: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), job.provider === 'ollama' ? Math.max(runTimeoutMs, localRunTimeoutMs) : runTimeoutMs);
  const monitor = setInterval(async () => {
    const current = await db.collection('jobs').findOne({ id: job.id, lease });
    if (!current || current.status === 'canceled') controller.abort();
    else
      await db
        .collection('jobs')
        .updateOne({ id: job.id, lease }, { $set: { leaseUntil: new Date(Date.now() + leaseMs) } });
  }, 1000);
  let index = (job.events ?? []).length;
  const emit = (event: Record<string, unknown>) =>
    db
      .collection('jobs')
      .updateOne({ id: job.id, lease }, { $push: { events: { ...event, timestamp: Date.now(), index: index++ } } } as any);
  const step = async <T>(stepName: string, fn: () => Promise<T>) => {
    await emit({ type: EventType.STEP_STARTED, stepName });
    const value = await fn();
    await emit({ type: EventType.STEP_FINISHED, stepName });
    return value;
  };
  const finish = (set: Record<string, unknown>) =>
    db
      .collection('jobs')
      .updateOne({ id: job.id, lease, status: 'running' }, { $set: { ...set, finishedAt: new Date().toISOString() } });
  try {
    await emit({ type: EventType.RUN_STARTED, threadId: job.projectId, runId: job.id });
    // Jobs queued before an administrator switched the feature off must not run.
    const publishing = job.kind === 'pdf' || job.kind === 'image';
    for (const id of publishing ? (['reports'] as const) : job.provider === 'claude-agent' ? (['ai', 'agentRunner'] as const) : (['ai'] as const))
      await requireFeature(id);
    if (publishing) {
      const output = await step('publish', () => processPublishing(job, controller.signal));
      await finish({ status: 'completed', ...output });
      await emit({ type: EventType.RUN_FINISHED, threadId: job.projectId, runId: job.id });
      return;
    }
    const files = job.provider === 'claude-agent' ? await step('prepare-workspace', () => material(job)) : (job.material ?? {});
    const { result, usage, toolLog, context } = await step('call-provider', () =>
      generate(job.provider as ProviderName, job.model, job.spec, job.prompt, controller.signal, files),
    );
    await db.collection('jobs').updateOne({ id: job.id, lease }, { $set: { usage, context } });
    if (context.mode === 'compact') await emit({ type: EventType.CUSTOM, name: 'compact-context', value: context });
    for (const [i, entry] of toolLog.entries()) {
      const toolCallId = `${job.id}-tool-${i}`;
      await emit({ type: EventType.TOOL_CALL_START, toolCallId, toolCallName: entry.tool });
      await emit({ type: EventType.TOOL_CALL_END, toolCallId });
      await audit(job.userId, 'agent.tool', job.projectId, { jobId: job.id, ...entry });
    }
    const running = await db.collection('jobs').findOne({ id: job.id, lease, status: 'running' });
    if (!running) return;
    const proposal = await step('create-proposal', () =>
      createProposal({
        id: job.id,
        spec: job.spec,
        projectId: job.projectId,
        createdBy: job.userId,
        origin: 'ai',
        title: result.title,
        patch: result.patch,
        assumptions: result.assumptions,
        sources: result.sources,
        ui: result.ui,
        extra: { provider: job.provider, model: job.model, jobId: job.id },
      }),
    );
    const done = await finish({ status: 'completed', proposalId: proposal.id });
    if (!done.modifiedCount) {
      // Canceled while the proposal was being written: discard it rather than surface it.
      await db.collection('proposals').deleteOne({ id: proposal.id, status: 'pending' });
      return;
    }
    await emit({ type: EventType.STATE_SNAPSHOT, snapshot: { proposalId: proposal.id, ui: (proposal as any).ui ?? [] } });
    await emit({ type: EventType.RUN_FINISHED, threadId: job.projectId, runId: job.id });
  } catch (error) {
    const aborted = controller.signal.aborted;
    const current = await db.collection('jobs').findOne({ id: job.id });
    const canceled = current?.status === 'canceled';
    const message = canceled
      ? 'Run canceled'
      : aborted
        ? 'The provider did not respond in time'
        : error instanceof ProviderError || error instanceof Error
          ? error.message
          : 'Generation failed';
    await emit({ type: EventType.RUN_ERROR, message });
    const retry = !canceled && (aborted || (error instanceof ProviderError && error.retryable)) && job.attempts < maxAttempts;
    await db.collection('jobs').updateOne(
      { id: job.id, lease, status: 'running' },
      retry
        ? { $set: { status: 'queued', error: message, availableAt: new Date(Date.now() + 5000 * job.attempts) } }
        : { $set: { status: 'failed', error: message, finishedAt: new Date().toISOString() } },
    );
  } finally {
    clearTimeout(timeout);
    clearInterval(monitor);
  }
}

/** Processes at most one job. Returns false when the queue is empty. */
export async function runOnce() {
  const claimed = await claimJob();
  if (!claimed) return false;
  await processJob(claimed.job, claimed.lease);
  return true;
}
