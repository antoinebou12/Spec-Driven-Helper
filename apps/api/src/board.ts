import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from './db';
import { audit, decrypt } from './security';
import { HttpError, projectFor } from './projects';
import type { Auth } from './auth-types';
import type { GitConfig } from './git';
import {
  applyPlanImport,
  boardSchema,
  cardSchema,
  mergeGenerated,
  parsePlanTasks,
  planTasksMarkdown,
  pullRequestRef,
  type Board,
  type Card,
  type PullRequestRef,
  type PullRequestStatus,
} from '../../../packages/shared/src/board';
import { breakIntoTasks, type TaskPlan } from '../../../packages/shared/src/task-plan';
import type { Spec, StackLayer } from '../../../packages/shared/src/schema';

const empty = (projectId: string): Board => ({ projectId, revision: 0, gaps: [], cards: [], updatedAt: '' });

export async function loadBoard(projectId: string): Promise<Board> {
  const stored = await db.collection('boards').findOne({ projectId }, { projection: { _id: 0 } });
  if (!stored) return empty(projectId);
  const parsed = boardSchema.safeParse(stored);
  return parsed.success ? parsed.data : { ...empty(projectId), ...(stored as object), cards: [] };
}

/** Revision-guarded board write; a stale revision returns 409 with the current board. */
export async function saveBoard(
  projectId: string,
  expectedRevision: number,
  cards: Card[],
  extra: Partial<Board> = {},
) {
  const current = await loadBoard(projectId);
  if (current.revision !== expectedRevision)
    throw new HttpError(409, 'The board changed since you loaded it', {
      baseRevision: expectedRevision,
      currentRevision: current.revision,
      board: current,
    });
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id)) throw new HttpError(400, `Duplicate card ${card.id}`);
    ids.add(card.id);
  }
  const next: Board = {
    ...current,
    ...extra,
    projectId,
    revision: expectedRevision + 1,
    cards,
    updatedAt: new Date().toISOString(),
  };
  if (expectedRevision === 0) await db.collection('boards').insertOne({ ...next });
  else {
    const result = await db
      .collection('boards')
      .updateOne({ projectId, revision: expectedRevision }, { $set: next });
    if (!result.matchedCount)
      throw new HttpError(409, 'The board changed since you loaded it', {
        baseRevision: expectedRevision,
        currentRevision: (await loadBoard(projectId)).revision,
      });
  }
  return next;
}

// ---- Tasks from the specification ----------------------------------------------------------
// "Correct" means a reviewer approved a baseline (which already requires full readiness), so the
// task plan is always made from a baseline, never from a draft.

export type Baseline = { id: string; revision: number; approvedAt: string; spec: Spec };
export type TaskChange = {
  added: string[];
  obsolete: string[];
  gaps: string[];
  summary: TaskPlan['summary'];
  /** The board revision after the change, or the current one for a preview. */
  revision: number;
  total: number;
};

export async function latestBaseline(projectId: string): Promise<Baseline | null> {
  return (await db
    .collection('baselines')
    .findOne({ projectId }, { sort: { approvedAt: -1 } })) as unknown as Baseline | null;
}

/** Technology names the specification chose, by stack layer. */
async function stackNames(spec: Spec) {
  const ids = [...new Set(spec.stack.map((e) => e.technologyId))];
  const found = ids.length
    ? await db
        .collection('technologies')
        .find({ id: { $in: ids } }, { projection: { id: 1, name: 1 } })
        .toArray()
    : [];
  const names = new Map(found.map((t) => [String(t.id), String(t.name)]));
  const byLayer: Partial<Record<StackLayer, string[]>> = {};
  for (const entry of spec.stack) {
    const name = names.get(entry.technologyId);
    if (name) byLayer[entry.layer] = [...new Set([...(byLayer[entry.layer] ?? []), name])];
  }
  return byLayer;
}

/** What the plan would add to the board and what it would mark obsolete, without saving. */
export async function previewTasks(projectId: string, baseline: Baseline) {
  const board = await loadBoard(projectId);
  const plan = breakIntoTasks(baseline.spec, { stack: await stackNames(baseline.spec) });
  return { board, plan, merged: mergeGenerated(board.cards, plan.cards) };
}

