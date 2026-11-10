import { z } from 'zod';
import type { Item, Spec } from './schema';

/** Kanban columns, in display order. `.plan` checkboxes map `[ ]`, `[/]` and `[x]` onto them. */
export const boardColumns = ['backlog', 'todo', 'doing', 'review', 'done'] as const;
export type BoardColumn = (typeof boardColumns)[number];
export const columnLabels: Record<BoardColumn, { en: string; fr: string }> = {
  backlog: { en: 'Backlog', fr: 'Carnet' },
  todo: { en: 'To do', fr: 'À faire' },
  doing: { en: 'In progress', fr: 'En cours' },
  review: { en: 'In review', fr: 'En revue' },
  done: { en: 'Done', fr: 'Terminé' },
};

/** Pull requests are only read from these hosts, so a card URL can never make the server call elsewhere. */
export const pullRequestPattern =
  /^https:\/\/(?:github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+|gitlab\.com\/[\w.-]+(?:\/[\w.-]+)+\/-\/merge_requests\/\d+|dev\.azure\.com\/[\w.-]+\/[\w.%-]+\/_git\/[\w.%-]+\/pullrequest\/\d+)\/?$/;

export const cardSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9][\w.-]*$/, 'Use letters, digits, dots, dashes or underscores'),
  title: z.string().min(1).max(500),
  body: z.string().max(5000).default(''),
  column: z.enum(boardColumns),
  /** Plan heading or specification item type the card is grouped under. */
  group: z.string().max(200).default(''),
  /** Specification items this card implements. */
  sourceIds: z.array(z.string().max(60)).max(50).default([]),
  /** Cards that must be done before this one can start; the task plan fills it from the specification's links. */
  dependsOn: z.array(z.string().max(60)).max(50).default([]),
  pullRequests: z
    .array(
      z
        .string()
        .max(500)
        .regex(pullRequestPattern, 'Use a GitHub, GitLab or Azure DevOps pull request URL'),
    )
    .max(10)
    .default([]),
  assignee: z.string().max(200).default(''),
  /** Set when the source items no longer exist in the latest baseline. */
  obsolete: z.boolean().default(false),
});
export type Card = z.infer<typeof cardSchema>;

export const boardSchema = z.object({
  projectId: z.string(),
  revision: z.number().int().nonnegative(),
  baselineId: z.string().optional(),
  baselineRevision: z.number().int().optional(),
  /** What the last task plan found missing in the specification (a requirement without a component, …). */
  gaps: z.array(z.string().max(500)).max(101).default([]),
  cards: z.array(cardSchema).max(2000),
  updatedAt: z.string(),
});
export type Board = z.infer<typeof boardSchema>;

const groupOf: Record<Item['type'], string> = {
  requirement: 'Requirements',
  'use-case': 'Use cases',
  component: 'Components',
  test: 'Tests',
  decision: 'Decisions',
  risk: 'Risk mitigations',
};
/** Item types that turn into implementation work, in board order. */
const workTypes: Item['type'][] = [
  'requirement',
  'use-case',
  'component',
  'decision',
  'risk',
  'test',
];

/**
 * One flat card per implementable specification item. The board is built from `breakIntoTasks`
 * (task-plan.ts), which orders and groups the same cards; this stays for plain listings.
 */
export function cardsFromSpec(spec: Spec): Card[] {
  return workTypes.flatMap((type) =>
    spec.items
      .filter((item) => item.type === type && item.status !== 'superseded')
      .map((item) => {
        const related = spec.links
          .filter((l) => l.from === item.id || l.to === item.id)
          .map((l) => (l.from === item.id ? l.to : l.from));
        return cardSchema.parse({
          id: item.id,
          title: item.title,
          body: item.acceptance || item.body.slice(0, 5000),
          column: 'todo',
          group: groupOf[type],
          sourceIds: [item.id, ...new Set(related)].slice(0, 50),
          assignee: item.owner,
        });
      }),
  );
}

/**
 * Merges cards generated from a new baseline into the current board: existing cards keep their
 * column, order, assignee and pull requests; new items are appended; cards whose items disappeared
 * are kept but marked obsolete, never deleted.
 */
