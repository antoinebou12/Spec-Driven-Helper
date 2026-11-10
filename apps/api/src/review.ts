import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from './db';
import { audit } from './security';
import { HttpError, projectFor, previewChanges, saveSpec, staleWrite, writeReviewedSpec } from './projects';
import { insertMissingTechnologies, openConflicts } from './specs';
import { createTasksForBaseline } from './board';
import type { Auth } from './auth-types';
import { applySpecPatch, isComplete, patchConflicts, readiness, sectionNeedsReview } from '../../../packages/shared/src/domain';
import { listOf, rowsOf } from '../../../packages/shared/src/markdown';
import { moduleQuestions, modules, questionIn, tableKinds } from '../../../packages/shared/src/templates';
import type { GeneratedUI, Proposal, Spec } from '../../../packages/shared/src/schema';

/** The required questions of a section that are not answered yet (a section is reviewed only without them). */
const missingRequired = (spec: Spec, sectionId: string) => {
  const section = spec.sections.find((s) => s.id === sectionId);
  const module = modules.find((m) => m.id === sectionId);
  return section && module ? moduleQuestions(module, spec).filter((q) => q.required && !isComplete(section.answers[q.id])) : [];
};

async function pendingProposal(projectId: string, proposalId: string) {
  const proposal = await db
    .collection<Proposal & Record<string, any>>('proposals')
    .findOne({ id: proposalId, projectId, status: 'pending' });
  if (!proposal) throw new HttpError(404, 'Pending proposal not found');
  return proposal;
}

