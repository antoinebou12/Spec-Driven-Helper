import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDocsSite, pages } from '../scripts/build-docs-site';

/** The documentation website: every page builds, every link and anchor resolves, Markdown is published too. */
const out = join(mkdtempSync(join(tmpdir(), 'sdd-docs-')), 'site');
const result = buildDocsSite(out);
const html = (slug: string) => readFileSync(join(out, `${slug}.html`), 'utf8');

describe('documentation website', () => {
  it('builds every page without broken links or images', () => {
    expect(result.problems).toEqual([]);
    for (const p of pages) {
      expect(existsSync(join(out, `${p.slug}.html`)), p.slug).toBe(true);
      expect(readFileSync(join(out, 'md', `${p.slug}.md`), 'utf8')).toBe(readFileSync(p.source, 'utf8'));
    }
  });

  it('resolves every internal link, anchor and image in the output', () => {
    const broken: string[] = [];
    for (const p of pages) {
      const page = html(p.slug);
      for (const [, attr, value] of page.matchAll(/(href|src)="([^"]+)"/g)) {
        if (/^(https?:|mailto:)/.test(value)) continue;
        const [file, anchor] = value.split('#');
        const target = file || `${p.slug}.html`;
        if (!existsSync(join(out, target))) broken.push(`${p.slug}: ${attr} ${value}`);
        else if (anchor && target.endsWith('.html') && !readFileSync(join(out, target), 'utf8').includes(`id="${anchor}"`)) broken.push(`${p.slug}: missing anchor ${value}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('gives each page a title, description, language, one H1 and navigation with the current page', () => {
    for (const p of pages) {
      const page = html(p.slug);
      expect(page, p.slug).toMatch(/<html lang="en">/);
      expect(page).toContain(`<title>${p.title.replace('&', '&amp;')} — SDD Studio docs</title>`);
      expect(/<meta name="description" content="([^"]{20,})"/.test(page), `${p.slug} description`).toBe(true);
      expect(page.match(/<h1[ >]/g)?.length, `${p.slug} h1`).toBe(1);
      expect(page).toContain(`href="${p.slug}.html" aria-current="page"`);
      expect(page).not.toMatch(/<script>(?!<\/script>)/); // only the external search script (CSP 'self')
    }
  });

  it('publishes search, llms.txt and the brand assets', () => {
    const index = JSON.parse(readFileSync(join(out, 'search-index.json'), 'utf8')) as { slug: string; headings: string[] }[];
    expect(index.map((e) => e.slug)).toEqual(pages.map((p) => p.slug));
    expect(index.find((e) => e.slug === 'testing')?.headings.length).toBeGreaterThan(3);
    const llms = readFileSync(join(out, 'llms.txt'), 'utf8');
    expect(llms.startsWith('# SDD Studio documentation\n\n> ')).toBe(true);
    for (const p of pages) expect(llms).toContain(`(md/${p.slug}.md)`);
    for (const file of ['site.css', 'search.js', 'favicon.svg']) expect(existsSync(join(out, file)), file).toBe(true);
    expect(readdirSync(join(out, 'assets')).length).toBeGreaterThan(0);
  });
});