export function mergeGenerated(current: Card[], generated: Card[]) {
  const byId = new Map(generated.map((c) => [c.id, c]));
  const known = new Set(current.map((c) => c.id));
  const added: string[] = [];
  const obsolete: string[] = [];
  const cards = current.map((card) => {
    const next = byId.get(card.id);
    if (next)
      return {
        ...card,
        title: next.title,
        body: next.body,
        sourceIds: next.sourceIds,
        dependsOn: next.dependsOn,
        group: next.group,
        obsolete: false,
      };
    if (card.sourceIds.length && !card.obsolete) obsolete.push(card.id);
    return card.sourceIds.length ? { ...card, obsolete: true } : card;
  });
  for (const card of generated)
    if (!known.has(card.id)) {
      cards.push(card);
      added.push(card.id);
    }
  return { cards, added, obsolete };
}

/** Moves a card to a column, before the card at `index` within that column (end when omitted). */
export function moveCard(cards: Card[], id: string, column: BoardColumn, index?: number): Card[] {
  const card = cards.find((c) => c.id === id);
  if (!card) return cards;
  const rest = cards.filter((c) => c.id !== id);
  const target = rest.filter((c) => c.column === column);
  const anchor = index === undefined ? undefined : target[Math.max(0, index)];
  const moved = { ...card, column };
  if (!anchor) {
    const last = target.at(-1);
    const at = last ? rest.indexOf(last) + 1 : rest.length;
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  }
  const at = rest.indexOf(anchor);
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

// ---- .plan/tasks.md import and export ---------------------------------------------------------

const checkbox = /^\s*[-*]\s+\[( |x|X|\/|~|-)\]\s+(.+?)\s*$/;
const idPrefix = /^((?:[A-Z][A-Z0-9]*-)+\d+[\w.-]*)[:\s]\s*(.*)$/;
const urlPattern = /https:\/\/[^\s)>\]]+/g;
const reviewMarker = /\s*_\(in review\)_/i;
const sourcesMarker = /\s+—\s+Sources:\s+([\w.,:\s-]+?)(?=\s+—|$)/;
const afterMarker = /\s+—\s+After:\s+([\w.,:\s-]+?)(?=\s+—|$)/;
const prMarker = /\s+—\s+PR:\s+.*$/;

export type PlanImport = { cards: Card[]; skipped: string[] };

/**
 * Reads checkbox tasks from a `.plan/tasks.md`-style document. Headings become groups, `[x]` is done,
 * `[/]` or `[~]` in progress (or in review when marked), `[-]` backlog and `[ ]` to do.
 */
export function parsePlanTasks(markdown: string): PlanImport {
  const cards: Card[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  let group = '';
  let generated = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      group = heading[1].slice(0, 200);
      continue;
    }
    const task = checkbox.exec(line);
    if (!task) continue;
    const [, mark, raw] = task;
    const pullRequests = [...raw.matchAll(urlPattern)]
      .map((m) => m[0].replace(/[.,;]+$/, ''))
      .filter((u) => pullRequestPattern.test(u));
    const sources =
      sourcesMarker
        .exec(raw)?.[1]
        .split(/[,\s]+/)
        .filter(Boolean) ?? [];
    const after =
      afterMarker
        .exec(raw)?.[1]
        .split(/[,\s]+/)
        .filter(Boolean) ?? [];
    const inReview = reviewMarker.test(raw);
    let text = raw
      .replace(prMarker, '')
      .replace(sourcesMarker, '')
      .replace(afterMarker, '')
      .replace(reviewMarker, '')
      .trim();
    const labelled = idPrefix.exec(text);
    let id: string;
    if (labelled) {
      id = labelled[1];
      text = labelled[2].trim() || id;
    } else {
      do id = `PLAN-${String(++generated).padStart(3, '0')}`;
      while (seen.has(id));
    }
    if (seen.has(id)) {
      skipped.push(`${id}: duplicate identifier`);
      continue;
    }
    const column: BoardColumn =
      mark === 'x' || mark === 'X'
        ? 'done'
        : mark === '/' || mark === '~'
          ? inReview
            ? 'review'
            : 'doing'
          : mark === '-'
            ? 'backlog'
            : 'todo';
    const parsed = cardSchema.safeParse({
      id,
      title: text.slice(0, 500),
      column,
      group,
      sourceIds: sources,
      dependsOn: after,
      pullRequests: [...new Set(pullRequests)],
    });
    if (!parsed.success) {
      skipped.push(`${id}: ${parsed.error.issues[0]?.message ?? 'invalid task'}`);
      continue;
    }
    seen.add(id);
    cards.push(parsed.data);
  }
  return { cards, skipped };
}

