import { describe, expect, it } from 'vitest';
import {
  applyPlanImport,
  cardSchema,
  cardsFromSpec,
  mergeGenerated,
  parsePlanTasks,
  planTasksMarkdown,
  type Card,
} from '../packages/shared/src/board';
import { breakIntoTasks, readyCards } from '../packages/shared/src/task-plan';
import { createSpec } from '../packages/shared/src/domain';
import { buildExampleSpec } from '../packages/shared/src/example';
import { canonicalJson } from '../packages/shared/src/domain';
import { itemSchema, linkSchema, type Spec } from '../packages/shared/src/schema';

/**
 * Splitting a correct (approved) specification into tasks: deterministic, grounded in the items and
 * links, kind to boards that already exist, and readable in .plan/tasks.md.
 */
const spec = (
  items: Partial<Spec['items'][number]>[],
  links: [string, string, string][] = [],
  language: 'en' | 'fr' = 'en',
): Spec => ({
  ...createSpec('00000000-0000-4000-8000-0000000000c1', 'Plan', language, false, 'Web application'),
  items: items.map((i) =>
    itemSchema.parse({
      title: `Title of ${i.id}`,
      status: 'accepted',
      acceptance: `Accept ${i.id}`,
      ...i,
    }),
  ),
  links: links.map(([from, to, kind], n) =>
    linkSchema.parse({ id: `LINK-${n + 1}`, from, to, kind }),
  ),
});
const plan = (s: Spec, stack?: Parameters<typeof breakIntoTasks>[1]) => breakIntoTasks(s, stack);
const ids = (cards: Card[]) => cards.map((c) => c.id);
const card = (cards: Card[], id: string) => cards.find((c) => c.id === id)!;

describe('task plan from the example project', () => {
  const example = buildExampleSpec('00000000-0000-4000-8000-0000000000c2', 'en');
  const result = plan(example, { stack: { frontend: ['React', 'Vite'], data: ['PostgreSQL'] } });

  it('keeps every item as a task under its own identifier, and adds only foundations', () => {
    const items = example.items.filter((i) => i.status !== 'superseded').map((i) => i.id);
    expect(
      ids(result.cards)
        .filter((id) => !id.startsWith('SETUP-'))
        .sort(),
    ).toEqual([...items].sort());
    expect(ids(result.cards).filter((id) => id.startsWith('SETUP-'))).toEqual([
      'SETUP-01',
      'SETUP-05',
    ]);
    expect(new Set(ids(result.cards)).size).toBe(result.cards.length);
    expect(result.summary).toMatchObject({
      tasks: result.cards.length,
      epics: 4,
      foundations: 2,
      derivedTests: 0,
      backlog: 0,
    });
    // Same cards as the flat list, so a board built that way keeps working.
    expect(ids(cardsFromSpec(example)).every((id) => ids(result.cards).includes(id))).toBe(true);
  });

  it('orders the work: foundations, decisions, one epic per component, then the rest', () => {
    const order = [...new Set(result.cards.map((c) => c.group))];
    expect(order).toEqual([
      'Foundations',
      'Decisions',
      'CMP-001 Web app',
      'CMP-002 Request API',
      'CMP-003 Notification worker',
      'CMP-004 Request store',
      'Requirements without a component',
      'Use cases',
      'Risk mitigations',
      'Verification',
    ]);
    const epic = ids(result.cards.filter((c) => c.group === 'CMP-002 Request API'));
    expect(epic.at(-1)).toBe('CMP-002');
    expect(epic.indexOf('REQ-001')).toBeLessThan(epic.indexOf('TEST-001'));
  });

  it('puts tests beside the requirement they verify and loose ones under Verification', () => {
    expect(card(result.cards, 'TEST-001').group).toBe('CMP-002 Request API');
    expect(card(result.cards, 'TEST-004').group).toBe('Requirements without a component');
    expect(card(result.cards, 'TEST-007').group).toBe('Verification');
  });

  it('makes a component wait for its requirements and use cases wait for theirs', () => {
    expect(card(result.cards, 'CMP-001').dependsOn).toEqual(['REQ-003', 'REQ-006']);
    expect(card(result.cards, 'UC-001').dependsOn).toEqual(['REQ-001']);
    // The specification's own depends-on link between components is kept.
    expect(card(result.cards, 'CMP-002').dependsOn).toContain('CMP-004');
    for (const c of result.cards)
      for (const id of c.dependsOn) expect(ids(result.cards), `${c.id} → ${id}`).toContain(id);
  });

  it('reports what the specification is missing instead of hiding it', () => {
    expect(result.gaps).toEqual([
      'CMP-004 implements no requirement.',
      'REQ-004 is not implemented by any component.',
    ]);
  });

  it('gives the same plan every time, and leaves a board that already has it unchanged', () => {
    expect(
      canonicalJson(
        plan(example, { stack: { frontend: ['React', 'Vite'], data: ['PostgreSQL'] } }),
      ),
    ).toBe(canonicalJson(result));
    const again = mergeGenerated(result.cards, result.cards);
    expect(again.added).toEqual([]);
    expect(again.obsolete).toEqual([]);
    expect(again.cards).toEqual(result.cards);
  });

  it('refreshes a board built from the flat list without losing progress or marking anything obsolete', () => {
    const flat = cardsFromSpec(example).map((c, i) => ({
      ...c,
      column: (['todo', 'doing', 'review', 'done'] as const)[i % 4],
      assignee: 'ana',
      pullRequests: i === 0 ? ['https://github.com/o/r/pull/1'] : [],
    }));
    const merged = mergeGenerated(flat, result.cards);
    expect(merged.obsolete).toEqual([]);
    expect(merged.added).toEqual(['SETUP-01', 'SETUP-05']);
    for (const before of flat) {
      const after = card(merged.cards, before.id);
      expect([after.column, after.assignee, after.pullRequests]).toEqual([
        before.column,
        before.assignee,
        before.pullRequests,
      ]);
      expect(after.group).toBe(card(result.cards, before.id).group);
      expect(after.dependsOn).toEqual(card(result.cards, before.id).dependsOn);
    }
  });
});

