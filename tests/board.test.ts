import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyPlanImport,
  cardSchema,
  cardsFromSpec,
  mergeGenerated,
  moveCard,
  parsePlanTasks,
  planTasksMarkdown,
  pullRequestRef,
  suggestedColumn,
  type Card,
} from '../packages/shared/src/board';
import { buildExampleSpec } from '../packages/shared/src/example';
import { createTasksForBaseline, fetchPullRequestStatus } from '../apps/api/src/board';
import { setupApp, type Harness } from './helpers';

const card = (id: string, column: Card['column'] = 'todo', extra: Partial<Card> = {}) =>
  cardSchema.parse({ id, title: `Card ${id}`, column, ...extra });

describe('board domain', () => {
  it('creates one card per implementable item and links related items', () => {
    const spec = buildExampleSpec(crypto.randomUUID(), 'en');
    const cards = cardsFromSpec(spec);
    const workItems = spec.items.filter((i) => i.type !== 'decision' || i.status !== 'superseded');
    expect(cards.length).toBe(workItems.filter((i) => i.status !== 'superseded').length);
    const linked = spec.links[0];
    expect(cards.find((c) => c.id === linked.from)?.sourceIds).toContain(linked.to);
    expect(new Set(cards.map((c) => c.column))).toEqual(new Set(['todo']));
  });

  it('keeps progress when regenerating and marks removed items obsolete instead of deleting', () => {
    const current = [
      card('REQ-1', 'doing', {
        sourceIds: ['REQ-1'],
        pullRequests: ['https://github.com/o/r/pull/7'],
      }),
      card('REQ-2', 'todo', { sourceIds: ['REQ-2'] }),
      card('MANUAL-1', 'done'),
    ];
    const generated = [
      card('REQ-1', 'todo', { title: 'Renamed', sourceIds: ['REQ-1'] }),
      card('REQ-3', 'todo', { sourceIds: ['REQ-3'] }),
    ];
    const { cards, added, obsolete } = mergeGenerated(current, generated);
    expect(cards.find((c) => c.id === 'REQ-1')).toMatchObject({
      column: 'doing',
      title: 'Renamed',
      pullRequests: ['https://github.com/o/r/pull/7'],
    });
    expect(cards.find((c) => c.id === 'REQ-2')?.obsolete).toBe(true);
    expect(cards.find((c) => c.id === 'MANUAL-1')?.obsolete).toBe(false);
    expect(added).toEqual(['REQ-3']);
    expect(obsolete).toEqual(['REQ-2']);
  });

  it('moves cards between columns and within a column', () => {
    const cards = [card('A'), card('B'), card('C', 'doing')];
    expect(
      moveCard(cards, 'A', 'doing')
        .filter((c) => c.column === 'doing')
        .map((c) => c.id),
    ).toEqual(['C', 'A']);
    expect(
      moveCard(cards, 'A', 'doing', 0)
        .filter((c) => c.column === 'doing')
        .map((c) => c.id),
    ).toEqual(['A', 'C']);
    expect(moveCard(cards, 'B', 'todo', 0).map((c) => c.id)).toEqual(['B', 'A', 'C']);
    expect(moveCard(cards, 'missing', 'done')).toBe(cards);
  });

  it('reads .plan/tasks.md checkboxes with groups, status marks, sources and pull requests', () => {
    const { cards, skipped } = parsePlanTasks(
      [
        '# Tasks',
        '## Gate 1',
        '- [x] TASK-001 Workspace tooling.',
        '- [/] TASK-002 Board _(in review)_ — Sources: REQ-001, UC-002 — PR: https://github.com/acme/app/pull/12',
        '- [ ] Untitled follow-up https://evil.example/pull/1',
        '## Later',
        '- [-] TASK-003 Parked idea',
        '- [ ] TASK-001 Duplicate',
        '* [~] TASK-004 Started',
      ].join('\n'),
    );
    expect(cards.map((c) => [c.id, c.column, c.group])).toEqual([
      ['TASK-001', 'done', 'Gate 1'],
      ['TASK-002', 'review', 'Gate 1'],
      ['PLAN-001', 'todo', 'Gate 1'],
      ['TASK-003', 'backlog', 'Later'],
      ['TASK-004', 'doing', 'Later'],
    ]);
    expect(cards[1]).toMatchObject({
      title: 'Board',
      sourceIds: ['REQ-001', 'UC-002'],
      pullRequests: ['https://github.com/acme/app/pull/12'],
    });
    // Only GitHub, GitLab and Azure DevOps pull-request URLs are kept.
    expect(cards[2].pullRequests).toEqual([]);
    expect(skipped).toEqual(['TASK-001: duplicate identifier']);
  });

  it('round-trips the board through .plan/tasks.md', () => {
    const cards = [
      card('TASK-1', 'done', { group: 'Gate 1' }),
      card('TASK-2', 'review', {
        group: 'Gate 1',
        sourceIds: ['TASK-2', 'REQ-9'],
        pullRequests: ['https://gitlab.com/g/sub/p/-/merge_requests/3'],
      }),
      card('TASK-3', 'doing', { group: 'Gate 2' }),
      card('TASK-4', 'backlog', { group: 'Gate 2' }),
      card('TASK-5', 'todo', { group: '' }),
    ];
    const markdown = planTasksMarkdown(cards);
    expect(markdown).toContain(
      '- [/] TASK-2 Card TASK-2 _(in review)_ — Sources: REQ-9 — PR: https://gitlab.com/g/sub/p/-/merge_requests/3',
    );
    const back = parsePlanTasks(markdown).cards;
    expect(back.map((c) => [c.id, c.column, c.group || 'General'])).toEqual(
      cards.map((c) => [c.id, c.column, c.group || 'General']),
    );
    expect(back[1].pullRequests).toEqual(cards[1].pullRequests);
    expect(back[1].sourceIds).toEqual(['REQ-9']);
  });

  it('upserts imported tasks without dropping cards absent from the import', () => {
    const { cards, added, updated } = applyPlanImport(
      [card('A', 'todo', { assignee: 'Sam' }), card('B')],
      [card('A', 'done'), card('C')],
    );
    expect(cards.map((c) => [c.id, c.column])).toEqual([
      ['A', 'done'],
      ['B', 'todo'],
      ['C', 'todo'],
    ]);
    expect(cards[0].assignee).toBe('Sam');
    expect(added).toEqual(['C']);
    expect(updated).toEqual(['A']);
  });

  it('recognises only GitHub, GitLab and Azure DevOps pull requests', () => {
    expect(pullRequestRef('https://github.com/acme/app/pull/12')).toEqual({
      provider: 'github',
      owner: 'acme',
      repo: 'app',
      number: 12,
    });
    expect(pullRequestRef('https://gitlab.com/group/sub/proj/-/merge_requests/4')).toEqual({
      provider: 'gitlab',
      project: 'group/sub/proj',
      number: 4,
    });
    expect(
      pullRequestRef('https://dev.azure.com/org/My%20Project/_git/repo/pullrequest/9'),
    ).toEqual({
      provider: 'azure',
      organization: 'org',
      project: 'My Project',
      repository: 'repo',
      number: 9,
    });
    for (const bad of [
      'http://github.com/a/b/pull/1',
      'https://github.com.evil.test/a/b/pull/1',
      'https://example.com/pull/1',
      'https://github.com/a/b/issues/1',
    ])
      expect(pullRequestRef(bad)).toBeNull();
  });

  it('reads pull-request status per provider and never throws on provider errors', async () => {
    const calls: string[] = [];
    const fake = (routes: Record<string, unknown>) =>
      (async (url: string, init: RequestInit) => {
        calls.push(`${url} ${JSON.stringify(init.headers)}`);
        const key = Object.keys(routes).find((k) => url.includes(k));
        return key
          ? new Response(JSON.stringify(routes[key]))
          : new Response('{}', { status: 404 });
      }) as unknown as typeof fetch;
    const github = await fetchPullRequestStatus(
      'https://github.com/o/r/pull/1',
      { provider: 'github', owner: 'o', repo: 'r', number: 1 },
      { github: 'gh-token' },
      fake({
        '/pulls/1/reviews': [{ user: { login: 'a' }, state: 'APPROVED' }],
        '/pulls/1': {
          title: 'Add board',
          state: 'open',
          draft: false,
          merged: false,
          head: { sha: 'abc' },
          updated_at: '2026-09-27',
        },
        '/check-runs': {
          check_runs: [{ status: 'completed', conclusion: 'success' }, { status: 'in_progress' }],
        },
      }),
    );
    expect(github).toMatchObject({
      state: 'open',
      checks: 'pending',
      reviews: 'approved',
      title: 'Add board',
    });
    expect(calls[0]).toContain('Bearer gh-token');
    const gitlab = await fetchPullRequestStatus(
      'https://gitlab.com/g/p/-/merge_requests/2',
      { provider: 'gitlab', project: 'g/p', number: 2 },
      {},
      fake({
        '/approvals': { approved: false },
        '/merge_requests/2': { title: 'MR', state: 'merged', head_pipeline: { status: 'success' } },
      }),
    );
    expect(gitlab).toMatchObject({ state: 'merged', checks: 'passing', reviews: 'pending' });
    const azure = await fetchPullRequestStatus(
      'https://dev.azure.com/o/p/_git/r/pullrequest/3',
      { provider: 'azure', organization: 'o', project: 'p', repository: 'r', number: 3 },
      {},
      fake({
        '/statuses': { value: [{ state: 'failed' }] },
        'pullrequests/3?': {
          title: 'PR',
          status: 'active',
          isDraft: false,
          reviewers: [{ vote: -10 }],
        },
      }),
    );
    expect(azure).toMatchObject({ state: 'open', checks: 'failing', reviews: 'changes-requested' });
    const failed = await fetchPullRequestStatus(
      'https://github.com/o/r/pull/9',
      { provider: 'github', owner: 'o', repo: 'r', number: 9 },
      {},
      fake({}),
    );
    expect(failed.state).toBe('unknown');
    expect(failed.error).toMatch(/404/);
    expect(suggestedColumn([github])).toBe('review');
    expect(suggestedColumn([gitlab])).toBe('done');
    expect(suggestedColumn([])).toBeNull();
  });
});

