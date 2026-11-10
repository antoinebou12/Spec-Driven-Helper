import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aiCrawlers, faq, indexHtmlAdditions, llmsFullTxt, llmsTxt, robotsTxt, sitemapXml, structuredData } from '../packages/shared/src/aio';
import { features } from '../packages/shared/src/features';
import { aioHtml } from '../vite.config';
import { setupApp, type Harness } from './helpers';

/**
 * Automatic AI-optimisation (AIO) checks: what AI assistants, answer engines and crawlers read.
 * Format (llmstxt.org, robots, sitemap, schema.org), truthfulness (claims match features.ts),
 * reachability without JavaScript, and privacy (no project data in public files).
 */
const origin = 'https://sdd.example.org';

/** llmstxt.org: H1 title, a blockquote summary, then H2 sections of "- [name](url): notes" links. */
function llmsProblems(text: string) {
  const lines = text.split('\n');
  const problems: string[] = [];
  if (!/^# \S/.test(lines[0])) problems.push('first line is not an H1 title');
  const firstContent = lines.slice(1).find((l) => l.trim());
  if (!firstContent?.startsWith('> ')) problems.push('no blockquote summary after the title');
  if (lines.filter((l) => /^# /.test(l)).length !== 1) problems.push('exactly one H1 expected');
  if (!lines.some((l) => /^## /.test(l))) problems.push('no H2 sections');
  for (const l of lines.filter((x) => x.startsWith('- ['))) if (!/^- \[[^\]]+\]\(https?:\/\/[^)\s]+\)(: .+)?$/.test(l)) problems.push(`malformed link line: ${l}`);
  return problems;
}

describe('AIO content', () => {
  it('llms.txt follows llmstxt.org and links with absolute URLs', () => {
    const text = llmsTxt(origin);
    expect(llmsProblems(text)).toEqual([]);
    expect(text).toContain(`${origin}/llms-full.txt`);
    for (const f of features) expect(text, f.id).toContain(f.en);
  });

  it('llms-full.txt is self-contained: features, 14 modules, FAQ and the MCP tools', () => {
    const text = llmsFullTxt(origin, [{ name: 'get_board', description: 'Use to see the work. More.' }]);
    expect(llmsProblems(text)).toEqual([]);
    expect(text.match(/^\d+\. \*\*/gm)).toHaveLength(14);
    for (const f of faq) expect(text).toContain(f.q.en);
    expect(text).toContain('`get_board` — Use to see the work.');
    expect(text).toContain(`${origin}/api/v1/mcp`);
  });

  it('robots.txt opens public pages to every crawler, closes /api, and can block AI crawlers', () => {
    const allowed = robotsTxt(origin);
    const blocks = allowed.split('\n\n');
    expect(blocks[0]).toBe('User-agent: *\nAllow: /\nDisallow: /api/');
    for (const bot of aiCrawlers) expect(allowed, bot).toContain(`User-agent: ${bot}\nAllow: /\nDisallow: /api/`);
    expect(allowed.trim().endsWith(`Sitemap: ${origin}/sitemap.xml`)).toBe(true);
    const blocked = robotsTxt(origin, false);
    for (const bot of aiCrawlers) expect(blocked, bot).toContain(`User-agent: ${bot}\nDisallow: /`);
    expect(blocked).toContain('User-agent: *\nAllow: /\nDisallow: /api/');
  });

  it('sitemap.xml lists only public URLs', () => {
    const xml = sitemapXml(origin);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([`${origin}/`, `${origin}/llms.txt`, `${origin}/llms-full.txt`]);
    expect(xml).not.toContain('/api');
  });

  it('structured data is valid schema.org and matches the product claims', () => {
    const data = structuredData();
    expect(data['@context']).toBe('https://schema.org');
    const byType = Object.fromEntries(data['@graph'].map((n) => [n['@type'], n])) as Record<string, any>;
    expect(Object.keys(byType).sort()).toEqual(['FAQPage', 'SoftwareApplication', 'WebSite']);
    expect(byType.SoftwareApplication).toMatchObject({ name: 'SDD Studio', applicationCategory: 'DeveloperApplication' });
    for (const f of features) expect(byType.SoftwareApplication.featureList.join('\n'), f.id).toContain(f.en);
    expect(byType.FAQPage.mainEntity).toHaveLength(faq.length);
    for (const q of byType.FAQPage.mainEntity) {
      expect(q['@type']).toBe('Question');
      expect(q.name.endsWith('?')).toBe(true);
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(60);
    }
  });

  it('FAQ is bilingual and states only product facts', () => {
    for (const f of faq) {
      expect(f.q.fr && f.a.fr, f.q.en).toBeTruthy();
      expect(f.a.en).not.toMatch(/\b(best|fastest|leading|#1|guarantee)\b/i);
    }
  });
});

describe('index.html for crawlers and assistants', () => {
  const html = (() => {
    const source = readFileSync(join(__dirname, '..', 'apps', 'web', 'index.html'), 'utf8');
    const transform = aioHtml().transformIndexHtml as (html: string) => string;
    return transform(source);
  })();

  it('has language, title, description, Open Graph and llms.txt link', () => {
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<title>SDD Studio<\/title>/);
    const description = /<meta name="description" content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(description.length).toBeGreaterThanOrEqual(40);
    expect(description.length).toBeLessThanOrEqual(160);
    for (const property of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image']) expect(html, property).toContain(`property="${property}"`);
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/llms.txt"');
    expect(html).toContain('<meta name="robots" content="index, follow');
  });

  it('embeds parseable JSON-LD that cannot break out of its script tag', () => {
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(scripts[0][1]).not.toContain('<');
    expect(JSON.parse(scripts[0][1])).toEqual(structuredData());
  });

  it('gives readers without JavaScript the product, the features and the FAQ', () => {
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1] ?? '';
    expect(noscript.match(/<h1>/g)).toHaveLength(1);
    expect(noscript).toContain('<h1>SDD Studio</h1>');
    for (const f of features) expect(noscript, f.id).toContain(f.en);
    expect(noscript.match(/<h3>/g)).toHaveLength(faq.length);
    expect(indexHtmlAdditions().noscript).toBe(`<noscript>${noscript}</noscript>`);
  });
});

describe('AIO routes', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('aio');
  });
  afterAll(async () => h?.teardown());

  it('serves the files publicly with the right types and caching', async () => {
    for (const [url, type] of [
      ['/llms.txt', 'text/markdown'],
      ['/llms-full.txt', 'text/markdown'],
      ['/robots.txt', 'text/plain'],
      ['/sitemap.xml', 'application/xml'],
    ]) {
      const res = await h.app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(200);
      expect(res.headers['content-type'], url).toContain(type);
      expect(res.headers['cache-control'], url).toContain('max-age=3600');
    }
  });

  it('lists every real MCP tool in llms-full.txt', async () => {
    const text = (await h.app.inject({ method: 'GET', url: '/llms-full.txt' })).body;
    for (const tool of ['get_project_overview', 'get_section', 'list_items', 'get_board', 'move_card', 'link_pull_request', 'propose_change', 'export_plan_tasks', 'list_proposals', 'plan_tasks', 'get_next_tasks', 'import_plan_tasks']) expect(text, tool).toContain(`\`${tool}\``);
  });

  it('never exposes project data', async () => {
    const secret = `Confidential Merger ${crypto.randomUUID()}`;
    await h.createProject({ name: secret, sample: true });
    for (const url of ['/llms.txt', '/llms-full.txt', '/robots.txt', '/sitemap.xml']) expect((await h.app.inject({ method: 'GET', url })).body, url).not.toContain(secret);
  });

  it('honours AIO_ALLOW_AI_CRAWLERS=false', async () => {
    process.env.AIO_ALLOW_AI_CRAWLERS = 'false';
    try {
      expect((await h.app.inject({ method: 'GET', url: '/robots.txt' })).body).toContain('User-agent: GPTBot\nDisallow: /');
    } finally {
      delete process.env.AIO_ALLOW_AI_CRAWLERS;
    }
  });
});
