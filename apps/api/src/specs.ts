import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, assets } from './db';
import { audit, type User } from './security';
import { enforceRolePolicy } from './role-guard';
import { memberRemovalDenial, roleChangeDenial } from '../../../packages/shared/src/role-policy';
import { HttpError, projectFor, saveSpec, createProposal } from './projects';
import { implementationZip, serialize, exportFormats, exportMime, fileName, specKitZip, skillZip, agentsZip } from './exports';
import { publisherPdf } from './pdf-publisher';
import { openSpecZip } from './exports';
import { loadBoard } from './board';
import { features, requireFeature } from './features';
import type { Auth } from './auth-types';
import { can, canonicalJson, createSpec, readiness, validateSpec } from '../../../packages/shared/src/domain';
import { buildExampleSpec } from '../../../packages/shared/src/example';
import { parseBundleText } from '../../../packages/shared/src/bundle-formats';
import { preferredVersion } from '../../../packages/shared/src/stack';
import { catalogSeed, seedSlugs } from './catalog-seed';
import {
  importSchema,
  patchSchema,
  roleSchema,
  type Bundle,
  type Spec,
  type SpecPatch,
  type Technology,
} from '../../../packages/shared/src/schema';

const idParam = z.object({ id: z.string().uuid() });

/** Stack of the example project, using seeded catalog entries. */
export function exampleStack(): Spec['stack'] {
  const pick = (slug: string, layer: Spec['stack'][number]['layer']) => {
    const tech = catalogSeed.find((t) => t.id === seedSlugs.get(slug));
    return tech ? [{ technologyId: tech.id, layer, version: preferredVersion(tech, true), note: '' }] : [];
  };
  return [
    ...pick('react', 'frontend'),
    ...pick('typescript', 'frontend'),
    ...pick('nodejs', 'backend'),
    ...pick('fastify', 'backend'),
    ...pick('postgresql', 'data'),
    ...pick('rest', 'communication'),
    ...pick('openapi', 'contracts'),
    ...pick('json-schema', 'contracts'),
    ...pick('kubernetes', 'infrastructure'),
    ...pick('azure', 'infrastructure'),
    ...pick('ubuntu', 'infrastructure'),
    ...pick('github-actions', 'cicd'),
    ...pick('vitest', 'testing'),
    ...pick('playwright', 'testing'),
    ...pick('opentelemetry', 'observability'),
  ];
}

export async function openConflicts(projectId: string) {
  return db
    .collection('proposals')
    .countDocuments({ projectId, status: 'pending', 'conflicts.0': { $exists: true } });
}
export async function technologiesFor(spec: Spec) {
  return (await db
    .collection('technologies')
    .find({ id: { $in: spec.technologyIds } }, { projection: { _id: 0 } })
    .toArray()) as unknown as Technology[];
}
/** Adds catalog entries referenced by an imported bundle without overwriting existing ones. */
export async function insertMissingTechnologies(technologies: Technology[] = []) {
  for (const t of technologies)
    await db.collection('technologies').updateOne({ id: t.id }, { $setOnInsert: t }, { upsert: true });
}
async function insertProject(user: User, spec: Spec, provenance: string) {
  await db.collection('projects').insertOne({
    id: spec.id,
    spec,
    members: { [user.id]: 'Owner' },
    aiRunLimit: 50,
    aiTokenBudget: 2_000_000,
  });
  await db.collection('revisions').insertOne({
    projectId: spec.id,
    revision: spec.revision,
    spec,
    author: user.id,
    at: spec.updatedAt,
    provenance: { origin: provenance },
    changes: [],
  });
  await audit(user.id, 'project.created', spec.id, { provenance });
}

/**
 * Minimal patch that makes the current specification match an imported one. Only real
 * differences are included, so the proposal shows exactly what changes and can be rebased
 * when unrelated edits land first.
 */
