import { z } from 'zod';
import { cardSchema, parsePlanTasks, planTasksMarkdown, type Card } from './board';
import { parseBundleText } from './bundle-formats';

/**
 * The `.plan/` folder as an exchange format: everything SDD Studio holds for a project can be
 * written to it (specification, section documents, tasks, backlog, board) and read back.
 * Reading never trusts the folder: paths are normalised, sizes limited, and the result is data
 * that the API turns into a reviewable proposal (specification) or a guarded board update.
 */
export const planFolderLimits = { files: 400, fileBytes: 2_000_000, totalBytes: 12_000_000 };

/** `repo/.plan/spec/01-discovery.md` → `.plan/spec/01-discovery.md`; null for anything unsafe or outside `.plan/`. */
export function normalizePlanPath(path: string): string | null {
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!clean || clean.includes('\0') || /^[a-zA-Z]:/.test(clean) || clean.startsWith('/')) return null;
  const parts = clean.split('/').filter((p) => p && p !== '.');
  if (parts.some((p) => p === '..')) return null;
  const at = parts.indexOf('.plan');
  if (at < 0) return null;
  const rest = parts.slice(at + 1);
  return rest.length ? `.plan/${rest.join('/')}` : null;
}

/** Stable short identifier for a free-text backlog line, so re-importing does not duplicate it. */
export function backlogId(text: string) {
  let h = 0x811c9dc5;
  for (const ch of text.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `BL-${h.toString(16).padStart(8, '0').slice(0, 6).toUpperCase()}`;
}

/** Headings SDD Studio generates from the specification; their bullets are not backlog work. */
const generatedHeadings = /^(readiness blockers|unknown answers|unresolved decisions|bloquants de préparation|réponses inconnues|décisions non résolues)$/i;
const emptyBullet = /^(none|aucun|aucune|_?not recorded\._?|_?non consigné\._?)$/i;

/**
 * Backlog cards from `.plan/backlog.md`: checkbox tasks keep their marks (an open `[ ]` goes to the
 * backlog column), and plain bullets under author headings become backlog cards with stable ids.
 */
export function backlogCards(markdown: string): { cards: Card[]; skipped: string[] } {
  const tasks = parsePlanTasks(markdown);
  const cards: Card[] = tasks.cards.map((c) => (c.column === 'todo' ? { ...c, column: 'backlog' } : c));
  const seen = new Set(cards.map((c) => c.id));
  let group = '';
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      group = heading[1].trim();
      continue;
    }
    const bullet = /^\s*[-*]\s+(?!\[[ xX/~-]\])(.+?)\s*$/.exec(line);
    if (!bullet || generatedHeadings.test(group) || /^open questions and backlog$/i.test(group)) continue;
    const text = bullet[1].replace(/\*\*/g, '').trim();
    if (!text || emptyBullet.test(text)) continue;
    const id = backlogId(`${group}:${text}`);
    if (seen.has(id)) continue;
    const card = cardSchema.safeParse({ id, title: text.slice(0, 500), column: 'backlog', group: group.slice(0, 200) });
    if (card.success) {
      cards.push(card.data);
      seen.add(id);
    }
  }
  return { cards, skipped: tasks.skipped };
}

export const boardFileSchema = z.object({ format: z.literal('sdd-studio-board'), version: z.literal(1), cards: z.array(cardSchema).max(2000) });

/** Board files written into `.plan/`: tasks and backlog in Markdown, plus a lossless `board.json`. */
export function boardPlanFiles(cards: Card[], title: string): Record<string, string> {
  const work = cards.filter((c) => c.column !== 'backlog');
  const backlog = cards.filter((c) => c.column === 'backlog');
  return {
    '.plan/tasks.md': planTasksMarkdown(work, title),
    '.plan/board-backlog.md': planTasksMarkdown(backlog, 'Board backlog'),
    '.plan/board.json': `${JSON.stringify({ format: 'sdd-studio-board', version: 1, cards }, null, 2)}\n`,
  };
}

