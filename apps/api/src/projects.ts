import { db } from './db';
import { audit, type User } from './security';
import {
  applySpecPatch,
  can,
  diffSpecs,
  patchConflicts,
} from '../../../packages/shared/src/domain';
import { impliedAnswerChanges } from '../../../packages/shared/src/markdown';
import { modules } from '../../../packages/shared/src/templates';
import { validateGeneratedForm } from '../../../packages/shared/src/generated';
import {
  patchSchema,
  specSchema,
  type Conflict,
  type Proposal,
  type Role,
  type Source,
  type Spec,
  type SpecPatch,
} from '../../../packages/shared/src/schema';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type ProjectAccess = {
  id: string;
  spec: Spec;
  role: Role;
  members: Record<string, Role>;
  aiRunLimit: number;
  aiTokenBudget: number;
};
export async function projectFor(
  user: User,
  id: string,
  action: 'read' | 'edit' | 'review' | 'admin' = 'read',
): Promise<ProjectAccess> {
  const p = await db.collection('projects').findOne({ id });
  if (!p) throw new HttpError(404, 'Project not found');
  const role: Role | undefined = user.role === 'Owner' ? 'Owner' : p.members?.[user.id];
  if (!role || !can(role, action))
    throw new HttpError(403, 'You do not have permission for this action');
  return {
    id: p.id,
    role,
    // Normalized on read so records written by older versions always have every field.
    spec: (specSchema.safeParse(p.spec).data ?? p.spec) as Spec,
    members: p.members,
    aiRunLimit: p.aiRunLimit ?? 50,
    aiTokenBudget: p.aiTokenBudget ?? 2_000_000,
  };
}

export type Provenance = {
  origin: 'manual' | 'ai' | 'git' | 'import' | 'review' | 'generated-ui' | 'agent';
  proposalId?: string;
  jobId?: string;
  note?: string;
};

async function revisionSpec(projectId: string, revision: number) {
  const r = await db.collection('revisions').findOne({ projectId, revision });
  return (r?.spec as Spec | undefined) ?? undefined;
}

/**
 * A write based on a revision that is no longer current. The response carries every field the
 * write touches with its base, current and proposed values so the client can show a conflict
 * view; nothing is overwritten.
 */
export async function staleWrite(
  projectId: string,
  current: Spec,
  expectedRevision: number,
  patch: SpecPatch,
): Promise<never> {
  const base = await revisionSpec(projectId, expectedRevision);
  let conflicts: Conflict[] = [];
  if (base) {
    let yours: Spec | undefined;
    try {
      yours = applySpecPatch(base, patch, 'preview', { canReview: true });
    } catch {
      yours = undefined;
    }
    conflicts = patchConflicts(base, current, patch, yours);
  }
  throw new HttpError(409, 'This document changed. Compare the versions before saving.', {
    conflict: {
      baseRevision: expectedRevision,
      currentRevision: current.revision,
      overlapping: conflicts.length > 0,
      conflicts,
    },
  });
}

async function writeRevision(
  user: User,
  projectId: string,
  previous: Spec,
  next: Spec,
  provenance: Provenance,
  patch: SpecPatch = {},
) {
  const result = await db
    .collection('projects')
    .updateOne({ id: projectId, 'spec.revision': previous.revision }, { $set: { spec: next } });
  if (!result.modifiedCount) {
    // Another write landed between our read and this guarded update.
    const latest = await db.collection('projects').findOne({ id: projectId });
    await staleWrite(projectId, latest!.spec as Spec, previous.revision, patch);
  }
  const changes = diffSpecs(previous, next).map(({ path, kind }) => ({ path, kind }));
  await db.collection('revisions').insertOne({
    projectId,
    revision: next.revision,
    spec: next,
    author: user.id,
    at: next.updatedAt,
    provenance,
    changes,
  });
  await audit(user.id, 'spec.updated', projectId, {
    revision: next.revision,
    origin: provenance.origin,
    proposalId: provenance.proposalId,
  });
  return next;
}