export function importPatch(current: Spec, incoming: Spec): SpecPatch {
  const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  const patch: SpecPatch = {};
  for (const key of ['name', 'description', 'projectType', 'technologyIds', 'technologyDecisions'] as const)
    if (!same(current[key], incoming[key])) (patch as any)[key] = incoming[key];
  for (const s of incoming.sections) {
    const local = current.sections.find((x) => x.id === s.id)!;
    const sp: NonNullable<SpecPatch['sections']>[number] = { id: s.id };
    for (const field of ['markdown', 'diagram', 'references'] as const)
      if (!same(local[field], s[field])) (sp as any)[field] = s[field];
    const answers = Object.fromEntries(Object.entries(s.answers).filter(([id, a]) => !same(local.answers[id], a)));
    if (Object.keys(answers).length) sp.answers = answers;
    if (Object.keys(sp).length > 1) (patch.sections ??= []).push(sp);
  }
  const items = incoming.items.filter((i) => !same(current.items.find((x) => x.id === i.id), i));
  if (items.length) patch.items = items;
  const removeItems = current.items.filter((i) => !incoming.items.some((x) => x.id === i.id)).map((i) => i.id);
  if (removeItems.length) patch.removeItems = removeItems;
  const links = incoming.links.filter((l) => !same(current.links.find((x) => x.id === l.id), l));
  if (links.length) patch.links = links;
  const removeLinks = current.links.filter((l) => !incoming.links.some((x) => x.id === l.id)).map((l) => l.id);
  if (removeLinks.length) patch.removeLinks = removeLinks;
  return patchSchema.parse(patch);
}

