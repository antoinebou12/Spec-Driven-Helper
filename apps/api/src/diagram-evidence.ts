import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';
import type { Auth } from './auth-types';
import { db } from './db';
import { createProposal, HttpError, projectFor } from './projects';
import { audit } from './security';
import { sectionEvidenceDiagram } from '../../../packages/shared/src/document-diagrams';

type WithMcp = <T>(run: (client: Client, allowed: string[]) => Promise<T>) => Promise<T>;

export function registerDiagramEvidence(app: FastifyInstance, auth: Auth, withMcp: WithMcp) {
  app.post('/api/v1/projects/:id/diagrams/evidence', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const body = z
      .object({
        sectionId: z.string().max(100),
        baseRevision: z.number().int().nonnegative(),
        confirm: z.literal(true),
      })
      .parse(req.body);
    if (p.spec.localOnly)
      throw new HttpError(403, 'External diagrams are disabled for local-only projects');
    if (body.baseRevision !== p.spec.revision)
      throw new HttpError(409, 'Reload the specification before generating diagrams');
    const section = p.spec.sections.find((s: { id: string }) => s.id === body.sectionId);
    if (!section) throw new HttpError(404, 'Section not found');
    if (section.diagram) return { status: 'existing' };
    const source = sectionEvidenceDiagram(p.spec, section.id);
    if (!source) return { status: 'empty' };
    const digest = createHash('sha256')
      .update(`${p.id}:${p.spec.revision}:${section.id}:${source}`)
      .digest('hex');
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const existing = await db.collection('proposals').findOne({ id, projectId: p.id });
    if (existing) return { status: existing.status, proposalId: id };
    return withMcp(async (client, allowed) => {
      const tool = (await client.listTools()).tools.find((t) => t.name === 'generate_uml');
      if (!allowed.includes('generate_uml') || !tool?.annotations?.readOnlyHint)
        throw new HttpError(403, 'Enable a read-only generate_uml tool in administration');
      await audit(req.user.id, 'diagram.evidence-requested', p.id, { sectionId: section.id });
      const result = await client.callTool(
        {
          name: tool.name,
          arguments: { diagram_type: 'mermaid', code: source, output_format: 'png' },
        },
        undefined,
        { timeout: 20000 },
      );
      // Never fetch a URL returned by a renderer or persist its executable/HTML output.
      const structured = result.structuredContent as { success?: boolean } | undefined;
      if (result.isError || structured?.success !== true)
        throw new HttpError(502, 'The MCP renderer did not confirm a successful render');
      const current = await projectFor(req.user, p.id, 'edit');
      if (current.spec.localOnly || current.spec.revision !== body.baseRevision)
        throw new HttpError(
          409,
          'The specification changed during rendering; reload and try again',
        );
      const proposal = await createProposal({
        id,
        spec: p.spec,
        projectId: p.id,
        createdBy: req.user.id,
        origin: 'agent',
        title: `${p.spec.language === 'fr' ? 'Carte des réponses' : 'Evidence map'}: ${section.id}.md`,
        patch: { sections: [{ id: section.id, diagram: source }] },
        assumptions: [
          p.spec.language === 'fr'
            ? 'Liens de regroupement uniquement, sans dépendances déduites. Libellés abrégés ; consulter les réponses complètes.'
            : 'Grouping links only, not inferred dependencies. Labels are abbreviated; consult the full answers.',
        ],
      });
      return { status: proposal.status, proposalId: proposal.id };
    });
  });
}