/** Saves the plan into the board, keeping every existing card (columns, assignees and pull requests stay). */
export async function createTasks(
  projectId: string,
  baseline: Baseline,
  expectedRevision: number,
): Promise<TaskChange & { board: Board }> {
  const { plan, merged } = await previewTasks(projectId, baseline);
  const board = await saveBoard(projectId, expectedRevision, merged.cards, {
    baselineId: baseline.id,
    baselineRevision: baseline.revision,
    gaps: plan.gaps.map((g) => g.slice(0, 500)),
  });
  return {
    board,
    added: merged.added,
    obsolete: merged.obsolete,
    gaps: plan.gaps,
    summary: plan.summary,
    revision: board.revision,
    total: board.cards.length,
  };
}

/**
 * Called when a baseline is approved. A board that changes at the same moment is retried once; if it
 * still conflicts, the approval stands and the Board's refresh action catches up. Never throws.
 */
export async function createTasksForBaseline(projectId: string, baseline: Baseline, userId: string) {
  let reason = 'the board kept changing';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const current = await loadBoard(projectId);
      const change = await createTasks(projectId, baseline, current.revision);
      await audit(userId, 'board.generated', projectId, {
        baselineId: baseline.id,
        added: change.added.length,
        obsolete: change.obsolete.length,
        via: 'baseline',
      });
      return {
        added: change.added.length,
        obsolete: change.obsolete.length,
        total: change.total,
        gaps: change.gaps,
      };
    } catch (error) {
      if (!(error instanceof HttpError && error.statusCode === 409)) {
        reason = error instanceof Error ? error.message.slice(0, 200) : 'unexpected error';
        break;
      }
    }
  }
  await audit(userId, 'board.generate-skipped', projectId, {
    baselineId: baseline.id,
    via: 'baseline',
    reason,
  });
  return null;
}

// ---- Pull request status -------------------------------------------------------------------

type Fetch = typeof fetch;
type Credentials = {
  github?: string;
  gitlab?: string;
  azure?: { username: string; secret: string };
};