export async function registerSpecRoutes(app: FastifyInstance, auth: Auth) {
  app.get('/api/v1/projects', { preHandler: auth }, async (req: any) => {
    const query = req.user.role === 'Owner' ? {} : { [`members.${req.user.id}`]: { $exists: true } };
    return (await db.collection('projects').find(query).sort({ 'spec.name': 1 }).toArray()).map((p) => ({
      id: p.id,
      name: p.spec.name,
      description: p.spec.description,
      projectType: p.spec.projectType,
      revision: p.spec.revision,
      language: p.spec.language,
      role: req.user.role === 'Owner' ? 'Owner' : p.members[req.user.id],
      percent: readiness(p.spec).percent,
    }));
  });
  app.post('/api/v1/projects', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'edit')) throw new HttpError(403, 'Editor access required');
    const b = z
      .object({
        name: z.string().min(1).max(120),
        language: z.enum(['en', 'fr']).default('en'),
        example: z.boolean().default(false),
        sample: z.boolean().default(false),
        projectType: z.string().max(100).default('Web application'),
        description: z.string().max(3000).default(''),
        localOnly: z.boolean().default(false),
        // The API keeps the complete level unless asked; the new-project dialog asks for essentials.
        level: z.enum(['essentials', 'complete']).default('complete'),
      })
      .parse(req.body);
    const id = crypto.randomUUID();
    const spec = b.sample
      ? buildExampleSpec(id, b.language, exampleStack())
      : createSpec(id, b.name, b.language, b.example, b.projectType);
    spec.name = b.name;
    if (!b.sample) {
      spec.description = b.description;
      spec.level = b.level;
    }
    spec.localOnly = b.localOnly;
    spec.updatedBy = req.user.id;
    await insertProject(req.user, validateSpec(spec), b.sample ? 'example' : 'created');
    return spec;
  });
  app.post('/api/v1/projects/import', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'edit')) throw new HttpError(403, 'Editor access required');
    const bundle: Bundle = importSchema.parse(req.body);
    const spec = validateSpec(bundle.spec);
    if (await db.collection('projects').findOne({ id: spec.id }))
      throw new HttpError(409, 'This project already exists. Import the file into it to review changes.');
    if (await db.collection('revisions').findOne({ projectId: spec.id }))
      throw new HttpError(409, 'This project identifier was used before in this workspace and cannot be reused.');
    // Content and identifiers are preserved exactly. Review attestations are workspace-local:
    // sections must be reviewed again here, and only reviewers keep items accepted.
    spec.sections.forEach((s) => (s.status = 'draft'));
    if (!can(req.user.role, 'review'))
      spec.items.forEach((i) => i.status === 'accepted' && (i.status = 'draft'));
    spec.updatedAt = new Date().toISOString();
    spec.updatedBy = req.user.id;
    await insertMissingTechnologies(bundle.technologies);
    await insertProject(req.user, spec, 'import');
    return spec;
  });
  app.get('/api/v1/projects/:id', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, idParam.parse(req.params).id);
    const [conflicts, pending] = await Promise.all([
      openConflicts(p.id),
      db.collection('proposals').countDocuments({ projectId: p.id, status: 'pending' }),
    ]);
    return {
      spec: p.spec,
      role: p.role,
      readiness: readiness(p.spec, { openConflicts: conflicts }),
      pendingProposals: pending,
    };
  });
  app.patch('/api/v1/projects/:id', { preHandler: auth }, async (req: any) => {
    const b = z.object({ expectedRevision: z.number().int(), patch: patchSchema }).parse(req.body);
    return saveSpec(req.user, idParam.parse(req.params).id, b.expectedRevision, b.patch);
  });
  app.get('/api/v1/projects/:id/history', { preHandler: auth }, async (req: any) => {
    const { id } = idParam.parse(req.params);
    await projectFor(req.user, id);
    const revisions = await db
      .collection('revisions')
      .find({ projectId: id }, { projection: { _id: 0, spec: 0 } })
      .sort({ revision: -1 })
      .limit(200)
      .toArray();
    const users = await db
      .collection<User>('users')
      .find({ id: { $in: [...new Set(revisions.map((r) => r.author))] } })
      .toArray();
    return revisions.map((r) => ({ ...r, authorName: users.find((u) => u.id === r.author)?.name ?? 'System' }));
  });
  app.get('/api/v1/projects/:id/revisions/:revision', { preHandler: auth }, async (req: any) => {
    const { id } = idParam.parse(req.params);
    await projectFor(req.user, id);
    const revision = z.coerce.number().int().parse(req.params.revision);
    const r = await db.collection('revisions').findOne({ projectId: id, revision }, { projection: { _id: 0 } });
    if (!r) throw new HttpError(404, 'Revision not found');
    return r;
  });
  app.get('/api/v1/projects/:id/members', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id);
    const users = await db
      .collection<User>('users')
      .find({ id: { $in: Object.keys(p.members) } })
      .toArray();
    return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: p.members[u.id] }));
  });
  app.post('/api/v1/projects/:id/members', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'admin');
    const b = z.object({ email: z.string().email(), role: roleSchema }).parse(req.body);
    const u = await db.collection<User>('users').findOne({ email: b.email.toLowerCase(), disabled: { $ne: true } });
    if (!u) throw new HttpError(404, 'Invite this person to the workspace first');
    // Project ownership belongs to the creator and is never granted; only an owner grants or changes administrators.
    await enforceRolePolicy(roleChangeDenial({ actor: p.role, actorId: req.user.id, targetId: u.id, targetRole: p.members[u.id], next: b.role }), 'project', req.user.id, { userId: u.id, from: p.members[u.id], to: b.role }, p.id);
    if (p.members[u.id] === b.role) return { ok: true };
    if (p.members[u.id] === 'Owner' && b.role !== 'Owner') {
      const owners = Object.values(p.members).filter((r) => r === 'Owner').length;
      if (owners <= 1) throw new HttpError(409, 'A project always keeps its owner');
    }
    await db.collection('projects').updateOne({ id: p.id }, { $set: { [`members.${u.id}`]: b.role } });
    await audit(req.user.id, 'membership.updated', p.id, { userId: u.id, role: b.role });
    return { ok: true };
  });
  app.delete('/api/v1/projects/:id/members/:userId', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'admin');
    await enforceRolePolicy(memberRemovalDenial({ actor: p.role, actorId: req.user.id, targetId: req.params.userId, targetRole: p.members[req.params.userId] }), 'project', req.user.id, { userId: req.params.userId, action: 'remove' }, p.id);
    if (p.members[req.params.userId] === 'Owner')
      throw new HttpError(409, 'A project always keeps its owner');
    await db.collection('projects').updateOne({ id: p.id }, { $unset: { [`members.${req.params.userId}`]: '' } });
    await audit(req.user.id, 'membership.removed', p.id, { userId: req.params.userId });
    return { ok: true };
  });
  app.get('/api/v1/projects/:id/settings', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id);
    return { aiRunLimit: p.aiRunLimit, aiTokenBudget: p.aiTokenBudget, localOnly: p.spec.localOnly };
  });
  app.put('/api/v1/projects/:id/settings', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'admin');
    const b = z
      .object({
        aiRunLimit: z.number().int().min(0).max(10000),
        aiTokenBudget: z.number().int().min(0).max(1_000_000_000),
      })
      .parse(req.body);
    await db.collection('projects').updateOne({ id: p.id }, { $set: b });
    await audit(req.user.id, 'project.budget-updated', p.id, b);
    return b;
  });

  app.post('/api/v1/projects/:id/import', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    // A JSON bundle as the body, or { toon: "<TOON text>" } for a TOON export.
    let raw: unknown = req.body;
    if (typeof req.body?.toon === 'string') {
      try {
        raw = parseBundleText(req.body.toon, 'toon');
      } catch (e) {
        throw new HttpError(400, (e as Error).message);
      }
    }
    const bundle = importSchema.parse(raw);
    const incoming = validateSpec(bundle.spec);
    const proposal = await createProposal({
      spec: p.spec,
      projectId: p.id,
      createdBy: req.user.id,
      origin: 'import',
      title: `Import ${incoming.name} (revision ${incoming.revision})`,
      patch: importPatch(p.spec, incoming),
      assumptions: [
        'Imported content is untrusted until reviewed. Review states are not imported.',
        'Existing catalog entries are never overwritten; missing referenced entries are added on acceptance.',
      ],
      extra: { technologies: bundle.technologies },
    });
    await audit(req.user.id, 'import.staged', p.id, { proposalId: proposal.id });
    return proposal;
  });
  const sendExport = async (reply: any, spec: Spec, format: string, label: string) => {
    const f = z.enum(exportFormats).parse(format);
    const technologies = await technologiesFor(spec);
    if (f === 'pdf') await requireFeature('reports');
    reply.header('Content-Disposition', `attachment; filename="${fileName(spec, f, label)}"`).type(exportMime[f]);
    if (f === 'zip') return reply.send(await implementationZip(spec, technologies));
    if (f === 'speckit') return reply.send(await specKitZip(spec, technologies));
    if (f === 'openspec') {
      await requireFeature('openspec');
      const cards = label.startsWith('baseline-') || !(await features()).board ? [] : (await loadBoard(spec.id)).cards;
      return reply.send(await openSpecZip(spec, cards));
    }
    if (f === 'skill') return reply.send(await skillZip(spec));
    if (f === 'agents') return reply.send(await agentsZip(spec));
    if (f === 'pdf') return reply.send(await publisherPdf(spec));
    // Rendered documents are inert: no scripts, no external loads, even if opened from the API origin.
    if (f === 'html' || f === 'svg') reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    return reply.send(serialize(spec, f, technologies));
  };
  app.get('/api/v1/projects/:id/export/:format', { preHandler: auth }, async (req: any, reply) => {
    const p = await projectFor(req.user, req.params.id);
    if (req.params.format === 'openspec' && req.query.expectedRevision !== undefined) {
      const expected = z.coerce.number().int().nonnegative().parse(req.query.expectedRevision);
      if (expected !== p.spec.revision) throw new HttpError(409, 'The specification changed. Check export diagnostics again.', { baseRevision: expected, currentRevision: p.spec.revision });
    }
    await audit(req.user.id, 'export.downloaded', p.id, { format: req.params.format, revision: p.spec.revision });
    return sendExport(reply, p.spec, req.params.format, `r${p.spec.revision}`);
  });
  app.get(
    '/api/v1/projects/:id/baselines/:baselineId/export/:format',
    { preHandler: auth },
    async (req: any, reply) => {
      const p = await projectFor(req.user, req.params.id);
      const baseline = await db.collection('baselines').findOne({ id: req.params.baselineId, projectId: p.id });
      if (!baseline) throw new HttpError(404, 'Baseline not found');
      await audit(req.user.id, 'export.downloaded', p.id, { format: req.params.format, baselineId: baseline.id });
      return sendExport(reply, baseline.spec as Spec, req.params.format, `baseline-r${baseline.spec.revision}`);
    },
  );
  app.post('/api/v1/projects/:id/assets', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id, 'edit');
    const b = z
      .object({
        name: z.string().max(200),
        data: z.string().max(2_500_000),
        mime: z.enum(['image/png', 'image/jpeg', 'text/plain']),
      })
      .parse(req.body);
    const data = Buffer.from(b.data, 'base64');
    const signature = data.subarray(0, 4).toString('hex');
    if ((b.mime === 'image/png' && signature !== '89504e47') || (b.mime === 'image/jpeg' && !signature.startsWith('ffd8ff')))
      throw new HttpError(400, 'File content does not match its type');
    const stream = assets.openUploadStream(b.name.replace(/[^\w.-]/g, '_'), {
      metadata: { projectId: req.params.id, mime: b.mime, uploadedBy: req.user.id },
    });
    await new Promise<void>((res, rej) => {
      stream.on('finish', res);
      stream.on('error', rej);
      stream.end(data);
    });
    return { id: stream.id.toString() };
  });
}