const marks: Record<BoardColumn, string> = {
  backlog: '-',
  todo: ' ',
  doing: '/',
  review: '/',
  done: 'x',
};

/** Writes the board as `.plan/tasks.md`; `parsePlanTasks` reads it back without loss of column, sources or PRs. */
export function planTasksMarkdown(cards: Card[], title = 'Tasks'): string {
  const groups = new Map<string, Card[]>();
  for (const card of cards) groups.set(card.group, [...(groups.get(card.group) ?? []), card]);
  const lines = [
    `# ${title}`,
    '',
    'Status: `[x]` done, `[/]` in progress (`_(in review)_` when awaiting review), `[ ]` to do, `[-]` backlog.',
  ];
  for (const [group, list] of groups) {
    lines.push('', `## ${group || 'General'}`, '');
    for (const card of list) {
      let line = `- [${marks[card.column]}] ${card.id} ${card.title.replace(/\s+/g, ' ')}`;
      if (card.column === 'review') line += ' _(in review)_';
      const sources = card.sourceIds.filter((s) => s !== card.id);
      if (sources.length) line += ` — Sources: ${sources.join(', ')}`;
      if (card.dependsOn.length) line += ` — After: ${card.dependsOn.join(', ')}`;
      if (card.pullRequests.length) line += ` — PR: ${card.pullRequests.join(' ')}`;
      lines.push(line);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Upserts imported cards by identifier; cards missing from the import are left untouched. */
export function applyPlanImport(current: Card[], imported: Card[]) {
  const byId = new Map(current.map((c) => [c.id, c]));
  const added: string[] = [];
  const updated: string[] = [];
  const cards = [...current];
  for (const card of imported) {
    const existing = byId.get(card.id);
    if (!existing) {
      cards.push(card);
      added.push(card.id);
      continue;
    }
    const merged: Card = {
      ...existing,
      title: card.title,
      column: card.column,
      group: card.group || existing.group,
      sourceIds: [...new Set([...existing.sourceIds, ...card.sourceIds])].slice(0, 50),
      dependsOn: [...new Set([...existing.dependsOn, ...card.dependsOn])].slice(0, 50),
      pullRequests: [...new Set([...existing.pullRequests, ...card.pullRequests])].slice(0, 10),
    };
    if (JSON.stringify(merged) !== JSON.stringify(existing)) {
      cards[cards.indexOf(existing)] = merged;
      updated.push(card.id);
    }
  }
  return { cards, added, updated };
}

// ---- Pull requests ---------------------------------------------------------------------------

export type PullRequestRef =
  | { provider: 'github'; owner: string; repo: string; number: number }
  | { provider: 'gitlab'; project: string; number: number }
  | {
      provider: 'azure';
      organization: string;
      project: string;
      repository: string;
      number: number;
    };

export function pullRequestRef(url: string): PullRequestRef | null {
  if (!pullRequestPattern.test(url)) return null;
  const { pathname } = new URL(url);
  const parts = pathname.split('/').filter(Boolean);
  const number = Number(parts.at(-1));
  if (url.startsWith('https://github.com/'))
    return { provider: 'github', owner: parts[0], repo: parts[1], number };
  if (url.startsWith('https://gitlab.com/'))
    return { provider: 'gitlab', project: parts.slice(0, parts.indexOf('-')).join('/'), number };
  return {
    provider: 'azure',
    organization: parts[0],
    project: decodeURIComponent(parts[1]),
    repository: decodeURIComponent(parts[3]),
    number,
  };
}

export type PullRequestStatus = {
  url: string;
  provider: PullRequestRef['provider'];
  state: 'open' | 'draft' | 'merged' | 'closed' | 'unknown';
  title: string;
  checks: 'passing' | 'failing' | 'pending' | 'none' | 'unknown';
  reviews: 'approved' | 'changes-requested' | 'pending' | 'unknown';
  updatedAt?: string;
  error?: string;
};

/** Suggested column for a card from its pull requests; the user still decides whether to move it. */
export function suggestedColumn(statuses: PullRequestStatus[]): BoardColumn | null {
  if (!statuses.length) return null;
  if (statuses.every((s) => s.state === 'merged')) return 'done';
  if (statuses.some((s) => s.state === 'open')) return 'review';
  if (statuses.some((s) => s.state === 'draft')) return 'doing';
  return null;
}
