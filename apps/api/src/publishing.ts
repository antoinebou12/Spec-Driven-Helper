import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, assets, assetKey } from './db';
import { projectFor, HttpError } from './projects';
import { decrypt, audit } from './security';
import { scaffold } from './scaffolding';
import { publisherPdf } from './pdf-publisher';
export async function saveAsset(
  projectId: string,
  name: string,
  mime: string,
  data: Buffer,
  metadata: Record<string, unknown> = {},
) {
  const stream = assets.openUploadStream(name, { metadata: { projectId, mime, ...metadata } });
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    stream.end(data);
  });
  return stream.id.toString();
}
export async function processPublishing(job: any, signal: AbortSignal) {
  if (job.kind === 'pdf') {
    const data = await publisherPdf(job.spec, signal);
    return {
      assetId: await saveAsset(
        job.projectId,
        `specification-r${job.spec.revision}.pdf`,
        'application/pdf',
        data,
        { revision: job.spec.revision, approved: true },
      ),
    };
  }
  if (job.kind === 'image') {
    if (job.spec.localOnly)
      throw new Error('Image generation is unavailable for local-only projects');
    const config = await db.collection('integrations').findOne({ id: 'openai' });
    if (!config?.secret) throw new Error('Configure an OpenAI API key');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${decrypt(config.secret)}`,
      },
      body: JSON.stringify({ model: job.model, prompt: job.prompt, n: 1, size: '1024x1024' }),
      signal,
    });
    if (!response.ok) throw new Error(`Image generation failed (${response.status})`);
    const result = (await response.json()) as any;
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('Choose an image model that returns base64 image output');
    return {
      assetId: await saveAsset(
        job.projectId,
        'ux-concept.png',
        'image/png',
        Buffer.from(b64, 'base64'),
        {
          revision: job.spec.revision,
          prompt: job.prompt,
          model: job.model,
          provider: 'openai',
          approved: false,
          createdBy: job.userId,
        },
      ),
      usage: result.usage,
    };
  }
  throw new Error('Unknown publishing job');
}
export async function registerPublishing(app: FastifyInstance, auth: any) {
  app.get('/api/v1/projects/:id/publishing', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id);
    return {
      pdfConfigured: !!process.env.PUBLISHER_URL,
      assets: await db
        .collection('assets.files')
        .find(
          { 'metadata.projectId': req.params.id },
          { projection: { filename: 1, uploadDate: 1, metadata: 1, length: 1 } },
        )
        .toArray(),
    };
  });
  app.post('/api/v1/projects/:id/publishing', { preHandler: auth }, async (req: any) => {
    const p = await projectFor(req.user, req.params.id, 'edit');
    const b = z
      .object({
        kind: z.enum(['pdf', 'image']),
        prompt: z.string().max(10000).default(''),
        model: z.string().max(200).default('gpt-image-1'),
      })
      .parse(req.body);
    if (b.kind === 'pdf' && !process.env.PUBLISHER_URL)
      throw new HttpError(503, 'Configure the isolated PDF publisher service');
    if (b.kind === 'image' && (p.spec.localOnly || !b.prompt.trim()))
      throw new HttpError(400, 'A cloud-enabled project and image prompt are required');
    const job = {
      id: crypto.randomUUID(),
      projectId: p.id,
      userId: req.user.id,
      ...b,
      provider: b.kind === 'pdf' ? 'publisher' : 'openai',
      spec: p.spec,
      baseRevision: p.spec.revision,
      status: 'queued',
      attempts: 0,
      createdAt: new Date().toISOString(),
      events: [],
    };
    await db.collection('jobs').insertOne(job);
    return { id: job.id };
  });
  app.get('/api/v1/projects/:id/assets/:assetId', { preHandler: auth }, async (req: any, reply) => {
    await projectFor(req.user, req.params.id);
    const key = assetKey(req.params.assetId);
    if (!key) throw new HttpError(400, 'Invalid asset');
    const file = await db.collection('assets.files').findOne({ _id: key as never, 'metadata.projectId': req.params.id });
    if (!file) throw new HttpError(404, 'Asset not found');
    reply.header(
      'Content-Disposition',
      `attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    );
    return reply.type(file.metadata.mime).send(assets.openDownloadStream(file._id));
  });
  app.post(
    '/api/v1/projects/:id/assets/:assetId/approve',
    { preHandler: auth },
    async (req: any) => {
      await projectFor(req.user, req.params.id, 'review');
      const key = assetKey(req.params.assetId);
      if (!key) throw new HttpError(400, 'Invalid asset');
      const result = await db
        .collection('assets.files')
        .updateOne(
          { _id: key as never, 'metadata.projectId': req.params.id },
          { $set: { 'metadata.approved': true, 'metadata.approvedBy': req.user.id } },
        );
      if (!result.matchedCount) throw new HttpError(404, 'Asset not found');
      await audit(req.user.id, 'asset.approved', req.params.id);
      return { ok: true };
    },
  );
  app.get('/api/v1/projects/:id/scaffold', { preHandler: auth }, async (req: any, reply) => {
    await projectFor(req.user, req.params.id);
    const baseline = await db
      .collection('baselines')
      .findOne({ projectId: req.params.id }, { sort: { approvedAt: -1 } });
    if (!baseline)
      throw new HttpError(409, 'Approve a baseline before generating a starter repository');
    reply.header('Content-Disposition', 'attachment; filename="project-starter.zip"');
    return reply.type('application/zip').send(await scaffold(baseline.spec));
  });
}