async function getJson(fetcher: Fetch, url: string, headers: Record<string, string>) {
  const response = await fetcher(url, {
    headers: { Accept: 'application/json', ...headers },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('response too large');
  return JSON.parse(text);
}

/** Reads one pull request from GitHub, GitLab or Azure DevOps. Hosts are fixed by `pullRequestRef`. */
export async function fetchPullRequestStatus(
  url: string,
  ref: PullRequestRef,
  credentials: Credentials,
  fetcher: Fetch = fetch,
): Promise<PullRequestStatus> {
  const base: PullRequestStatus = {
    url,
    provider: ref.provider,
    state: 'unknown',
    title: '',
    checks: 'unknown',
    reviews: 'unknown',
  };
  try {
    if (ref.provider === 'github') {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (credentials.github) headers.Authorization = `Bearer ${credentials.github}`;
      const api = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
      const pr = await getJson(fetcher, `${api}/pulls/${ref.number}`, headers);
      const [runs, reviews] = await Promise.all([
        getJson(
          fetcher,
          `${api}/commits/${encodeURIComponent(pr.head?.sha ?? '')}/check-runs?per_page=100`,
          headers,
        ).catch(() => null),
        getJson(fetcher, `${api}/pulls/${ref.number}/reviews?per_page=100`, headers).catch(
          () => null,
        ),
      ]);
      const conclusions: string[] = (runs?.check_runs ?? []).map((r: any) =>
        r.status === 'completed' ? r.conclusion : 'pending',
      );
      const latest = new Map<string, string>();
      for (const r of reviews ?? [])
        if (r.user?.login && r.state !== 'COMMENTED') latest.set(r.user.login, r.state);
      const states = [...latest.values()];
      return {
        ...base,
        title: String(pr.title ?? ''),
        state: pr.merged
          ? 'merged'
          : pr.state === 'closed'
            ? 'closed'
            : pr.draft
              ? 'draft'
              : 'open',
        checks: !runs
          ? 'unknown'
          : !conclusions.length
            ? 'none'
            : conclusions.some((c) =>
                  ['failure', 'timed_out', 'cancelled', 'action_required'].includes(c),
                )
              ? 'failing'
              : conclusions.includes('pending')
                ? 'pending'
                : 'passing',
        reviews: !reviews
          ? 'unknown'
          : states.includes('CHANGES_REQUESTED')
            ? 'changes-requested'
            : states.includes('APPROVED')
              ? 'approved'
              : 'pending',
        updatedAt: pr.updated_at,
      };
    }
    if (ref.provider === 'gitlab') {
      const headers: Record<string, string> = credentials.gitlab
        ? { 'PRIVATE-TOKEN': credentials.gitlab }
        : {};
      const api = `https://gitlab.com/api/v4/projects/${encodeURIComponent(ref.project)}/merge_requests/${ref.number}`;
      const [mr, approvals] = await Promise.all([
        getJson(fetcher, api, headers),
        getJson(fetcher, `${api}/approvals`, headers).catch(() => null),
      ]);
      const pipeline = mr.head_pipeline?.status as string | undefined;
      return {
        ...base,
        title: String(mr.title ?? ''),
        state:
          mr.state === 'merged'
            ? 'merged'
            : mr.state === 'closed'
              ? 'closed'
              : mr.draft || mr.work_in_progress
                ? 'draft'
                : mr.state === 'opened'
                  ? 'open'
                  : 'unknown',
        checks: !pipeline
          ? 'none'
          : pipeline === 'success'
            ? 'passing'
            : ['failed', 'canceled'].includes(pipeline)
              ? 'failing'
              : 'pending',
        reviews: !approvals ? 'unknown' : approvals.approved ? 'approved' : 'pending',
        updatedAt: mr.updated_at,
      };
    }
    const headers: Record<string, string> = credentials.azure
      ? {
          Authorization: `Basic ${Buffer.from(`${credentials.azure.username}:${credentials.azure.secret}`).toString('base64')}`,
        }
      : {};
    const api = `https://dev.azure.com/${encodeURIComponent(ref.organization)}/${encodeURIComponent(ref.project)}/_apis/git/repositories/${encodeURIComponent(ref.repository)}/pullrequests/${ref.number}`;
    const [pr, statuses] = await Promise.all([
      getJson(fetcher, `${api}?api-version=7.1`, headers),
      getJson(fetcher, `${api}/statuses?api-version=7.1`, headers).catch(() => null),
    ]);
    const votes: number[] = (pr.reviewers ?? []).map((r: any) => Number(r.vote ?? 0));
    const statesOf: string[] = (statuses?.value ?? []).map((s: any) => String(s.state));
    return {
      ...base,
      title: String(pr.title ?? ''),
      state:
        pr.status === 'completed'
          ? 'merged'
          : pr.status === 'abandoned'
            ? 'closed'
            : pr.isDraft
              ? 'draft'
              : pr.status === 'active'
                ? 'open'
                : 'unknown',
      checks: !statuses
        ? 'unknown'
        : !statesOf.length
          ? 'none'
          : statesOf.some((s) => ['failed', 'error'].includes(s))
            ? 'failing'
            : statesOf.some((s) => s === 'pending')
              ? 'pending'
              : 'passing',
      reviews: votes.some((v) => v < 0)
        ? 'changes-requested'
        : votes.some((v) => v >= 5)
          ? 'approved'
          : 'pending',
      updatedAt: pr.closedDate ?? pr.creationDate,
    };
  } catch (error) {
    return {
      ...base,
      error: `Status unavailable (${error instanceof Error ? error.message : 'error'})`,
    };
  }
}

/** Uses the project's own Git and GitLab credentials only for the matching host and repository. */
async function credentialsFor(projectId: string): Promise<Credentials> {
  const credentials: Credentials = {};
  const git = (await db.collection('git').findOne({ projectId })) as unknown as GitConfig | null;
  if (git?.secret && git.provider === 'github') credentials.github = decrypt(git.secret);
  if (git?.secret && git.remoteUrl?.startsWith('https://dev.azure.com/'))
    credentials.azure = { username: git.username || 'pat', secret: decrypt(git.secret) };
  const gitlab = await db.collection('connectors').findOne({ projectId, id: 'gitlab' });
  if (gitlab?.secret) credentials.gitlab = decrypt(gitlab.secret);
  return credentials;
}

function sameRepository(ref: PullRequestRef, git: GitConfig | null) {
  return (
    ref.provider !== 'github' ||
    !git?.repository ||
    git.repository.toLowerCase() === `${ref.owner}/${ref.repo}`.toLowerCase()
  );
}

// ---- Routes ----------------------------------------------------------------------------------

const revision = z.object({ expectedRevision: z.number().int().nonnegative() });

export async function registerBoard(app: FastifyInstance, auth: Auth) {
  app.get('/api/v1/projects/:id/board', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'read');
    const baseline = await db
      .collection('baselines')
      .findOne(
        { projectId: p.id },
        { sort: { approvedAt: -1 }, projection: { id: 1, revision: 1, approvedAt: 1 } },
      );
    return {
      board: await loadBoard(p.id),
      latestBaseline: baseline
        ? { id: baseline.id, revision: baseline.revision, approvedAt: baseline.approvedAt }
        : null,
    };
  });

  // Creates or refreshes the task plan from the latest approved baseline; never deletes cards.
  // Approving a baseline does this already; this catches a board up or refreshes it by hand.
  app.post('/api/v1/projects/:id/board/generate', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = revision.parse(req.body);
    const baseline = await latestBaseline(p.id);
    if (!baseline) throw new HttpError(409, 'Approve a baseline before creating the board');
    const { board, added, obsolete, gaps, summary } = await createTasks(p.id, baseline, b.expectedRevision);
    await audit(req.user.id, 'board.generated', p.id, {
      baselineId: baseline.id,
      added: added.length,
      obsolete: obsolete.length,
      via: 'manual',
    });
    return { board, added, obsolete, gaps, summary };
  });

  // Replaces the card list (moves, edits, additions, removals) under the revision guard.
  app.put('/api/v1/projects/:id/board', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = revision.extend({ cards: z.array(cardSchema).max(2000) }).parse(req.body);
    return { board: await saveBoard(p.id, b.expectedRevision, b.cards) };
  });

  // Imports `.plan/tasks.md`; `preview: true` reports the effect without saving.
  app.post('/api/v1/projects/:id/board/import-plan', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = revision
      .extend({ markdown: z.string().min(1).max(500_000), preview: z.boolean().default(false) })
      .parse(req.body);
    const parsed = parsePlanTasks(b.markdown);
    const current = await loadBoard(p.id);
    const { cards, added, updated } = applyPlanImport(current.cards, parsed.cards);
    if (b.preview)
      return { board: current, added, updated, skipped: parsed.skipped, preview: true };
    const board = await saveBoard(p.id, b.expectedRevision, cards);
    await audit(req.user.id, 'board.plan-imported', p.id, {
      added: added.length,
      updated: updated.length,
      skipped: parsed.skipped.length,
    });
    return { board, added, updated, skipped: parsed.skipped, preview: false };
  });

  app.get(
    '/api/v1/projects/:id/board/export-plan',
    { preHandler: auth },
    async (req: any, reply) => {
      const p = await projectFor(req.user, req.params.id, 'read');
      const board = await loadBoard(p.id);
      reply
        .header('Content-Type', 'text/markdown; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="tasks.md"');
      return planTasksMarkdown(board.cards, `${p.spec.name} — tasks`);
    },
  );

  // Reads pull-request status on explicit request; results are advisory and never move cards.
  app.post(
    '/api/v1/projects/:id/board/pull-requests',
    { preHandler: auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req: any) => {
      const p = await projectFor(req.user, req.params.id, 'read');
      const board = await loadBoard(p.id);
      const urls = [...new Set(board.cards.flatMap((c) => c.pullRequests))].slice(0, 50);
      const credentials = await credentialsFor(p.id);
      const git = (await db
        .collection('git')
        .findOne({ projectId: p.id })) as unknown as GitConfig | null;
      const statuses = await Promise.all(
        urls.map((url) => {
          const ref = pullRequestRef(url)!;
          // A project's GitHub token is only sent to its own configured repository.
          return fetchPullRequestStatus(
            url,
            ref,
            sameRepository(ref, git) ? credentials : { ...credentials, github: undefined },
          );
        }),
      );
      return { statuses, checkedAt: new Date().toISOString() };
    },
  );
}
