import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, normalize, relative } from 'node:path';
import { htmlEscape, markdownToHtml } from '../packages/shared/src/document-render';

/**
 * Builds the documentation website from the repository's Markdown: one HTML page per document with
 * the SDD Studio brand, navigation, a table of contents, light and dark themes, client-side search,
 * and the original Markdown next to each page (for people and for AI tools, with an llms.txt).
 * Output: dist/docs-site (served by the API at /docs/ and deployable to any static host).
 * Run: `pnpm docs:site`. Every internal link and image is checked; a broken one fails the build.
 */
export type Page = { source: string; slug: string; title: string; group: 'Product' | 'Guides' | 'Reference' };
export const pages: Page[] = [
  { source: 'README.md', slug: 'index', title: 'Overview', group: 'Product' },
  { source: 'PRODUCT.md', slug: 'product', title: 'Product', group: 'Product' },
  { source: 'DESIGN.md', slug: 'design', title: 'Design', group: 'Product' },
  { source: 'docs/README.md', slug: 'guide', title: 'Documentation map', group: 'Guides' },
  { source: 'docs/user-guide.md', slug: 'user-guide', title: 'User guide', group: 'Guides' },
  { source: 'docs/administration.md', slug: 'administration', title: 'Administration and access', group: 'Guides' },
  { source: 'docs/installation.md', slug: 'installation', title: 'Installation', group: 'Guides' },
  { source: 'docs/operations.md', slug: 'operations', title: 'Operations', group: 'Guides' },
  { source: 'docs/ai-readiness.md', slug: 'ai-readiness', title: 'AI readiness (AIO and MCP)', group: 'Guides' },
  { source: 'docs/testing.md', slug: 'testing', title: 'Testing', group: 'Guides' },
  { source: 'docs/ci-local.md', slug: 'ci-local', title: 'CI locally', group: 'Guides' },
  { source: 'docs/openspec.md', slug: 'openspec', title: 'OpenSpec exchange', group: 'Guides' },
  { source: 'docs/design.md', slug: 'software-design', title: 'Software design', group: 'Reference' },
  { source: 'docs/architecture/dependencies.md', slug: 'dependencies', title: 'Architecture dependencies', group: 'Reference' },
  { source: 'AGENTS.md', slug: 'agents', title: 'Agent and contributor guide', group: 'Reference' },
  { source: 'fixtures/README.md', slug: 'fixtures', title: 'Fixtures', group: 'Reference' },
  { source: 'docs/glossary.md', slug: 'glossary', title: 'Glossary', group: 'Reference' },
];

const placeholder = 'https://sdd-docs.invalid/';
const repoLink = (process.env.DOCS_REPOSITORY_URL ?? '').replace(/\/$/, '');

export type BuildResult = { out: string; pages: number; problems: string[] };

