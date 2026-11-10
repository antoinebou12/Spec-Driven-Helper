import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from './db';
import { audit } from './security';
import { HttpError } from './projects';
import type { Auth } from './auth-types';
import { can } from '../../../packages/shared/src/domain';
import {
  effectiveFeatures,
  featureFlags,
  featureForRequest,
  type FeatureId,
  type FeatureState,
} from '../../../packages/shared/src/feature-flags';

/** Workspace feature flags, stored as overrides of the defaults and cached briefly per process. */
let cached: { state: FeatureState; at: number } | null = null;
const ttlMs = 5000;

export async function features(): Promise<FeatureState> {
  if (cached && Date.now() - cached.at < ttlMs) return cached.state;
  const stored = await db.collection('featureFlags').findOne({ id: 'global' });
  cached = {
    state: effectiveFeatures((stored?.overrides as Record<string, boolean>) ?? {}),
    at: Date.now(),
  };
  return cached.state;
}
export async function requireFeature(id: FeatureId) {
  if (!(await features())[id])
    throw new HttpError(
      403,
      `The “${featureFlags.find((f) => f.id === id)?.label.en}” feature is disabled by an administrator`,
      { code: 'feature-disabled', feature: id },
    );
}

const catalog = featureFlags.map(({ id, category, label, description, defaultEnabled }) => ({
  id,
  category,
  label,
  description,
  defaultEnabled,
}));

export async function registerFeatures(app: FastifyInstance, auth: Auth) {
  // Runs before route-level authentication, so a disabled feature is refused for everyone.
  // AI runs from any route (jobs, AI import) are also checked in queueAiJob, including Claude Agent.
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    for (const id of featureForRequest(req.method, req.url)) await requireFeature(id);
  });

  app.get('/api/v1/features', { preHandler: auth }, async () => ({
    features: await features(),
    catalog,
  }));

  const admin = async (req: any) => {
    await auth(req);
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
  };
  app.get('/api/v1/admin/features', { preHandler: admin }, async () => {
    const stored = await db.collection('featureFlags').findOne({ id: 'global' });
    return {
      features: await features(),
      catalog,
      updatedAt: stored?.updatedAt ?? null,
      updatedBy: stored?.updatedBy ?? null,
    };
  });
  app.put('/api/v1/admin/features', { preHandler: admin }, async (req: any) => {
    const ids = featureFlags.map((f) => f.id) as [FeatureId, ...FeatureId[]];
    const b = z.object({ features: z.partialRecord(z.enum(ids), z.boolean()) }).parse(req.body);
    const before = await features();
    const overrides = {
      ...((await db.collection('featureFlags').findOne({ id: 'global' }))?.overrides ?? {}),
      ...b.features,
    };
    await db
      .collection('featureFlags')
      .updateOne(
        { id: 'global' },
        {
          $set: {
            id: 'global',
            overrides,
            updatedAt: new Date().toISOString(),
            updatedBy: req.user.id,
          },
        },
        { upsert: true },
      );
    cached = null;
    const after = await features();
    const changed = Object.fromEntries(
      Object.entries(after).filter(([k, v]) => before[k as FeatureId] !== v),
    );
    await audit(req.user.id, 'features.updated', undefined, { changed });
    return { features: after, catalog };
  });
}