export type PlanFolderContent = {
  /** Raw `.plan/specification.json`, validated by the API against the bundle schema. */
  bundle: unknown | null;
  /** Section Markdown by section id, from `.plan/spec/NN-<id>.md`. */
  sections: Record<string, string>;
  /** Cards to merge into the board (from `board.json` when present, else tasks and backlog Markdown). */
  cards: Card[];
  cardsFrom: 'board.json' | 'markdown' | null;
  recognised: string[];
  skipped: string[];
};

/** Reads a `.plan/` folder given as `{ path: content }`; unknown or unsafe files are listed, never used. */
export function readPlanFolder(files: Record<string, string>): PlanFolderContent {
  const result: PlanFolderContent = { bundle: null, sections: {}, cards: [], cardsFrom: null, recognised: [], skipped: [] };
  const entries = Object.entries(files);
  if (entries.length > planFolderLimits.files) throw new Error(`A .plan folder can hold at most ${planFolderLimits.files} files`);
  let total = 0;
  const plan = new Map<string, string>();
  for (const [raw, content] of entries) {
    const path = normalizePlanPath(raw);
    if (!path) {
      result.skipped.push(`${raw}: outside .plan/ or unsafe path`);
      continue;
    }
    if (content.length > planFolderLimits.fileBytes) {
      result.skipped.push(`${path}: larger than ${planFolderLimits.fileBytes / 1_000_000} MB`);
      continue;
    }
    total += content.length;
    if (total > planFolderLimits.totalBytes) throw new Error('The .plan folder is too large');
    plan.set(path, content);
  }
  const use = (path: string) => result.recognised.push(path);

  // The JSON bundle wins; the TOON copy is read only when JSON is absent or invalid.
  for (const [path, format] of [['.plan/specification.json', 'json'], ['.plan/specification.toon', 'toon']] as const) {
    const text = plan.get(path);
    if (text === undefined) continue;
    if (result.bundle) {
      use(path);
      continue;
    }
    try {
      result.bundle = parseBundleText(text, format);
      use(path);
    } catch {
      result.skipped.push(`${path}: not valid ${format.toUpperCase()}`);
    }
  }
  for (const [path, content] of plan) {
    const section = /^\.plan\/spec\/\d+-([a-z][a-z0-9-]*)\.md$/.exec(path);
    if (section) {
      result.sections[section[1]] = content;
      use(path);
    }
  }

  const boardJson = plan.get('.plan/board.json');
  if (boardJson !== undefined) {
    const parsed = (() => {
      try {
        return boardFileSchema.safeParse(JSON.parse(boardJson));
      } catch {
        return null;
      }
    })();
    if (parsed?.success) {
      result.cards = parsed.data.cards;
      result.cardsFrom = 'board.json';
      use('.plan/board.json');
    } else result.skipped.push('.plan/board.json: not a valid board file');
  }
  if (!result.cardsFrom) {
    const byId = new Map<string, Card>();
    for (const path of ['.plan/tasks.md', '.plan/board-backlog.md', '.plan/backlog.md']) {
      const content = plan.get(path);
      if (content === undefined) continue;
      const read = path === '.plan/tasks.md' ? parsePlanTasks(content) : backlogCards(content);
      for (const card of read.cards) if (!byId.has(card.id)) byId.set(card.id, card);
      result.skipped.push(...read.skipped.map((s) => `${path}: ${s}`));
      use(path);
    }
    if (byId.size) {
      result.cards = [...byId.values()];
      result.cardsFrom = 'markdown';
    }
  }
  // With board.json, the Markdown copies of the same board are covered, not missed.
  const covered = (path: string) => result.cardsFrom === 'board.json' && /^\.plan\/(tasks|backlog|board-backlog)\.md$/.test(path);
  for (const path of plan.keys()) if (!result.recognised.includes(path) && !isInformational(path) && !covered(path)) result.skipped.push(`${path}: not imported (no matching data)`);
  return result;
}

/** Generated or narrative files that are exported for people and agents but carry no importable data. */
const isInformational = (path: string) =>
  /^\.plan\/(README|plan|designs|changes|traceability|readiness|conventions|manifest|security-checklist)\.(md|json)$|^\.plan\/(decisions|diagrams)\//.test(path);
