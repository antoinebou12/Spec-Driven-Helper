import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import JSZip from 'jszip';
import { audit } from './security';
import { HttpError, createProposal, previewChanges, projectFor } from './projects';
import { planFolderFiles } from './exports';
import { importPatch, technologiesFor } from './specs';
import { loadBoard, saveBoard } from './board';
import { features } from './features';
import type { Auth } from './auth-types';
import { importSchema, patchSchema, type Spec, type SpecPatch } from '../../../packages/shared/src/schema';
import { validateSpec } from '../../../packages/shared/src/domain';
import { applyPlanImport } from '../../../packages/shared/src/board';
import { readPlanFolder, planFolderLimits } from '../../../packages/shared/src/plan-folder';

/** Specification patch from the folder: the full bundle when present, otherwise the section documents. */
function specPatchFrom(spec: Spec, content: ReturnType<typeof readPlanFolder>): { patch: SpecPatch | null; source: string; problem?: string } {
  if (content.bundle) {
    const bundle = importSchema.safeParse(content.bundle);
    if (!bundle.success) return { patch: null, source: '.plan/specification.json', problem: `.plan/specification.json: ${bundle.error.issues[0]?.message ?? 'invalid bundle'}` };
    try {
      return { patch: importPatch(spec, validateSpec(bundle.data.spec)), source: '.plan/specification.json' };
    } catch (e) {
      return { patch: null, source: '.plan/specification.json', problem: `.plan/specification.json: ${(e as Error).message}` };
    }
  }
  const sections = Object.entries(content.sections)
    .filter(([id, markdown]) => {
      const local = spec.sections.find((s) => s.id === id);
      return local && local.markdown !== markdown;
    })
    .map(([id, markdown]) => ({ id, markdown }));
  return { patch: sections.length ? patchSchema.parse({ sections }) : null, source: '.plan/spec/*.md' };
}

export async function registerPlanFolder(app: FastifyInstance, auth: Auth) {
  app.get('/api/v1/projects/:id/plan-folder', { preHandler: auth }, async (req: any, reply) => {
    const p = await projectFor(req.user, req.params.id, 'read');
    const cards = (await features()).board ? (await loadBoard(p.id)).cards : [];
    const zip = new JSZip();
    for (const [path, content] of Object.entries(planFolderFiles(p.spec, await technologiesFor(p.spec), cards))) zip.file(path, content);
    const slug = p.spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
    reply.header('Content-Disposition', `attachment; filename="${slug}-plan-r${p.spec.revision}.zip"`).type('application/zip');
    return reply.send(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  });

  // Reads a .plan folder: the specification becomes a proposal, tasks and backlog merge into the board.
  app.post('/api/v1/projects/:id/plan-folder/import', { preHandler: auth, bodyLimit: planFolderLimits.totalBytes * 2 }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = z
      .object({
        files: z.record(z.string().max(500), z.string()),
        preview: z.boolean().default(true),
        expectedBoardRevision: z.number().int().nonnegative().optional(),
      })
      .parse(req.body);
    let content: ReturnType<typeof readPlanFolder>;
    try {
      content = readPlanFolder(b.files);
    } catch (e) {
      throw new HttpError(413, (e as Error).message);
    }
    const skipped = [...content.skipped];

    const spec = specPatchFrom(p.spec, content);
    if (spec.problem) skipped.push(spec.problem);
    const changes = spec.patch ? previewChanges(p.spec, spec.patch) : [];

    const boardOn = (await features()).board;
    if (content.cards.length && !boardOn) skipped.push('Board cards: the implementation board feature is disabled');
    const board = await loadBoard(p.id);
    const merged = boardOn && content.cards.length ? applyPlanImport(board.cards, content.cards) : null;

    const summary = {
      recognised: content.recognised,
      skipped,
      specification: { source: spec.patch ? spec.source : null, changes: changes.length },
      board: { from: content.cardsFrom, added: merged?.added ?? [], updated: merged?.updated ?? [], revision: board.revision },
    };
    if (b.preview) return { ...summary, preview: true };

    let proposalId: string | null = null;
    if (spec.patch && changes.length) {
      const proposal = await createProposal({
        spec: p.spec,
        projectId: p.id,
        createdBy: req.user.id,
        origin: 'import',
        title: `Import .plan folder (${spec.source})`,
        patch: spec.patch,
        assumptions: ['Imported .plan content is untrusted until reviewed. Review states are not imported.'],
      });
      proposalId = proposal.id;
    }
    let boardRevision = board.revision;
    if (merged && (merged.added.length || merged.updated.length)) {
      if (b.expectedBoardRevision === undefined) throw new HttpError(400, 'Send expectedBoardRevision from the preview to update the board');
      boardRevision = (await saveBoard(p.id, b.expectedBoardRevision, merged.cards)).revision;
    }
    await audit(req.user.id, 'plan-folder.imported', p.id, { proposalId, cardsAdded: merged?.added.length ?? 0, cardsUpdated: merged?.updated.length ?? 0, files: content.recognised.length });
    return { ...summary, preview: false, proposalId, board: { ...summary.board, revision: boardRevision } };
  });
}
