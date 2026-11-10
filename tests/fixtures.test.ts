import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';
import { fixtureFiles } from '../scripts/generate-fixtures';
import { readPlanFolder } from '../packages/shared/src/plan-folder';
import { importSchema } from '../packages/shared/src/schema';
import { canonicalJson } from '../packages/shared/src/domain';
import { buildExampleSpec } from '../packages/shared/src/example';
import { setupApp, type Harness } from './helpers';

/** fixtures/: the default example project and SDD Studio itself, as .plan Markdown folders and zips. */
const names = ['default-project', 'sdd-studio'] as const;
const folderFiles = (name: string) => {
  const base = join(__dirname, '..', 'fixtures', name);
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else out[relative(base, path).split('\\').join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(base);
  return out;
};
const zipFiles = async (name: string) => {
  const zip = await JSZip.loadAsync(readFileSync(join(__dirname, '..', 'fixtures', `${name}.plan.zip`)));
  const out: Record<string, string> = {};
  for (const entry of Object.values(zip.files)) if (!entry.dir) out[entry.name] = await entry.async('string');
  return out;
};

describe('fixtures on disk', () => {
  it('are up to date with the generator (run `pnpm fixtures` after changing .plan or the exporters)', async () => {
    const generated = await fixtureFiles();
    for (const name of names) {
      const onDisk = folderFiles(name);
      const expected = generated[name].files;
      expect(Object.keys(onDisk).sort(), name).toEqual(Object.keys(expected).sort());
      for (const [path, content] of Object.entries(expected)) expect(onDisk[path], `${name}/${path}`).toBe(content);
    }
  });

  it.each(names)('%s: the folder and the zip hold the same .plan files, a valid bundle and a board', async (name) => {
    const folder = folderFiles(name);
    expect(await zipFiles(name)).toEqual(folder);
    const content = readPlanFolder(folder);
    expect(importSchema.safeParse(content.bundle).success).toBe(true);
    expect(content.cardsFrom).toBe('board.json');
    expect(content.cards.length).toBeGreaterThan(10);
    expect(Object.keys(content.sections)).toHaveLength(14);
    expect(content.skipped).toEqual([]);
    const manifest = JSON.parse(folder['.plan/manifest.json']);
    expect(manifest.files.length).toBe(Object.keys(folder).length - 1);
  });

  it('describes this repository: detected stack, real tasks and backlog', () => {
    const folder = folderFiles('sdd-studio');
    const bundle = importSchema.parse(JSON.parse(folder['.plan/specification.json']));
    expect(bundle.spec.name).toBe('SDD Studio');
    const slugs = bundle.technologies.map((t) => t.name.toLowerCase());
    for (const expected of ['react', 'typescript', 'fastify', 'postgresql']) expect(slugs.some((s) => s.includes(expected)), expected).toBe(true);
    const cards = readPlanFolder(folder).cards;
    expect(cards.find((c) => c.id === 'TASK-096')?.column).toBe('done');
    expect(cards.some((c) => c.column === 'backlog' && c.id.startsWith('BL-'))).toBe(true);
  });
});

describe('fixtures import into SDD Studio', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('fixtures');
  });
  afterAll(async () => h?.teardown());

  it.each(names)('%s.plan.zip imports: specification as a proposal, every card on the board', async (name) => {
    const files = await zipFiles(name);
    const target = await h.createProject({ name: `Imported ${name}` });
    const preview = (await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files })).json();
    expect(preview.specification.changes).toBeGreaterThan(0);
    const applied = (await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files, preview: false, expectedBoardRevision: preview.board.revision })).json();
    expect(applied.proposalId).toBeTruthy();
    const board = (await h.request('GET', `/projects/${target.id}/board`)).json().board;
    expect(canonicalJson(board.cards)).toBe(canonicalJson(JSON.parse(files['.plan/board.json']).cards));
  });

  it('the default project round-trips: accepting the imported proposal reproduces the example answers', async () => {
    const files = await zipFiles('default-project');
    const target = await h.createProject({ name: 'Round trip' });
    const preview = (await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files })).json();
    const applied = (await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files, preview: false, expectedBoardRevision: preview.board.revision })).json();
    const accepted = await h.request('POST', `/projects/${target.id}/proposals/${applied.proposalId}/accept`, {});
    expect(accepted.statusCode).toBe(200);
    const spec = (await h.project(target.id)).spec;
    const example = buildExampleSpec(spec.id, 'en');
    for (const section of example.sections)
      expect(canonicalJson(spec.sections.find((s: { id: string }) => s.id === section.id).answers), section.id).toBe(canonicalJson(section.answers));
    expect(spec.items.map((i: { id: string }) => i.id).sort()).toEqual(example.items.map((i) => i.id).sort());
  });
});
