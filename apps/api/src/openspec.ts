import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { canonicalJson } from '../../../packages/shared/src/domain';
import { applyPlanImport } from '../../../packages/shared/src/board';
import { openspecLimits } from '../../../packages/shared/src/openspec-format';
import { openSpecFiles } from '../../../packages/shared/src/openspec-export';
import { planOpenSpecImport } from '../../../packages/shared/src/openspec-import';
import { db } from './db';
import { audit } from './security';
import { createProposal, HttpError, previewChanges, projectFor } from './projects';
import { features, requireFeature } from './features';
import { loadBoard, saveBoard } from './board';
import type { Auth } from './auth-types';

const requestSchema = z.object({
  files: z
    .record(z.string().max(500), z.string())
    .refine((v) => Object.keys(v).length <= openspecLimits.files),
  selectedChange: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  baseRevision: z.number().int().nonnegative(),
  preview: z.boolean().default(true),
  action: z.enum(['specification', 'board']).default('specification'),
  expectedBoardRevision: z.number().int().nonnegative().optional(),
});

export async function registerOpenSpec(app: FastifyInstance, auth: Auth) {
  app.get('/api/v1/projects/:id/openspec', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'read');
    const { draft, validated, diagnostics } = openSpecFiles(p.spec);
    return { revision: p.spec.revision, draft, validated, diagnostics };
  });
  app.post(
    '/api/v1/projects/:id/openspec/import',
    { preHandler: auth, bodyLimit: openspecLimits.totalBytes * 2 },
    async (req: any) => {
      await requireFeature('import');
      const p = await projectFor(req.user, req.params.id, 'edit');
      const b = requestSchema.parse(req.body);
      const guard = (current: number) => {
        if (current !== b.baseRevision)
          throw new HttpError(409, 'The specification changed. Preview again.', {
            baseRevision: b.baseRevision,
            currentRevision: current,
            overlapping: [],
            conflicts: [],
          });
      };
      guard(p.spec.revision);
      let content;
      try {
        content = planOpenSpecImport(p.spec, b.files, b.selectedChange);
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
      const boardOn = (await features()).board;
      const board = await loadBoard(p.id);
      // Retain dependencies, assignees and PRs when external checklists omit them.
      const imported = content.cards.map((c) => {
        const old = board.cards.find((x) => x.id === c.id);
        return old ? { ...c, dependsOn: [...new Set([...old.dependsOn, ...c.dependsOn])] } : c;
      });
      const merged = applyPlanImport(board.cards, imported);
      const summary = {
        preview: b.preview,
        revision: p.spec.revision,
        changes: content.changes,
        selectedChange: content.selectedChange,
        diagnostics: content.diagnostics,
        recognised: content.recognised,
        sources: content.sources,
        specification: { patch: content.patch, changes: previewChanges(p.spec, content.patch) },
        board: {
          enabled: boardOn,
          added: merged.added,
          updated: merged.updated,
          cards: content.cards,
          revision: board.revision,
        },
      };
      if (b.preview) return summary;
      if (content.diagnostics.some((d) => d.severity === 'error'))
        throw new HttpError(422, 'Resolve the import diagnostics first.', {
          diagnostics: content.diagnostics,
        });
      guard((await projectFor(req.user, p.id, 'edit')).spec.revision);
      if (b.action === 'board') {
        await requireFeature('board');
        if (merged.cards.length > 2000)
          throw new HttpError(422, 'The merged board exceeds 2000 cards.');
        if (b.expectedBoardRevision === undefined)
          throw new HttpError(400, 'Send expectedBoardRevision from the preview.');
        if (b.expectedBoardRevision !== board.revision)
          throw new HttpError(409, 'The board changed. Preview again.', {
            baseRevision: b.expectedBoardRevision,
            currentRevision: board.revision,
          });
        const updated =
          merged.added.length || merged.updated.length
            ? await saveBoard(p.id, b.expectedBoardRevision, merged.cards)
            : board;
        await audit(req.user.id, 'openspec.board-imported', p.id, {
          added: merged.added,
          updated: merged.updated,
        });
        return { ...summary, board: { ...summary.board, revision: updated.revision } };
      }
      let proposalId: string | null = null;
      if (summary.specification.changes.length || Object.keys(content.sources).length) {
        const hash = createHash('sha256')
          .update(
            canonicalJson({
              project: p.id,
              revision: p.spec.revision,
              patch: content.patch,
              sources: content.sources,
            }),
          )
          .digest('hex');
        const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
        const existing = await db.collection('proposals').findOne({ id, projectId: p.id });
        if (existing) proposalId = id;
        else {
          const proposal = await createProposal({
            id,
            spec: p.spec,
            projectId: p.id,
            createdBy: req.user.id,
            origin: 'import',
            title: p.spec.language === 'fr' ? 'Importer OpenSpec' : 'Import OpenSpec',
            patch: content.patch,
            assumptions: [
              p.spec.language === 'fr'
                ? 'Sources non fiables. Les états de révision et les approbations ne sont pas importés.'
                : 'Sources are untrusted. Review states and approvals are not imported.',
            ],
            extra: { openSpecSources: content.sources },
          });
          proposalId = proposal.id;
        }
        await audit(req.user.id, 'openspec.proposed', p.id, {
          proposalId,
          revision: p.spec.revision,
        });
      }
      return { ...summary, proposalId };
    },
  );
}