describe('task plan rules', () => {
  it('orders an epic by priority and parks "won\'t" in the backlog', () => {
    const s = spec(
      [
        { id: 'CMP-1', type: 'component' },
        { id: 'REQ-1', type: 'requirement', priority: 'could' },
        { id: 'REQ-2', type: 'requirement', priority: 'must' },
        { id: 'REQ-3', type: 'requirement' },
        { id: 'REQ-4', type: 'requirement', priority: 'should' },
        { id: 'REQ-5', type: 'requirement', priority: 'wont' },
      ],
      ['REQ-1', 'REQ-2', 'REQ-3', 'REQ-4', 'REQ-5'].map(
        (r) => ['CMP-1', r, 'implements'] as [string, string, string],
      ),
    );
    const result = plan(s);
    expect(
      ids(result.cards.filter((c) => c.group === 'CMP-1 Title of CMP-1')).filter(
        (id) => id.startsWith('REQ') && !id.endsWith('.tests'),
      ),
    ).toEqual(['REQ-2', 'REQ-4', 'REQ-1', 'REQ-3', 'REQ-5']);
    expect(card(result.cards, 'REQ-5').column).toBe('backlog');
    expect(card(result.cards, 'REQ-2').column).toBe('todo');
    expect(result.summary.backlog).toBe(1);
  });

  it('adds a test task for a requirement that has none, with a stable identifier', () => {
    const s = spec([
      { id: 'REQ-1', type: 'requirement', title: 'Sign in' },
      { id: 'REQ-2', type: 'requirement', priority: 'wont' },
      { id: 'REQ-3', type: 'requirement', acceptance: '' },
    ]);
    const result = plan(s);
    expect(card(result.cards, 'REQ-1.tests')).toMatchObject({
      title: 'Write tests for REQ-1: Sign in',
      body: 'Accept REQ-1',
      sourceIds: ['REQ-1'],
      dependsOn: ['REQ-1'],
      group: 'Requirements without a component',
    });
    expect(ids(result.cards)).not.toContain('REQ-2.tests');
    expect(result.summary.derivedTests).toBe(2);
    expect(result.gaps).toContain(
      'REQ-3 has no acceptance criteria, so nothing says what its tests must check.',
    );
    expect(ids(plan(s).cards)).toEqual(ids(result.cards));
  });

  it('does not add a test task when a test already verifies the requirement', () => {
    const s = spec(
      [
        { id: 'REQ-1', type: 'requirement' },
        { id: 'TEST-1', type: 'test' },
      ],
      [['TEST-1', 'REQ-1', 'tests']],
    );
    expect(ids(plan(s).cards)).toEqual(['REQ-1', 'TEST-1']);
  });

  it('leaves out superseded items', () => {
    const s = spec([
      { id: 'REQ-1', type: 'requirement', status: 'superseded' },
      { id: 'REQ-2', type: 'requirement' },
    ]);
    expect(ids(plan(s).cards)).not.toContain('REQ-1');
  });

  it('makes a use case wait for its requirements and reports one that nothing satisfies', () => {
    const s = spec(
      [
        { id: 'REQ-1', type: 'requirement' },
        { id: 'REQ-2', type: 'requirement' },
        { id: 'UC-1', type: 'use-case' },
        { id: 'UC-2', type: 'use-case' },
      ],
      [
        ['UC-1', 'REQ-1', 'satisfies'],
        ['REQ-2', 'UC-1', 'refines'],
      ],
    );
    const result = plan(s);
    expect(card(result.cards, 'UC-1').dependsOn).toEqual(['REQ-1', 'REQ-2']);
    expect(card(result.cards, 'UC-2').dependsOn).toEqual([]);
    expect(result.gaps).toContain('UC-2 is satisfied by no requirement.');
  });

  it("keeps the specification's depends-on links, drops one that would loop, and says so", () => {
    const s = spec(
      [
        { id: 'REQ-1', type: 'requirement' },
        { id: 'REQ-2', type: 'requirement' },
        { id: 'REQ-3', type: 'requirement' },
      ],
      [
        ['REQ-1', 'REQ-2', 'depends-on'],
        ['REQ-2', 'REQ-3', 'depends-on'],
        ['REQ-3', 'REQ-1', 'depends-on'],
      ],
    );
    const result = plan(s);
    expect(card(result.cards, 'REQ-1').dependsOn).toEqual(['REQ-2']);
    expect(card(result.cards, 'REQ-2').dependsOn).toEqual(['REQ-3']);
    expect(card(result.cards, 'REQ-3').dependsOn).toEqual([]);
    expect(result.gaps).toContain(
      'REQ-3 and REQ-1 depend on each other; the dependency of REQ-3 on REQ-1 was ignored.',
    );
    expect(result.gaps.filter((g) => /depend on each other/.test(g))).toHaveLength(1);
  });

  it('lets a draft decision block the component it decides, but not an accepted one', () => {
    const s = spec(
      [
        { id: 'CMP-1', type: 'component' },
        { id: 'CMP-2', type: 'component' },
        { id: 'ADR-1', type: 'decision', status: 'draft' },
        { id: 'ADR-2', type: 'decision', status: 'accepted' },
      ],
      [
        ['ADR-1', 'CMP-1', 'decides'],
        ['ADR-2', 'CMP-2', 'decides'],
      ],
    );
    const result = plan(s);
    expect(card(result.cards, 'CMP-1').dependsOn).toEqual(['ADR-1']);
    expect(card(result.cards, 'CMP-2').dependsOn).toEqual([]);
  });

  it('adds one foundation task per stack layer that has technologies, in layer order', () => {
    const s = spec([{ id: 'REQ-1', type: 'requirement' }]);
    expect(ids(plan(s).cards).filter((id) => id.startsWith('SETUP'))).toEqual([]);
    const result = plan(s, {
      stack: { data: ['PostgreSQL'], backend: ['Node.js', 'Fastify'], cicd: [], frontend: [''] },
    });
    expect(
      result.cards
        .filter((c) => c.group === 'Foundations')
        .map((c) => [c.id, c.title, c.sourceIds]),
    ).toEqual([
      ['SETUP-02', 'Set up the backend: Node.js, Fastify', ['stack:backend']],
      ['SETUP-05', 'Set up data storage: PostgreSQL', ['stack:data']],
    ]);
  });

  it('writes the plan in French for a French project', () => {
    const s = spec(
      [
        { id: 'CMP-1', type: 'component' },
        { id: 'REQ-1', type: 'requirement', title: 'Se connecter' },
        { id: 'UC-1', type: 'use-case' },
      ],
      [],
      'fr',
    );
    const result = plan(s, { stack: { data: ['PostgreSQL'] } });
    expect(result.cards.map((c) => c.group)).toEqual([
      'Mise en place',
      'CMP-1 Title of CMP-1',
      'Exigences sans composant',
      'Exigences sans composant',
      'Cas d’utilisation',
    ]);
    expect(card(result.cards, 'SETUP-05').title).toBe(
      'Mettre en place le stockage des données : PostgreSQL',
    );
    expect(card(result.cards, 'REQ-1.tests').title).toBe(
      'Écrire les tests de REQ-1 : Se connecter',
    );
    expect(result.gaps).toEqual([
      'CMP-1 n’implémente aucune exigence.',
      'REQ-1 n’est implémentée par aucun composant.',
      'UC-1 n’est satisfait par aucune exigence.',
    ]);
  });

  it('stops at the board limit and says so', () => {
    const s = spec(
      Array.from({ length: 2100 }, (_, i) => ({
        id: `REQ-${i + 1}`,
        type: 'requirement' as const,
      })),
    );
    const result = plan(s);
    expect(result.cards).toHaveLength(2000);
    // Hundreds of findings are summarised, and the limit is the first thing said.
    expect(result.gaps[0]).toMatch(/more than 2000 tasks/);
    expect(result.gaps).toHaveLength(102);
    expect(result.gaps.at(-1)).toMatch(/^…and \d+ more\.$/);
  });
});