export async function saveSpec(
  user: User,
  id: string,
  expectedRevision: number,
  patch: unknown,
  provenance: Provenance = { origin: 'manual' },
) {
  const p = await projectFor(user, id, 'edit');
  const parsed = patchSchema.parse(patch);
  if (p.spec.revision !== expectedRevision) await staleWrite(id, p.spec, expectedRevision, parsed);
  const spec = applySpecPatch(p.spec, parsed, user.id, { canReview: can(p.role, 'review') });
  await writeRevision(user, id, p.spec, spec, provenance, parsed);
  if (provenance.origin === 'manual') await proposeImpliedAnswers(user, p, parsed, spec);
  return spec;
}

/** Direct state changes that are not content edits (reviews), still revision-guarded. */
export async function writeReviewedSpec(
  user: User,
  p: ProjectAccess,
  expectedRevision: number,
  mutate: (spec: Spec) => void,
  note: string,
) {
  if (p.spec.revision !== expectedRevision) await staleWrite(p.id, p.spec, expectedRevision, {});
  const next: Spec = structuredClone(p.spec);
  mutate(next);
  next.revision = p.spec.revision + 1;
  next.updatedAt = new Date().toISOString();
  next.updatedBy = user.id;
  return writeRevision(user, p.id, p.spec, next, { origin: 'review', note });
}

/**
 * Markdown edits update stored content immediately. When an edit changes the text inside a
 * managed answer block, the implied structured change is proposed separately for review.
 */
async function proposeImpliedAnswers(user: User, p: ProjectAccess, patch: SpecPatch, spec: Spec) {
  const sections: NonNullable<SpecPatch['sections']> = [];
  for (const sp of patch.sections ?? []) {
    if (sp.markdown === undefined) continue;
    const section = spec.sections.find((s) => s.id === sp.id)!;
    const module = modules.find((m) => m.id === sp.id)!;
    const answers = impliedAnswerChanges(module, section.answers, section.markdown, spec.language, spec);
    if (Object.keys(answers).length) sections.push({ id: sp.id, answers });
  }
  if (!sections.length) return;
  await createProposal({
    spec,
    projectId: p.id,
    createdBy: user.id,
    origin: 'manual',
    title: `Structured answers implied by Markdown edits (${sections.map((s) => s.id).join(', ')})`,
    patch: { sections },
    assumptions: [
      'The document text inside an answer block no longer matches the structured answer. Accept to update the answer, or reject to keep it.',
    ],
  });
}

/** Changes a patch would make, validated by applying it to a copy. */
export function previewChanges(spec: Spec, patch: SpecPatch) {
  return diffSpecs(spec, applySpecPatch(spec, patchSchema.parse(patch), 'preview', { canReview: true }));
}

export async function createProposal(input: {
  spec: Spec;
  projectId: string;
  createdBy: string;
  origin: Proposal['origin'];
  title: string;
  patch: SpecPatch;
  assumptions?: string[];
  sources?: Source[];
  ui?: unknown;
  id?: string;
  extra?: Record<string, unknown>;
}) {
  const patch = patchSchema.parse(input.patch);
  // Dry run: the proposal must apply cleanly to its base revision.
  const changes = previewChanges(input.spec, patch);
  const generated = validateGeneratedForm(input.ui, input.spec);
  const proposal = {
    id: input.id ?? crypto.randomUUID(),
    projectId: input.projectId,
    baseRevision: input.spec.revision,
    title: input.title.slice(0, 300),
    patch,
    assumptions: input.assumptions ?? [],
    sources: input.sources ?? [],
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    origin: input.origin,
    changes,
    ...(generated.ok && generated.controls.length ? { ui: generated.controls } : {}),
    ...(!generated.ok ? { uiRejected: generated.reason } : {}),
    ...input.extra,
  };
  await db
    .collection('proposals')
    .updateOne({ id: proposal.id }, { $setOnInsert: proposal }, { upsert: true });
  return proposal;
}
