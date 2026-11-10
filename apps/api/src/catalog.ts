import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from './db';
import { audit } from './security';
import { HttpError } from './projects';
import type { Auth } from './auth-types';
import { can } from '../../../packages/shared/src/domain';
import { findQuestion, modules } from '../../../packages/shared/src/templates';
import { jsonSchemas, sourceSchema, technologySchema, type Technology } from '../../../packages/shared/src/schema';

const guidanceSchema = z.object({
  text: z.string().max(10000),
  references: z.array(sourceSchema).max(20).default([]),
});

export async function registerCatalogRoutes(app: FastifyInstance, auth: Auth) {
  app.get('/api/v1/templates', { preHandler: auth }, async () => modules);
  app.get('/api/v1/schemas', { preHandler: auth }, async () => jsonSchemas);

  /** Workspace guidance added by administrators to a module or a single question. */
  app.get('/api/v1/guidance', { preHandler: auth }, async () =>
    db.collection('guidance').find({}, { projection: { _id: 0 } }).toArray(),
  );
  app.put('/api/v1/guidance/:key', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
    const key = String(req.params.key);
    if (!modules.some((m) => m.id === key) && !findQuestion(key))
      throw new HttpError(404, 'Unknown module or question');
    const b = guidanceSchema.parse(req.body);
    await db.collection('guidance').updateOne(
      { key },
      { $set: { key, ...b, updatedBy: req.user.id, updatedAt: new Date().toISOString() } },
      { upsert: true },
    );
    await audit(req.user.id, 'guidance.updated', undefined, { key });
    return { key, ...b };
  });

  app.get('/api/v1/catalog', { preHandler: auth }, async () =>
    db.collection('technologies').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray(),
  );
  app.get('/api/v1/catalog/:id/usage', { preHandler: auth }, async (req: any) => {
    const query =
      req.user.role === 'Owner'
        ? { 'spec.technologyIds': req.params.id }
        : { 'spec.technologyIds': req.params.id, [`members.${req.user.id}`]: { $exists: true } };
    return (await db.collection('projects').find(query).toArray()).map((p) => ({
      id: p.id,
      name: p.spec.name,
      decisions: p.spec.technologyDecisions?.[req.params.id] ?? [],
    }));
  });
  app.put('/api/v1/catalog/:id', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'edit')) throw new HttpError(403, 'Editor access required');
    const body = z
      .object({ entry: technologySchema, note: z.string().max(1000).default('') })
      .or(technologySchema.transform((entry) => ({ entry, note: '' })))
      .parse(req.body);
    const item: Technology = body.entry;
    if (item.id !== req.params.id) throw new HttpError(400, 'Identifier mismatch');
    const old = await db.collection<Technology>('technologies').findOne({ id: item.id });
    // History is append-only and server-maintained; clients cannot rewrite it.
    item.history = old?.history ?? [];
    if (!old || old.ring !== item.ring)
      item.history.push({
        ring: item.ring,
        at: new Date().toISOString(),
        by: req.user.id,
        ...(body.note ? { note: body.note } : {}),
      });
    await db.collection('technologies').replaceOne({ id: item.id }, item, { upsert: true });
    await audit(req.user.id, 'technology.updated', undefined, {
      technologyId: item.id,
      ring: item.ring,
      moved: !!old && old.ring !== item.ring,
    });
    return item;
  });
}
