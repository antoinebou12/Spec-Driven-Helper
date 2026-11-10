import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { backlogCards, backlogId, boardPlanFiles, normalizePlanPath, readPlanFolder } from '../packages/shared/src/plan-folder';
import { cardSchema } from '../packages/shared/src/board';
import { setupApp, type Harness } from './helpers';

const card = (id: string, column: 'backlog' | 'todo' | 'doing' | 'review' | 'done', group = '') => cardSchema.parse({ id, title: `Card ${id}`, column, group });

describe('.plan folder reading', () => {
  it('normalises paths to .plan/ and refuses unsafe ones', () => {
    expect(normalizePlanPath('repo/.plan/spec/01-discovery.md')).toBe('.plan/spec/01-discovery.md');
    expect(normalizePlanPath('.plan\\tasks.md')).toBe('.plan/tasks.md');
    expect(normalizePlanPath('./.plan/backlog.md')).toBe('.plan/backlog.md');
    for (const bad of ['../.plan/tasks.md', '/etc/.plan/x', 'C:/x/.plan/a.md', 'src/index.ts', '.plan/', '.plan/../secrets']) expect(normalizePlanPath(bad), bad).toBeNull();
  });

  it('turns backlog bullets into stable cards and skips generated lists', () => {
    const md = [
      '# Open questions and backlog',
      '## Readiness blockers',
      '- discovery: review required',
      '## Unknown answers',
      '- None',
      '## Deferred work',
      '- Helm chart for Kubernetes',
      '- **Bold** alert delivery',
      '- [ ] TASK-9 Parked task',
      '- [x] TASK-10 Finished task',
    ].join('\n');
    const { cards } = backlogCards(md);
    expect(cards.map((c) => [c.title, c.column, c.group])).toEqual([
      ['Parked task', 'backlog', 'Deferred work'],
      ['Finished task', 'done', 'Deferred work'],
      ['Helm chart for Kubernetes', 'backlog', 'Deferred work'],
      ['Bold alert delivery', 'backlog', 'Deferred work'],
    ]);
    expect(backlogCards(md).cards.map((c) => c.id)).toEqual(cards.map((c) => c.id));
    expect(backlogId('a')).toMatch(/^BL-[0-9A-F]{6}$/);
    expect(backlogId('Deferred work:X')).not.toBe(backlogId('Other:X'));
  });

  it('prefers the lossless board.json, and falls back to tasks and backlog Markdown', () => {
    const cards = [card('T-1', 'doing', 'Gate'), card('T-2', 'backlog', 'Later')];
    const files = boardPlanFiles(cards, 'Tasks');
    expect(Object.keys(files).sort()).toEqual(['.plan/board-backlog.md', '.plan/board.json', '.plan/tasks.md']);
    expect(readPlanFolder(files)).toMatchObject({ cardsFrom: 'board.json', cards });
    const { ['.plan/board.json']: _json, ...markdown } = files;
    const fromMarkdown = readPlanFolder(markdown);
    expect(fromMarkdown.cardsFrom).toBe('markdown');
    expect(fromMarkdown.cards.map((c) => [c.id, c.column])).toEqual([
      ['T-1', 'doing'],
      ['T-2', 'backlog'],
    ]);
  });

  it('lists unsafe, oversize and unknown files instead of using them', () => {
    const result = readPlanFolder({
      '../.plan/tasks.md': '- [ ] X-1 a',
      'src/app.ts': 'code',
      '.plan/notes/random.txt': 'hello',
      '.plan/specification.json': '{not json',
      '.plan/board.json': '{"format":"other"}',
      '.plan/designs.md': '# Designs',
    });
    expect(result.cards).toEqual([]);
    expect(result.skipped.join('\n')).toMatch(/\.\.\/\.plan\/tasks\.md: outside/);
    expect(result.skipped.join('\n')).toMatch(/specification\.json: not valid JSON/);
    expect(result.skipped.join('\n')).toMatch(/board\.json: not a valid board file/);
    expect(result.skipped.join('\n')).toMatch(/random\.txt: not imported/);
    expect(result.skipped.join('\n')).not.toMatch(/designs\.md/);
    expect(() => readPlanFolder(Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`.plan/f${i}.md`, ''])))).toThrow(/at most/);
  });

  it("reads this repository's own .plan folder", () => {
    const root = join(__dirname, '..', '.plan');
    const files = Object.fromEntries(readdirSync(root).filter((f) => f.endsWith('.md')).map((f) => [`.plan/${f}`, readFileSync(join(root, f), 'utf8')]));
    const result = readPlanFolder(files);
    expect(result.cardsFrom).toBe('markdown');
    expect(result.cards.find((c) => c.id === 'TASK-041')?.column).toBe('done');
    expect(result.cards.some((c) => c.column === 'backlog' && c.id.startsWith('BL-'))).toBe(true);
    expect(new Set(result.cards.map((c) => c.id)).size).toBe(result.cards.length);
  });
});

