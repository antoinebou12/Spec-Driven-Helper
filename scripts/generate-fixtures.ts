import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import JSZip from 'jszip';
import { planFolderFiles } from '../apps/api/src/exports';
import { catalogSeed } from '../apps/api/src/catalog-seed';
import { applySpecPatch, createSpec } from '../packages/shared/src/domain';
import { buildExampleSpec } from '../packages/shared/src/example';
import { analyzeRepository } from '../packages/shared/src/import-rules';
import { findingsToPatch } from '../packages/shared/src/import-mapping';
import { cardsFromSpec, parsePlanTasks, type Card } from '../packages/shared/src/board';
import { backlogCards } from '../packages/shared/src/plan-folder';
import type { Spec, Technology } from '../packages/shared/src/schema';

/**
 * Reference projects as `.plan/` Markdown folders and zips, in fixtures/:
 *  - default-project: the complete example (Customer Request Portal) with a board in progress;
 *  - sdd-studio: this repository, analysed by the same import rules users run, with the board
 *    read from the repository's own .plan/tasks.md and .plan/backlog.md.
 * Both import into SDD Studio (Publish & handoff → .plan folder) and are checked by tests.
 * `pnpm fixtures` regenerates; `pnpm fixtures:check` fails when they are out of date.
 */
const pinned = '2026-09-28T00:00:00.000Z';
const root = 'fixtures';
const check = process.argv.includes('--check');

function technologiesOf(spec: Spec): Technology[] {
  return catalogSeed.filter((t) => spec.technologyIds.includes(t.id));
}
const pin = (spec: Spec): Spec => ({ ...spec, updatedAt: pinned, updatedBy: 'fixtures' });

function defaultProject() {
  const spec = pin(buildExampleSpec('00000000-0000-4000-8000-000000000001', 'en'));
  // A board part-way through delivery, so every column is represented.
  const columns: Card['column'][] = ['done', 'done', 'review', 'doing', 'todo', 'backlog'];
  const cards = cardsFromSpec(spec).map((c, i) => ({ ...c, column: columns[i % columns.length] }));
  return { spec, cards };
}

/** Text files of this repository, as the repository import would read them. */
function repositoryFiles(): Record<string, string> {
  // Only project sources: local tool folders (act, Claude, reports) differ between machines.
  const skip = /(^|\/)(node_modules|dist|coverage|storybook-static|test-results|playwright-report|lighthouse-report|perf-report|\.git|\.venv|\.runtime|\.pnpm-store|\.act|\.claude|fixtures)(\/|$)/;
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir || '.')) {
      const path = dir ? `${dir}/${name}` : name;
      if (skip.test(path)) continue;
      const info = statSync(path);
      if (info.isDirectory()) walk(path);
      else if (info.size < 200_000 && /\.(json|ya?ml|ts|tsx|md|toml|Dockerfile|mjs|js|py|txt)$|Dockerfile$|\.env\.example$/.test(name)) files[path] = readFileSync(path, 'utf8');
    }
  };
  walk('');
  return files;
}

function sddStudio() {
  let spec = createSpec('00000000-0000-4000-8000-000000000002', 'SDD Studio', 'en', false, 'Web application');
  spec.description =
    'Self-hosted workspace for writing, reviewing and publishing software design documents: 14 bilingual modules, traceability, a technology radar, AI proposals, readiness, baselines, an implementation board and Git publishing.';
  const findings = analyzeRepository(repositoryFiles());
  spec = applySpecPatch(spec, findingsToPatch(spec, catalogSeed, findings, 'en'), 'fixtures', { canReview: false });
  spec = pin({ ...spec, revision: 1 });
  const tasks = parsePlanTasks(readFileSync('.plan/tasks.md', 'utf8')).cards;
  const backlog = backlogCards(readFileSync('.plan/backlog.md', 'utf8')).cards.filter((c) => !tasks.some((t) => t.id === c.id));
  return { spec, cards: [...tasks, ...backlog], findings: findings.length };
}

async function zipOf(files: Record<string, string>) {
  const zip = new JSZip();
  for (const path of Object.keys(files).sort()) zip.file(path, files[path], { date: new Date(pinned) });
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX' });
}

export async function fixtureFiles() {
  const out: Record<string, { files: Record<string, string>; summary: Record<string, unknown> }> = {};
  const d = defaultProject();
  out['default-project'] = { files: planFolderFiles(d.spec, technologiesOf(d.spec), d.cards, pinned), summary: { name: d.spec.name, cards: d.cards.length } };
  const s = sddStudio();
  out['sdd-studio'] = { files: planFolderFiles(s.spec, technologiesOf(s.spec), s.cards, pinned), summary: { name: s.spec.name, cards: s.cards.length, findings: s.findings, stack: s.spec.stack.length } };
  return out;
}

async function main() {
  const stale: string[] = [];
  for (const [name, { files, summary }] of Object.entries(await fixtureFiles())) {
    const folder = join(root, name);
    const zipPath = join(root, `${name}.plan.zip`);
    if (check) {
      for (const [path, content] of Object.entries(files)) {
        const target = join(folder, path);
        if (!existsSync(target) || readFileSync(target, 'utf8') !== content) stale.push(target);
      }
      if (!existsSync(zipPath)) stale.push(zipPath);
      continue;
    }
    rmSync(folder, { recursive: true, force: true });
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(folder, path)), { recursive: true });
      writeFileSync(join(folder, path), content);
    }
    writeFileSync(zipPath, await zipOf(files));
    console.log(`${name}: ${Object.keys(files).length} files → ${relative('.', folder)}/.plan and ${zipPath}`, summary);
  }
  if (check) {
    if (stale.length) {
      console.error(`Fixtures are out of date (run pnpm fixtures):\n${stale.slice(0, 20).join('\n')}`);
      process.exit(1);
    }
    console.log('Fixtures are up to date.');
  }
}

if (process.argv[1]?.endsWith('generate-fixtures.ts')) await main();
