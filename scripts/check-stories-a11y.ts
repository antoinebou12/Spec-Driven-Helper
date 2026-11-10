import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Runs axe (WCAG 2.2 AA) on every story of a static Storybook build, in light and dark themes and
 * in French. Run after `pnpm exec storybook build -o storybook-static`.
 */
const root = normalize(process.argv[2] ?? 'storybook-static');
if (!existsSync(join(root, 'index.json'))) {
  console.error(`No Storybook build in ${root}. Run: pnpm exec storybook build -o ${root}`);
  process.exit(2);
}
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  const path = normalize(
    join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)),
  );
  if (!path.startsWith(root + sep) && path !== root) return void res.writeHead(403).end();
  // Read before writing the header, so a missing file is a 404 rather than a crash after a 200.
  let body: Buffer;
  try {
    body = await readFile(path);
  } catch {
    return void res.writeHead(404).end();
  }
  res
    .writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
    .end(body);
}).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const port = (server.address() as { port: number }).port;

const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8')) as {
  entries: Record<string, { id: string; type: string }>;
};
const stories = Object.values(index.entries)
  .filter((e) => e.type === 'story')
  .map((e) => e.id);
const variants = [
  { theme: 'light', lang: 'en' },
  { theme: 'dark', lang: 'en' },
  { theme: 'light', lang: 'fr' },
];

const browser = await chromium.launch();
// Audit settled colors rather than sampling a motion component's entrance opacity.
const context = await browser.newContext({
  viewport: { width: 1200, height: 900 },
  reducedMotion: 'reduce',
});
let failures = 0;
for (const id of stories)
  for (const { theme, lang } of variants) {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(
      // This runner owns the axe scan; keep the addon from starting a concurrent one.
      `http://127.0.0.1:${port}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};lang:${lang};a11y.manual:!true`,
    );
    await page.waitForSelector('#storybook-root > *', { timeout: 15_000 });
    await page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
    const { violations } = await new AxeBuilder({ page })
      .include('#storybook-root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const problems = [
      ...errors.map((e) => `page error: ${e}`),
      ...violations.map(
        (v) =>
          `${v.id}: ${v.help} (${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')})`,
      ),
    ];
    failures += problems.length;
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${theme.padEnd(5)} ${lang} ${id}`);
    for (const p of problems) console.log(`       ${p}`);
    await page.close();
  }
await browser.close();
server.close();
console.log(
  failures
    ? `${failures} accessibility problems in ${stories.length} stories.`
    : `${stories.length} stories × ${variants.length} variants pass axe (WCAG 2.2 AA).`,
);
process.exit(failures ? 1 : 0);