export function buildDocsSite(out = join('dist', 'docs-site')): BuildResult {
  const problems: string[] = [];
  const bySource = new Map(pages.map((p) => [normalize(p.source), p]));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'md'), { recursive: true });
  mkdirSync(join(out, 'assets'), { recursive: true });
  copyFileSync(join('apps', 'web', 'public', 'favicon.svg'), join(out, 'favicon.svg'));
  const index: { slug: string; title: string; headings: string[]; text: string }[] = [];

  const rendered = pages.map((page) => {
    const markdown = readFileSync(page.source, 'utf8');
    const dir = dirname(page.source);
    const images: string[] = [];
    // README-style HTML: local images become Markdown images; wrappers and external badges are dropped
    // (the site's CSP allows only its own images); everything else stays escaped by the renderer.
    const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
    const source = markdown
      .replace(/<a [^>]*>\s*(<img[^>]*>)\s*<\/a>/g, '$1')
      .replace(/<img[^>]*>/g, (tag) => (/^https?:/.test(attr(tag, 'src')) ? '' : `![${attr(tag, 'alt')}](${attr(tag, 'src')})`))
      .replace(/<\/?p[^>]*>|<br\s*\/?>/g, '');
    // Images: copied into assets/ and re-inserted after rendering (the shared renderer has none).
    let md = source.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
      if (/^https?:/.test(src)) return `[[IMG:${images.push(`<img src="${htmlEscape(src)}" alt="${htmlEscape(alt)}" loading="lazy">`) - 1}]]`;
      const file = normalize(join(dir, src));
      if (!existsSync(file)) problems.push(`${page.source}: missing image ${src}`);
      else copyFileSync(file, join(out, 'assets', basename(file)));
      return `[[IMG:${images.push(`<img src="assets/${htmlEscape(basename(file))}" alt="${htmlEscape(alt)}" loading="lazy">`) - 1}]]`;
    });
    // Internal links: to another page of the site, to the repository (when configured), or plain text.
    md = md.replace(/\[([^\]]+)\]\((?!https?:|mailto:|#)([^)\s]+)\)/g, (_m, text: string, href: string) => {
      const [path, hash] = href.split('#');
      const target = bySource.get(normalize(join(dir, path)));
      if (target) return `[${text}](${placeholder}${target.slug}.html${hash ? `#${hash}` : ''})`;
      if (!existsSync(normalize(join(dir, path)))) problems.push(`${page.source}: broken link ${href}`);
      return repoLink ? `[${text}](${repoLink}/blob/main/${normalize(join(dir, path)).split('\\').join('/')})` : text;
    });
    let html = markdownToHtml(md).replaceAll(placeholder, '');
    html = html.replace(/\[\[IMG:(\d+)\]\]/g, (_m, i: string) => images[Number(i)]);
    // Documents that open with a banner instead of a heading still get one H1.
    if (!/<h1[ >]/.test(html)) html = `<h1>${htmlEscape(page.title)}</h1>
${html}`;
    // Stable anchors for headings, collected for the table of contents and search.
    const headings: { id: string; text: string; level: number }[] = [];
    html = html.replace(/<h([23])>(.*?)<\/h\1>/g, (_m, level: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, '');
      const id = text.toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
      headings.push({ id, text, level: Number(level) });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    });
    writeFileSync(join(out, 'md', `${page.slug}.md`), markdown);
    const text = source
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/```[\s\S]*?```/g, ' ').replace(/[#*`>|_[\]()-]/g, ' ').replace(/\s+/g, ' ').trim();
    index.push({ slug: page.slug, title: page.title, headings: headings.map((h) => h.text), text: text.slice(0, 4000) });
    const description = text.replace(/^.*?—\s*/, '').slice(0, 155);
    return { page, html, headings, description };
  });

  const nav = (current: string) =>
    (['Product', 'Guides', 'Reference'] as const)
      .map(
        (group) =>
          `<section><h2>${group}</h2><ul>${pages
            .filter((p) => p.group === group)
            .map((p) => `<li><a href="${p.slug}.html"${p.slug === current ? ' aria-current="page"' : ''}>${htmlEscape(p.title)}</a></li>`)
            .join('')}</ul></section>`,
      )
      .join('');

  for (const { page, html, headings, description } of rendered) {
    const toc = headings.filter((h) => h.level === 2);
    writeFileSync(
      join(out, `${page.slug}.html`),
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(page.title)} — SDD Studio docs</title>
<meta name="description" content="${htmlEscape(description)}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="alternate" type="text/markdown" href="md/${page.slug}.md">
<link rel="stylesheet" href="site.css">
<script src="search.js" defer></script>
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="top"><a class="brand" href="index.html"><img src="favicon.svg" alt="" width="28" height="28"><strong>SDD</strong> Studio <span>docs</span></a>
<label class="search"><span class="sr-only">Search the documentation</span><input id="search" type="search" placeholder="Search the docs" autocomplete="off"></label></header>
<div class="layout">
<nav class="side" aria-label="Documentation">${nav(page.slug)}</nav>
<main id="content">
<div id="results" hidden></div>
<article>${html}</article>
<footer><a href="md/${page.slug}.md">View this page as Markdown</a> · <a href="llms.txt">llms.txt</a>${repoLink ? ` · <a href="${repoLink}/blob/main/${page.source}">Edit on GitHub</a>` : ''}</footer>
</main>
${toc.length > 1 ? `<aside class="toc" aria-label="On this page"><h2>On this page</h2><ul>${toc.map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ul></aside>` : '<span></span>'}
</div>
</body>
</html>
`,
    );
  }

  writeFileSync(join(out, 'search-index.json'), JSON.stringify(index));
  writeFileSync(join(out, 'search.js'), searchScript);
  writeFileSync(join(out, 'site.css'), siteCss);
  writeFileSync(
    join(out, 'llms.txt'),
    `# SDD Studio documentation\n\n> Installation, operations, testing, AI readiness and design of SDD Studio, a self-hosted workspace for software design documents.\n\n${(['Product', 'Guides', 'Reference'] as const)
      .map((g) => `## ${g}\n\n${pages.filter((p) => p.group === g).map((p) => `- [${p.title}](md/${p.slug}.md)`).join('\n')}`)
      .join('\n\n')}\n`,
  );
  return { out, pages: pages.length, problems };
}

const searchScript = `// Client-side search over search-index.json (no third-party code).
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('search');
  const results = document.getElementById('results');
  const article = document.querySelector('article');
  let index = null;
  const load = () => (index ??= fetch('search-index.json').then((r) => r.json()));
  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.hidden = true; article.hidden = false; return; }
    const words = q.split(/\\s+/);
    const hits = (await load())
      .map((p) => ({ p, score: words.reduce((s, w) => s + (p.title.toLowerCase().includes(w) ? 5 : 0) + (p.headings.join(' ').toLowerCase().includes(w) ? 3 : 0) + (p.text.toLowerCase().includes(w) ? 1 : 0), 0) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score);
    results.replaceChildren();
    const heading = document.createElement('h1');
    heading.textContent = hits.length ? 'Results for “' + input.value + '”' : 'No results for “' + input.value + '”';
    results.append(heading);
    const list = document.createElement('ul');
    for (const { p } of hits) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = p.slug + '.html';
      link.textContent = p.title;
      const at = p.text.toLowerCase().indexOf(words[0]);
      const snippet = document.createElement('p');
      snippet.textContent = at >= 0 ? '… ' + p.text.slice(Math.max(0, at - 60), at + 120) + ' …' : '';
      item.append(link, snippet);
      list.append(item);
    }
    results.append(list);
    results.hidden = false;
    article.hidden = true;
  });
});
`;

const siteCss = `:root{--bg:#fafafa;--surface:#fff;--subtle:#f5f6f8;--line:#e7e9ee;--text:#1b2230;--muted:#5d6675;--accent:#2f5bd3;--accent-soft:#eef2fd;--code:#f2f4f7;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--surface:#121821;--subtle:#171f2b;--line:#242d3b;--text:#e6ebf4;--muted:#a0acc2;--accent:#86a8ff;--accent-soft:#1d2b4e;--code:#171f2b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 Inter,'Segoe UI',system-ui,-apple-system,sans-serif}
a{color:var(--accent)}a:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;background:var(--surface);padding:8px;z-index:2}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.top{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:16px;justify-content:space-between;padding:10px 20px;background:var(--surface);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:8px;color:var(--text);text-decoration:none;font-size:1.05rem}.brand span{color:var(--muted);font-size:.9rem}
.search input{width:min(320px,50vw);padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--subtle);color:var(--text);font:inherit}
.layout{display:grid;grid-template-columns:240px minmax(0,1fr) 220px;gap:32px;max-width:1280px;margin:0 auto;padding:24px 20px}
.side,.toc{position:sticky;top:76px;align-self:start;font-size:.92rem}.side h2,.toc h2{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:18px 0 6px}
.side ul,.toc ul{list-style:none;margin:0;padding:0}.side a,.toc a{display:block;padding:4px 8px;border-radius:6px;color:var(--text);text-decoration:none;min-height:24px}
.side a:hover,.toc a:hover{background:var(--subtle)}.side a[aria-current=page]{background:var(--accent-soft);color:var(--accent);font-weight:600}
main{min-width:0}article{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:8px 36px 32px}
h1{font-size:2rem;line-height:1.2}h2{margin-top:2em}h1,h2,h3{scroll-margin-top:80px}
code{font-family:ui-monospace,'Cascadia Code',Menlo,Consolas,monospace;background:var(--code);padding:1px 5px;border-radius:5px;font-size:.9em}
pre{background:var(--code);padding:14px 16px;border-radius:10px;overflow-x:auto}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto;font-size:.93rem}th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}th{background:var(--subtle)}
blockquote{margin:1em 0;padding:4px 16px;border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0}
img{max-width:100%;height:auto;border-radius:8px;border:1px solid var(--line)}
footer{margin:16px 4px;color:var(--muted);font-size:.9rem}#results li{margin:12px 0}#results p{margin:2px 0;color:var(--muted);font-size:.9rem}
@media (max-width:1100px){.layout{grid-template-columns:220px minmax(0,1fr)}.toc{display:none}}
@media (max-width:760px){.layout{grid-template-columns:minmax(0,1fr);padding:12px}.side{position:static}article{padding:4px 16px 20px}.top{flex-wrap:wrap}}
`;

if (process.argv[1]?.endsWith('build-docs-site.ts')) {
  const result = buildDocsSite();
  for (const p of result.problems) console.error(`problem: ${p}`);
  console.log(`${result.pages} pages → ${relative('.', result.out)} (${result.problems.length} problems)`);
  // Images copy only the documentation sources, so links to other repository files cannot be
  // checked there; CI and tests/docs-site.test.ts run the full check.
  process.exit(result.problems.length && process.env.DOCS_LINK_CHECK !== 'warn' ? 1 : 0);
}
