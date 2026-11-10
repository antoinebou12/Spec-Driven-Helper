import type { FastifyInstance, FastifyRequest } from 'fastify';
import { llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from '../../../packages/shared/src/aio';
import { mcpToolCatalog } from './mcp';

/**
 * Public AI-optimisation files (no session): llms.txt, llms-full.txt, robots.txt and sitemap.xml.
 * Links use APP_ORIGIN. AIO_ALLOW_AI_CRAWLERS=false blocks known AI crawlers in robots.txt.
 */
const originOf = (req: FastifyRequest) => (process.env.APP_ORIGIN ?? `${req.protocol}://${req.headers.host ?? 'localhost'}`).replace(/\/$/, '');
const text = (type: string) => ({ 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'index' });

export async function registerAio(app: FastifyInstance) {
  app.get('/llms.txt', async (req, reply) => reply.headers(text('text/markdown')).send(llmsTxt(originOf(req))));
  app.get('/llms-full.txt', async (req, reply) => reply.headers(text('text/markdown')).send(llmsFullTxt(originOf(req), await mcpToolCatalog())));
  app.get('/robots.txt', async (req, reply) => reply.headers(text('text/plain')).send(robotsTxt(originOf(req), process.env.AIO_ALLOW_AI_CRAWLERS !== 'false')));
  app.get('/sitemap.xml', async (req, reply) => reply.headers(text('application/xml')).send(sitemapXml(originOf(req))));
}