describe('.plan folder API', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('plan_folder');
  });
  afterAll(async () => h?.teardown());

  const unzip = async (body: Buffer) => {
    const zip = await JSZip.loadAsync(body);
    const files: Record<string, string> = {};
    for (const entry of Object.values(zip.files)) if (!entry.dir) files[entry.name] = await entry.async('string');
    return files;
  };

  it('exports everything and imports it into another project: spec as a proposal, board as cards', async () => {
    const source = await h.createProject({ name: 'Plan source', sample: true });
    const p = await h.project(source.id);
    await h.db.collection('baselines').insertOne({ id: crypto.randomUUID(), projectId: source.id, revision: p.spec.revision, spec: p.spec, note: '', approvedBy: 'test', approvedAt: new Date().toISOString() });
    const generated = (await h.request('POST', `/projects/${source.id}/board/generate`, { expectedRevision: 0 })).json().board;
    const moved = generated.cards.map((c: any, i: number) => (i === 0 ? { ...c, column: 'doing' } : i === 1 ? { ...c, column: 'backlog' } : c));
    await h.request('PUT', `/projects/${source.id}/board`, { expectedRevision: 1, cards: moved });

    const exported = await h.app.inject({ method: 'GET', url: `/api/v1/projects/${source.id}/plan-folder`, headers: { cookie: h.cookie } });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers['content-disposition']).toContain('plan-source-plan-r');
    const files = await unzip(exported.rawPayload);
    for (const path of ['.plan/specification.json', '.plan/tasks.md', '.plan/board-backlog.md', '.plan/board.json', '.plan/backlog.md', '.plan/manifest.json', '.plan/spec/01-discovery.md'])
      expect(Object.keys(files), path).toContain(path);
    expect(Object.keys(files).every((f) => f.startsWith('.plan/'))).toBe(true);
    expect(files['.plan/tasks.md']).toContain(`- [/] ${moved[0].id} `);
    expect(files['.plan/board-backlog.md']).toContain(`- [-] ${moved[1].id} `);

    const target = await h.createProject({ name: 'Plan target' });
    const before = (await h.project(target.id)).spec.revision;
    const preview = (await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files, preview: true })).json();
    expect(preview.preview).toBe(true);
    expect(preview.specification.changes).toBeGreaterThan(10);
    expect(preview.board).toMatchObject({ from: 'board.json', revision: 0 });
    expect(preview.board.added).toHaveLength(moved.length);
    expect((await h.request('GET', `/projects/${target.id}/board`)).json().board.revision).toBe(0);

    const missingRevision = await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files, preview: false });
    expect(missingRevision.statusCode).toBe(400);
    const applied = (await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files, preview: false, expectedBoardRevision: 0 })).json();
    expect(applied.proposalId).toBeTruthy();
    expect(applied.board.revision).toBe(1);
    // The specification is never written directly: it waits in a proposal.
    expect((await h.project(target.id)).spec.revision).toBe(before);
    const proposals = (await h.request('GET', `/projects/${target.id}/proposals`)).json();
    const list = Array.isArray(proposals) ? proposals : proposals.proposals;
    expect(list.find((x: any) => x.id === applied.proposalId)).toMatchObject({ origin: 'import', status: 'pending' });
    const board = (await h.request('GET', `/projects/${target.id}/board`)).json().board;
    expect(board.cards.map((c: any) => [c.id, c.column])).toEqual(moved.map((c: any) => [c.id, c.column]));
  });

  it('imports section documents alone as a proposal, and respects roles and the import flag', async () => {
    const target = await h.createProject();
    const files = { 'repo/.plan/spec/01-discovery.md': '# Business & discovery\n\nWritten outside SDD Studio.\n' };
    const preview = (await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files })).json();
    expect(preview.specification).toMatchObject({ source: '.plan/spec/*.md', changes: 1 });
    const viewer = await h.userWith('Viewer', { projectId: target.id, role: 'Viewer' });
    expect((await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files }, viewer.cookie)).statusCode).toBe(403);
    expect((await h.request('GET', `/projects/${target.id}/plan-folder`, undefined, viewer.cookie)).statusCode).toBe(200);
    await h.request('PUT', '/admin/features', { features: { import: false } });
    expect((await h.request('POST', `/projects/${target.id}/plan-folder/import`, { files })).json()).toMatchObject({ code: 'feature-disabled' });
    await h.request('PUT', '/admin/features', { features: { import: true } });
  });

  it('rejects an invalid specification bundle without failing the rest', async () => {
    const target = await h.createProject();
    const res = (
      await h.request('POST', `/projects/${target.id}/plan-folder/import`, {
        files: { '.plan/specification.json': JSON.stringify({ format: 'sdd-studio', version: 1, spec: { nope: true } }), '.plan/tasks.md': '- [ ] T-1 Do it' },
      })
    ).json();
    expect(res.specification.source).toBeNull();
    expect(res.skipped.join('\n')).toMatch(/specification\.json/);
    expect(res.board.added).toEqual(['T-1']);
  });
});
