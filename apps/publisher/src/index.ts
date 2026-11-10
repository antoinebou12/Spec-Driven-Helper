import 'dotenv/config';
import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { validateSpec } from '../../../packages/shared/src/domain';
import { renderPDF } from './report';
const secret = process.env.PUBLISHER_TOKEN;
if (!secret || secret.length < 32)
  throw new Error('Set PUBLISHER_TOKEN with at least 32 random characters');
const app = Fastify({ bodyLimit: 3_000_000 });
let active = false;
app.get('/health', async () => ({ status: 'ok', busy: active }));
app.post('/pdf', async (req, reply) => {
  const actual = Buffer.from(req.headers.authorization ?? ''),
    expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return reply.code(401).send({ error: 'Unauthorized' });
  if (active) return reply.code(429).send({ error: 'Publisher is busy' });
  active = true;
  try {
    return reply.type('application/pdf').send(await renderPDF(validateSpec(req.body)));
  } catch {
    return reply.code(422).send({ error: 'Report rendering failed' });
  } finally {
    active = false;
  }
});
await app.listen({
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PUBLISHER_PORT ?? 3200),
});