describe('dependencies in .plan/tasks.md', () => {
  const example = buildExampleSpec('00000000-0000-4000-8000-0000000000c3', 'en');
  const result = plan(example, { stack: { frontend: ['React'] } });

  it('are written as "After:" and read back with group, column and identifier', () => {
    const markdown = planTasksMarkdown(result.cards, 'Plan');
    expect(markdown).toContain(
      '- [ ] CMP-001 Web app — Sources: REQ-003, REQ-006 — After: REQ-003, REQ-006',
    );
    expect(markdown).toContain(
      '- [ ] SETUP-01 Set up the frontend: React — Sources: stack:frontend',
    );
    const back = parsePlanTasks(markdown);
    expect(back.skipped).toEqual([]);
    expect(back.cards.map((c) => [c.id, c.group, c.column, c.dependsOn])).toEqual(
      result.cards.map((c) => [c.id, c.group, c.column, c.dependsOn]),
    );
    expect(card(back.cards, 'SETUP-01').sourceIds).toEqual(['stack:frontend']);
  });

  it('survive a round trip next to pull requests and the in-review marker', () => {
    const cards = [
      cardSchema.parse({
        id: 'REQ-1',
        title: 'One',
        column: 'review',
        group: 'G',
        sourceIds: ['UC-1'],
        dependsOn: ['REQ-0', 'REQ-0.tests'],
        pullRequests: ['https://github.com/o/r/pull/3'],
      }),
    ];
    const markdown = planTasksMarkdown(cards);
    expect(markdown).toContain(
      '- [/] REQ-1 One _(in review)_ — Sources: UC-1 — After: REQ-0, REQ-0.tests — PR: https://github.com/o/r/pull/3',
    );
    expect(parsePlanTasks(markdown).cards[0]).toMatchObject({
      id: 'REQ-1',
      title: 'One',
      column: 'review',
      sourceIds: ['UC-1'],
      dependsOn: ['REQ-0', 'REQ-0.tests'],
      pullRequests: ['https://github.com/o/r/pull/3'],
    });
  });

  it('are added to, not replaced, when an existing .plan/tasks.md is imported', () => {
    const current = [
      cardSchema.parse({ id: 'REQ-1', title: 'One', column: 'todo', dependsOn: ['REQ-0'] }),
    ];
    const imported = parsePlanTasks(
      '## G\n- [x] REQ-1 One — After: REQ-9\n- [ ] REQ-2 Two — After: REQ-1\n',
    ).cards;
    const { cards, added, updated } = applyPlanImport(current, imported);
    expect(added).toEqual(['REQ-2']);
    expect(updated).toEqual(['REQ-1']);
    expect(card(cards, 'REQ-1')).toMatchObject({ column: 'done', dependsOn: ['REQ-0', 'REQ-9'] });
    expect(card(cards, 'REQ-2').dependsOn).toEqual(['REQ-1']);
  });

  it('are optional: older boards and task files without them still load', () => {
    expect(cardSchema.parse({ id: 'A', title: 'a', column: 'todo' }).dependsOn).toEqual([]);
    expect(parsePlanTasks('- [ ] REQ-1 Plain task\n').cards[0].dependsOn).toEqual([]);
  });
});

describe('ready tasks', () => {
  const c = (
    id: string,
    column: Card['column'],
    dependsOn: string[] = [],
    extra: Partial<Card> = {},
  ) => cardSchema.parse({ id, title: id, column, dependsOn, ...extra });

  it('are the waiting tasks whose dependencies are all done', () => {
    const cards = [
      c('A', 'done'),
      c('B', 'todo', ['A']),
      c('C', 'todo', ['B']),
      c('D', 'doing'),
      c('E', 'todo', ['A', 'D']),
      c('F', 'backlog'),
      c('G', 'todo'),
    ];
    const { ready, blocked } = readyCards(cards);
    expect(ready.map((x) => x.id)).toEqual(['B', 'G']);
    expect(blocked.map((x) => [x.card.id, x.blockedBy])).toEqual([
      ['C', ['B']],
      ['E', ['D']],
    ]);
  });

  it('ignore a dependency that is not on the board, and skip obsolete cards', () => {
    const cards = [c('A', 'todo', ['GONE']), c('B', 'todo', [], { obsolete: true })];
    expect(readyCards(cards).ready.map((x) => x.id)).toEqual(['A']);
  });
});