describe('board API', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setupApp('board');
  });
  afterAll(async () => h?.teardown());

  const approve = async (projectId: string) => {
    const p = await h.project(projectId);
    // The board test needs a baseline, not the readiness workflow covered in api.test.ts.
    await h.db
      .collection('baselines')
      .insertOne({
        id: crypto.randomUUID(),
        projectId,
        revision: p.spec.revision,
        spec: p.spec,
        note: '',
        approvedBy: 'test',
        approvedAt: new Date().toISOString(),
      });
  };

  it('requires a baseline, then generates cards and guards revisions', async () => {
    const p = await h.createProject({ name: 'Board', sample: true });
    expect(
      (await h.request('POST', `/projects/${p.id}/board/generate`, { expectedRevision: 0 }))
        .statusCode,
    ).toBe(409);
    await approve(p.id);
    const generated = await h.request('POST', `/projects/${p.id}/board/generate`, {
      expectedRevision: 0,
    });
    expect(generated.statusCode).toBe(200);
    const { board, added } = generated.json();
    expect(board.revision).toBe(1);
    expect(added.length).toBeGreaterThan(3);

    const moved = moveCard(board.cards, board.cards[0].id, 'doing');
    expect(
      (await h.request('PUT', `/projects/${p.id}/board`, { expectedRevision: 1, cards: moved }))
        .statusCode,
    ).toBe(200);
    const stale = await h.request('PUT', `/projects/${p.id}/board`, {
      expectedRevision: 1,
      cards: board.cards,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().details ?? stale.json()).toMatchObject({ currentRevision: 2 });

    // Regenerating keeps the move.
    const again = (
      await h.request('POST', `/projects/${p.id}/board/generate`, { expectedRevision: 2 })
    ).json();
    expect(again.board.cards.find((c: Card) => c.id === board.cards[0].id).column).toBe('doing');
    expect(again.added).toEqual([]);
  });

  it('splits the project into epics with dependencies, and refreshes without losing progress', async () => {
    const p = await h.createProject({ name: 'Plan', sample: true });
    await approve(p.id);
    const first = (await h.request('POST', `/projects/${p.id}/board/generate`, { expectedRevision: 0 })).json();
    expect(first.summary).toMatchObject({ epics: 4, derivedTests: 0 });
    // The sample project chose a stack, so each layer with technologies gets a foundation task from the catalog.
    expect(first.summary.foundations).toBeGreaterThan(0);
    expect(first.board.cards.filter((c: Card) => c.group === 'Foundations').every((c: Card) => /^SETUP-\d\d$/.test(c.id) && c.sourceIds[0].startsWith('stack:'))).toBe(true);
    expect(first.gaps).toEqual(['CMP-004 implements no requirement.', 'REQ-004 is not implemented by any component.']);
    expect(first.board.cards.find((c: Card) => c.id === 'CMP-001')).toMatchObject({ group: 'CMP-001 Web app', dependsOn: ['REQ-003', 'REQ-006'] });
    // Dependencies survive the board's own save, and the .plan export writes them.
    const moved = moveCard(first.board.cards, 'REQ-001', 'doing');
    const saved = (await h.request('PUT', `/projects/${p.id}/board`, { expectedRevision: 1, cards: moved })).json().board;
    expect(saved.cards.find((c: Card) => c.id === 'UC-001').dependsOn).toEqual(['REQ-001']);
    const exported = (await h.request('GET', `/projects/${p.id}/board/export-plan`)).body;
    expect(exported).toContain('- [ ] CMP-001 Web app — Sources: REQ-003, REQ-006 — After: REQ-003, REQ-006');

    // A later baseline adds only what is new; the card that was started stays where it is.
    const spec = (await h.project(p.id)).spec;
    await h.patch(p.id, spec.revision, { items: [{ id: 'REQ-007', type: 'requirement', title: 'Export a request', status: 'accepted', acceptance: 'A CSV file downloads', priority: 'must' }] });
    await approve(p.id);
    const again = (await h.request('POST', `/projects/${p.id}/board/generate`, { expectedRevision: saved.revision })).json();
    expect(again.added).toEqual(['REQ-007', 'REQ-007.tests']);
    expect(again.obsolete).toEqual([]);
    expect(again.board.cards.find((c: Card) => c.id === 'REQ-001').column).toBe('doing');
    expect(again.board.cards.find((c: Card) => c.id === 'REQ-007.tests')).toMatchObject({ dependsOn: ['REQ-007'], sourceIds: ['REQ-007'] });
  });

  it('never fails a baseline approval when the tasks cannot be created, and leaves the reason in the audit log', async () => {
    const p = await h.createProject({ name: 'Broken plan' });
    const broken = { id: crypto.randomUUID(), revision: 1, approvedAt: new Date().toISOString(), spec: { items: null } as never };
    expect(await createTasksForBaseline(p.id, broken, 'user-1')).toBeNull();
    const skipped = await h.db.collection('audit').findOne({ projectId: p.id, action: 'board.generate-skipped' });
    expect(skipped?.details).toMatchObject({ via: 'baseline', baselineId: broken.id });
    expect(String(skipped?.details?.reason)).not.toBe('');
    expect((await h.request('GET', `/projects/${p.id}/board`)).json().board.cards).toEqual([]);
  });

  it('imports and exports .plan/tasks.md, with a preview that does not save', async () => {
    const p = await h.createProject();
    const markdown =
      '## Gate\n- [x] TASK-001 Done thing\n- [ ] TASK-002 Next — PR: https://github.com/acme/app/pull/5\n';
    const preview = (
      await h.request('POST', `/projects/${p.id}/board/import-plan`, {
        expectedRevision: 0,
        markdown,
        preview: true,
      })
    ).json();
    expect(preview).toMatchObject({ preview: true, added: ['TASK-001', 'TASK-002'] });
    expect((await h.request('GET', `/projects/${p.id}/board`)).json().board.revision).toBe(0);
    const imported = await h.request('POST', `/projects/${p.id}/board/import-plan`, {
      expectedRevision: 0,
      markdown,
    });
    expect(imported.json().board.revision).toBe(1);
    const exported = await h.request('GET', `/projects/${p.id}/board/export-plan`);
    expect(exported.headers['content-type']).toContain('text/markdown');
    expect(exported.body).toContain('- [x] TASK-001 Done thing');
    expect(exported.body).toContain('PR: https://github.com/acme/app/pull/5');
  });

  it('lets viewers read the board but not change it, and rejects foreign pull-request hosts', async () => {
    const p = await h.createProject();
    const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
    expect(
      (await h.request('GET', `/projects/${p.id}/board`, undefined, viewer.cookie)).statusCode,
    ).toBe(200);
    expect(
      (await h.request('GET', `/projects/${p.id}/board/export-plan`, undefined, viewer.cookie))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await h.request(
          'PUT',
          `/projects/${p.id}/board`,
          { expectedRevision: 0, cards: [] },
          viewer.cookie,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await h.request(
          'POST',
          `/projects/${p.id}/board/import-plan`,
          { expectedRevision: 0, markdown: '- [ ] A' },
          viewer.cookie,
        )
      ).statusCode,
    ).toBe(403);
    const bad = await h.request('PUT', `/projects/${p.id}/board`, {
      expectedRevision: 0,
      cards: [{ ...card('A'), pullRequests: ['https://internal.example/pull/1'] }],
    });
    expect(bad.statusCode).toBe(400);
    const outsider = await h.userWith('Editor');
    expect(
      (await h.request('GET', `/projects/${p.id}/board`, undefined, outsider.cookie)).statusCode,
    ).toBe(403);
  });
});
