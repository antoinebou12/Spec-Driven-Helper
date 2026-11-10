import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Performance budgets for the built web client (run after `pnpm build`). Sizes are gzip bytes. */
const budgets = { entryJs: 320_000, entryCss: 40_000, largestLazyChunk: 1_100_000, totalJs: 4_500_000 };
const dir = 'dist/web/assets';
const files = readdirSync(dir).map((name) => ({ name, gz: gzipSync(readFileSync(join(dir, name))).length, raw: statSync(join(dir, name)).size }));
const html = readFileSync('dist/web/index.html', 'utf8');
const entry = (ext: string) => files.filter((f) => f.name.endsWith(ext) && html.includes(f.name)).reduce((n, f) => n + f.gz, 0);
const js = files.filter((f) => f.name.endsWith('.js'));
const measured = {
  entryJs: entry('.js'),
  entryCss: entry('.css'),
  largestLazyChunk: Math.max(...js.filter((f) => !html.includes(f.name)).map((f) => f.gz)),
  totalJs: js.reduce((n, f) => n + f.gz, 0),
};
let failed = false;
for (const [key, limit] of Object.entries(budgets)) {
  const value = measured[key as keyof typeof measured];
  const ok = value <= limit;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${key.padEnd(18)} ${(value / 1000).toFixed(1).padStart(8)} kB / ${(limit / 1000).toFixed(0)} kB`);
}
process.exit(failed ? 1 : 0);