export async function registerReviewRoutes(app: FastifyInstance, auth: Auth) {
  app.get('/api/v1/projects/:id/proposals', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id);
    return db
      .collection('proposals')
      .find({ projectId: req.params.id }, { projection: { _id: 0, remoteSpec: 0, technologies: 0 } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
  });
  app.post('/api/v1/projects/:id/proposals/:proposalId/accept', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const proposal = await pendingProposal(p.id, req.params.proposalId);
    if (proposal.conflicts?.length)
      throw new HttpError(409, 'Resolve each conflict explicitly before accepting');
    if (proposal.baseRevision !== p.spec.revision)
      await staleWrite(p.id, p.spec, proposal.baseRevision, proposal.patch);
    const spec = await saveSpec(req.user, p.id, proposal.baseRevision, proposal.patch, {
      origin: proposal.origin === 'manual' ? 'review' : proposal.origin,
      proposalId: proposal.id,
      jobId: proposal.jobId,
    });
    await db.collection('proposals').updateOne(
      { id: proposal.id, status: 'pending' },
      {
        $set: {
          status: 'accepted',
          acceptedRevision: spec.revision,
          decidedBy: req.user.id,
          decidedAt: new Date().toISOString(),
        },
      },
    );
    if (proposal.origin === 'import') await insertMissingTechnologies(proposal.technologies);
    if (proposal.origin === 'git' && proposal.remoteSpec)
      await db.collection('git').updateOne({ projectId: p.id }, { $set: { baseSpec: proposal.remoteSpec } });
    await audit(req.user.id, 'proposal.accepted', p.id, { proposalId: proposal.id, origin: proposal.origin });
    return spec;
  });
  app.post('/api/v1/projects/:id/proposals/:proposalId/reject', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const proposal = await pendingProposal(p.id, req.params.proposalId);
    const b = z.object({ reason: z.string().max(2000).default('') }).parse(req.body ?? {});
    await db.collection('proposals').updateOne(
      { id: proposal.id },
      { $set: { status: 'rejected', reason: b.reason, decidedBy: req.user.id, decidedAt: new Date().toISOString() } },
    );
    await audit(req.user.id, 'proposal.rejected', p.id, { proposalId: proposal.id });
    return p.spec;
  });
  /** Moves a stale proposal onto the current revision when nothing it touches changed since. */
  app.post('/api/v1/projects/:id/proposals/:proposalId/rebase', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const proposal = await pendingProposal(p.id, req.params.proposalId);
    if (proposal.baseRevision === p.spec.revision) return proposal;
    const base = (await db.collection('revisions').findOne({ projectId: p.id, revision: proposal.baseRevision }))
      ?.spec as Spec | undefined;
    if (!base) throw new HttpError(409, 'The base revision is unavailable; reject and regenerate this proposal');
    const conflicts = patchConflicts(base, p.spec, proposal.patch, applySpecPatch(base, proposal.patch, 'preview', { canReview: true }));
    if (conflicts.length)
      throw new HttpError(409, 'Newer edits overlap this proposal. Compare the versions before deciding.', {
        conflict: { baseRevision: proposal.baseRevision, currentRevision: p.spec.revision, overlapping: true, conflicts },
      });
    await db.collection('proposals').updateOne(
      { id: proposal.id },
      {
        $set: { baseRevision: p.spec.revision, changes: previewChanges(p.spec, proposal.patch) },
        $push: { rebases: { from: proposal.baseRevision, to: p.spec.revision, by: req.user.id, at: new Date().toISOString() } },
      } as any,
    );
    return { ...proposal, baseRevision: p.spec.revision };
  });
  /**
   * Applies a user's answer entered in a generated control. The control must belong to the
   * proposal and the value must fit the question, so generated interfaces cannot write
   * arbitrary fields.
   */
  app.post('/api/v1/projects/:id/proposals/:proposalId/controls/:index', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const proposal = await db
      .collection<Record<string, any>>('proposals')
      .findOne({ id: req.params.proposalId, projectId: p.id });
    const control: GeneratedUI | undefined = proposal?.ui?.[Number(req.params.index)];
    if (!control) throw new HttpError(404, 'Generated control not found');
    const b = z.object({ expectedRevision: z.number().int(), value: z.string().max(30000).default('') }).parse(req.body);
    const provenance = { origin: 'generated-ui' as const, proposalId: proposal!.id };
    if (control.kind === 'diagram')
      return saveSpec(req.user, p.id, b.expectedRevision, { sections: [{ id: control.questionId, diagram: control.code }] }, provenance);
    const question = questionIn(p.spec, control.questionId);
    const module = modules.find((m) => control.questionId.startsWith(`${m.id}.`));
    if (!question || !module || !moduleQuestions(module, p.spec).some((q) => q.id === question.id))
      throw new HttpError(400, 'This control no longer matches the template');
    if (!b.value.trim()) throw new HttpError(400, 'Enter an answer first');
    if (tableKinds.includes(question.kind) && !rowsOf(b.value)) throw new HttpError(400, 'Table answers must be rows of cells');
    if (control.kind === 'choice' && !control.options?.includes(b.value))
      throw new HttpError(400, 'Choose one of the offered options');
    if (control.kind === 'switch' && !['yes', 'no'].includes(b.value)) throw new HttpError(400, 'Answer yes or no');
    if (control.kind === 'multi') {
      const values = listOf(b.value);
      if (!values.length || values.some((v) => !control.options?.includes(v)))
        throw new HttpError(400, 'Choose from the offered options');
    }
    return saveSpec(
      req.user,
      p.id,
      b.expectedRevision,
      { sections: [{ id: module.id, answers: { [question.id]: { value: b.value, state: 'answered', reason: '' } } }] },
      provenance,
    );
  });

  app.post('/api/v1/projects/:id/review/:sectionId', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'review');
    const b = z.object({ expectedRevision: z.number().int() }).parse(req.body);
    const section = p.spec.sections.find((s) => s.id === req.params.sectionId);
    if (!section) throw new HttpError(404, 'Section not found');
    const missing = missingRequired(p.spec, section.id);
    if (missing.length)
      throw new HttpError(409, `Complete required answers before reviewing: ${missing.map((q) => q.id).join(', ')}`);
    const spec = await writeReviewedSpec(
      req.user,
      p,
      b.expectedRevision,
      (next) => {
        next.sections.find((s) => s.id === section.id)!.status = 'reviewed';
      },
      `Section ${section.id} reviewed`,
    );
    await audit(req.user.id, 'section.reviewed', p.id, { sectionId: section.id });
    return spec;
  });
  /** Reviewers clear the “needs review” flag and may accept requirements and decisions. */
  app.post('/api/v1/projects/:id/items/:itemId/review', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'review');
    const b = z
      .object({ expectedRevision: z.number().int(), status: z.enum(['draft', 'accepted', 'superseded']).optional() })
      .parse(req.body);
    if (!p.spec.items.some((i) => i.id === req.params.itemId)) throw new HttpError(404, 'Item not found');
    const spec = await writeReviewedSpec(
      req.user,
      p,
      b.expectedRevision,
      (next) => {
        const item = next.items.find((i) => i.id === req.params.itemId)!;
        item.needsReview = false;
        if (b.status) item.status = b.status;
      },
      `Item ${req.params.itemId} reviewed${b.status ? ` (${b.status})` : ''}`,
    );
    await audit(req.user.id, 'item.reviewed', p.id, { itemId: req.params.itemId, status: b.status });
    return spec;
  });

  app.get('/api/v1/projects/:id/baselines', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id);
    return db
      .collection('baselines')
      .find({ projectId: req.params.id }, { projection: { _id: 0, spec: 0 } })
      .sort({ approvedAt: -1 })
      .toArray();
  });
  app.get('/api/v1/projects/:id/baselines/:baselineId', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id);
    const baseline = await db
      .collection('baselines')
      .findOne({ id: req.params.baselineId, projectId: req.params.id }, { projection: { _id: 0 } });
    if (!baseline) throw new HttpError(404, 'Baseline not found');
    return baseline;
  });
  app.post('/api/v1/projects/:id/baselines', { preHandler: auth }, async (req: any) => {
    let p = await projectFor(req.user, req.params.id, 'review');
    const b = z
      .object({ expectedRevision: z.number().int(), note: z.string().max(2000), reviewAll: z.boolean().default(false) })
      .parse(req.body);
    if (p.spec.revision !== b.expectedRevision) await staleWrite(p.id, p.spec, b.expectedRevision, {});
    const conflicts = await openConflicts(p.id);
    if (b.reviewAll) {
      // One action for a reviewer: review every section that needs it and has its required answers, then
      // approve. Checked on the would-be-reviewed specification first, so nothing is written unless it passes.
      const toReview = p.spec.sections.filter((s) => s.status !== 'reviewed' && sectionNeedsReview(p.spec, s.id) && !missingRequired(p.spec, s.id).length);
      const reviewed = structuredClone(p.spec);
      for (const s of toReview) reviewed.sections.find((x) => x.id === s.id)!.status = 'reviewed';
      const after = readiness(reviewed, { openConflicts: conflicts });
      if (!after.ready) throw new HttpError(409, `Not ready: ${after.blockers.join('; ')}`, { blockers: after.blockers });
      if (toReview.length) {
        await writeReviewedSpec(req.user, p, b.expectedRevision, (next) => toReview.forEach((s) => (next.sections.find((x) => x.id === s.id)!.status = 'reviewed')), `${toReview.length} sections reviewed`);
        for (const s of toReview) await audit(req.user.id, 'section.reviewed', p.id, { sectionId: s.id, via: 'review-all' });
        p = await projectFor(req.user, req.params.id, 'review');
      }
    }
    const r = readiness(p.spec, { openConflicts: conflicts });
    if (!r.ready) throw new HttpError(409, `Not ready: ${r.blockers.join('; ')}`, { blockers: r.blockers });
    const baseline = {
      id: crypto.randomUUID(),
      projectId: p.id,
      revision: p.spec.revision,
      spec: p.spec,
      note: b.note,
      approvedBy: req.user.id,
      approvedAt: new Date().toISOString(),
    };
    // Baselines are insert-only: no route updates or deletes them.
    await db.collection('baselines').insertOne(baseline);
    await audit(req.user.id, 'baseline.approved', p.id, { baselineId: baseline.id, revision: p.spec.revision });
    // The specification is now correct, so the project is split into tasks without another click.
    const tasks = await createTasksForBaseline(p.id, baseline, req.user.id);
    const { spec: _omit, ...summary } = baseline;
    return { ...summary, tasks };
  });
}
