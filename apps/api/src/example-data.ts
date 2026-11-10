import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assets, db, postgres } from './db';
import { audit } from './security';
import { HttpError } from './projects';
import type { Auth } from './auth-types';
import { can } from '../../../packages/shared/src/domain';

/**
 * Example data: projects created from the built-in example ("Customer Request Portal" and other
 * samples) are recognised by the provenance of their first revision. Administrators can list them
 * and remove them with everything they own; the audit trail is kept.
 */
const owned = ['revisions', 'proposals', 'baselines', 'boards', 'jobs', 'connectors', 'git', 'mcpTokens'] as const;

export async function exampleProjects() {
  const firsts = await db.collection('revisions').find({ revision: 0, 'provenance.origin': 'example' }, { projection: { projectId: 1 } }).toArray();
  const ids = [...new Set(firsts.map((r) => String(r.projectId)))];
  if (!ids.length) return [];
  const projects = await db.collection('projects').find({ id: { $in: ids } }, { projection: { id: 1, 'spec.name': 1, 'spec.revision': 1, 'spec.updatedAt': 1 } }).toArray();
  return projects.map((p) => ({ id: String(p.id), name: String(p.spec?.name ?? ''), revision: Number(p.spec?.revision ?? 0), updatedAt: String(p.spec?.updatedAt ?? '') }));
}

export async function removeExampleProjects(userId: string) {
  const projects = await exampleProjects();
  const ids = projects.map((p) => p.id);
  if (!ids.length) return { removed: 0, projects: [] };
  for (const file of await db.collection('assets.files').find({ 'metadata.projectId': { $in: ids } }, { projection: { _id: 1 } }).toArray()) await assets.delete(file._id);
  for (const name of owned) await db.collection(name).deleteMany({ projectId: { $in: ids } });
  await postgres.pool.query('DELETE FROM sdd_search WHERE namespace=$1 AND project_id = ANY($2)', [postgres.databaseName, ids]);
  await db.collection('projects').deleteMany({ id: { $in: ids } });
  await audit(userId, 'admin.example-projects-removed', undefined, { count: ids.length, projectIds: ids });
  return { removed: ids.length, projects };
}

export async function registerExampleDataRoutes(app: FastifyInstance, auth: Auth) {
  const admin = async (req: any) => {
    await auth(req);
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
  };
  app.get('/api/v1/admin/example-projects', { preHandler: admin }, async () => exampleProjects());
  app.delete('/api/v1/admin/example-projects', { preHandler: admin }, async (req: any) => {
    // An explicit confirmation in the body, so a stray request cannot wipe data.
    z.object({ confirm: z.literal(true) }).parse(req.body ?? {});
    return removeExampleProjects(req.user.id);
  });
}
