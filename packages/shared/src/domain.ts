import { customToQuestion, findQuestion, moduleQuestions, modules, type Language } from './templates';
import { appendQuestionBlocks, refreshSectionMarkdown, renderSection } from './markdown';
import {
  specSchema,
  type Change,
  type Conflict,
  type Item,
  type Link,
  type Role,
  type Spec,
  type SpecPatch,
} from './schema';

/** Empty text, an empty selection (`[]`) or a table of empty cells does not count as an answer. */
export function isBlankValue(value: string) {
  const v = value.trim();
  if (!v) return true;
  if (v.startsWith('[')) {
    try {
      return (
        JSON.stringify(JSON.parse(v))
          .replace(/[[\]",]/g, '')
          .trim() === ''
      );
    } catch {
      return false;
    }
  }
  return false;
}
export type AnswerStatus = 'empty' | 'answered' | 'unknown' | 'na';
/** Where an answer stands: never given (or blank), answered, marked unknown, or not applicable. */
export const answerStatus = (a?: { state: string; value: string }): AnswerStatus =>
  !a ? 'empty' : a.state === 'unknown' ? 'unknown' : a.state === 'not-applicable' ? 'na' : isBlankValue(a.value) ? 'empty' : 'answered';
/** True when an answer is complete evidence: answered with content, or not applicable with a reason. */
export const isComplete = (a: { state: string; value: string; reason: string } | undefined) =>
  !!a &&
  (a.state === 'not-applicable'
    ? !!a.reason.trim()
    : a.state === 'answered' && !isBlankValue(a.value));

export const can = (role: Role, action: 'read' | 'edit' | 'review' | 'admin') =>
  action === 'read' ||
  (action === 'edit' && ['Owner', 'Admin', 'Editor'].includes(role)) ||
  (action === 'review' && ['Owner', 'Admin', 'Reviewer'].includes(role)) ||
  (action === 'admin' && ['Owner', 'Admin'].includes(role));

export function createSpec(
  id: string,
  name: string,
  language: Language = 'en',
  example = false,
  projectType = 'Web application',
): Spec {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    name,
    description: '',
    projectType,
    language,
    localOnly: false,
    level: 'complete',
    revision: 0,
    sections: modules.map((m) => ({
      id: m.id,
      status: 'draft',
      references: [],
      answers: {},
      diagram: '',
      markdown: renderSection(m, { answers: {} }, language, projectType, { example }),
    })),
    items: [],
    links: [],
    technologyIds: [],
    technologyDecisions: {},
    stack: [],
    customQuestions: [],
    updatedAt: now,
    updatedBy: 'system',
  };
}

export function validateSpec(input: unknown): Spec {
  const spec = specSchema.parse(input);
  const ids = spec.sections.map((s) => s.id);
  if (new Set(ids).size !== 14 || modules.some((m) => !ids.includes(m.id)))
    throw new Error('Specification must contain each known module exactly once');
  const customIds = new Set(spec.customQuestions.map((c) => c.id));
  if (customIds.size !== spec.customQuestions.length)
    throw new Error('Duplicate custom question identifiers');
  for (const c of spec.customQuestions)
    if (
      !modules.some((m) => m.id === c.moduleId) ||
      !c.id.startsWith(`${c.moduleId}.c-`) ||
      findQuestion(c.id)
    )
      throw new Error(`Invalid custom question: ${c.id}`);
  for (const section of spec.sections)
    for (const key of Object.keys(section.answers))
      if (
        findQuestion(key)?.id.split('.')[0] !== section.id &&
        !spec.customQuestions.some((c) => c.id === key && c.moduleId === section.id)
      )
        throw new Error(`Unknown question: ${key}`);
  const itemIds = new Set(spec.items.map((i) => i.id));
  if (itemIds.size !== spec.items.length) throw new Error('Duplicate item identifiers');
  if (new Set(spec.links.map((l) => l.id)).size !== spec.links.length)
    throw new Error('Duplicate link identifiers');
  for (const link of spec.links)
    if (!itemIds.has(link.from) || !itemIds.has(link.to))
      throw new Error('Traceability links must refer to existing items');
  for (const [technologyId, decisions] of Object.entries(spec.technologyDecisions)) {
    if (!spec.technologyIds.includes(technologyId))
      throw new Error('Decision links must refer to a selected technology');
    if (decisions.some((id) => spec.items.find((i) => i.id === id)?.type !== 'decision'))
      throw new Error('Technology selections can only link to decision items');
  }
  return spec;
}

/** Canonical JSON (sorted keys) so equal values compare equal regardless of key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
}
const json = canonicalJson;
const topLevel = [
  'name',
  'description',
  'projectType',
  'language',
  'localOnly',
  'level',
  'technologyIds',
  'technologyDecisions',
  'stack',
] as const;
const itemContent = (i: Item) =>
  json([i.type, i.title, i.body, i.acceptance, i.priority ?? null, i.owner]);
/** The upstream end of a link: changing it invalidates the other end. */
export const upstreamOf = (l: Link) => (l.kind === 'decides' ? l.from : l.to);
export const downstreamOf = (l: Link) => (l.kind === 'decides' ? l.to : l.from);

export type PatchOptions = {
  /** Reviewers may set items to accepted; editors cannot grant review status. */
  canReview?: boolean;
};

/**
 * Applies a partial patch and returns the next revision. Review states are never taken from
 * the patch: changed sections become drafts, dependent reviewed sections need review again,
 * and items downstream of a changed item are flagged for review.
 */
export function applySpecPatch(
  current: Spec,
  patch: SpecPatch,
  author: string,
  options: PatchOptions = {},
): Spec {
  const next: Spec = structuredClone(current);
  for (const key of topLevel)
    if (patch[key] !== undefined) (next as any)[key] = structuredClone(patch[key]);

  const addedQuestions = (patch.customQuestions ?? []).filter((c) => !next.customQuestions.some((x) => x.id === c.id));
  for (const c of patch.customQuestions ?? []) {
    const index = next.customQuestions.findIndex((x) => x.id === c.id);
    if (index >= 0) next.customQuestions[index] = structuredClone(c);
    else next.customQuestions.push(structuredClone(c));
  }
  const removedQuestions = new Set(patch.removeCustomQuestions ?? []);
  if (removedQuestions.size) {
    next.customQuestions = next.customQuestions.filter((c) => !removedQuestions.has(c.id));
    for (const section of next.sections)
      section.answers = Object.fromEntries(
        Object.entries(section.answers).filter(([id]) => !removedQuestions.has(id)),
      );
  }
  // The stack is a selection: every stack technology is also a project technology.
  if (patch.stack)
    next.technologyIds = [
      ...new Set([...next.technologyIds, ...patch.stack.map((e) => e.technologyId)]),
    ];
  const context = { projectType: next.projectType, customQuestions: next.customQuestions };

  const changedSections = new Set<string>(),
    answerChanged = new Set<string>();
  for (const sp of patch.sections ?? []) {
    const section = next.sections.find((s) => s.id === sp.id);
    if (!section) throw new Error(`Unknown section: ${sp.id}`);
    const before = json({ ...section, status: undefined });
    if (sp.markdown !== undefined) section.markdown = sp.markdown;
    if (sp.diagram !== undefined) section.diagram = sp.diagram;
    if (sp.references !== undefined) section.references = structuredClone(sp.references);
    if (sp.answers) {
      const merged = { ...section.answers, ...structuredClone(sp.answers) };
      if (json(merged) !== json(section.answers)) answerChanged.add(section.id);
      section.answers = merged;
      // Managed answer blocks always mirror the structured answers, including in supplied Markdown.
      section.markdown = refreshSectionMarkdown(
        modules.find((m) => m.id === section.id)!,
        section,
        next.language,
        context,
        { appendMissing: false },
      );
    }
    if (json({ ...section, status: undefined }) !== before) changedSections.add(section.id);
  }

  const changedItems = new Set<string>();
  const removedItems = new Set(patch.removeItems ?? []);
  for (const incoming of patch.items ?? []) {
    const existing = next.items.find((i) => i.id === incoming.id);
    const item: Item = structuredClone(incoming);
    if (existing) {
      const contentChanged = itemContent(existing) !== itemContent(item);
      item.needsReview = existing.needsReview;
      if (!options.canReview) {
        if (item.status === 'accepted' && (existing.status !== 'accepted' || contentChanged))
          item.status = 'draft';
      }
      if (contentChanged || existing.status !== item.status) changedItems.add(item.id);
      next.items[next.items.indexOf(existing)] = item;
    } else {
      item.needsReview = false;
      if (!options.canReview && item.status === 'accepted') item.status = 'draft';
      next.items.push(item);
    }
  }
  for (const id of removedItems) changedItems.add(id);
  const priorLinks = [...next.links];
  next.items = next.items.filter((i) => !removedItems.has(i.id));
  for (const link of patch.links ?? []) {
    const index = next.links.findIndex((l) => l.id === link.id);
    if (index >= 0) next.links[index] = structuredClone(link);
    else next.links.push(structuredClone(link));
  }
  const removedLinks = new Set(patch.removeLinks ?? []);
  next.links = next.links.filter(
    (l) => !removedLinks.has(l.id) && !removedItems.has(l.from) && !removedItems.has(l.to),
  );

  // New custom questions get an answer block in their section document.
  for (const c of addedQuestions) {
    const section = next.sections.find((x) => x.id === c.moduleId);
    if (section) section.markdown = appendQuestionBlocks(section.markdown, [customToQuestion(c)], section.answers, next.language);
  }

  // Section dependency invalidation (module graph).
  const affected = new Set(answerChanged);
  for (let grew = true; grew;) {
    grew = false;
    for (const m of modules)
      if (m.dependsOn.some((id) => affected.has(id)) && !affected.has(m.id)) {
        affected.add(m.id);
        grew = true;
      }
  }
  for (const section of next.sections) {
    if (changedSections.has(section.id)) section.status = 'draft';
    else if (affected.has(section.id) && section.status === 'reviewed')
      section.status = 'needs-review';
  }

  // Item dependency invalidation (traceability graph), using links before removal too.
  const flagged = new Set<string>();
  const queue = [...changedItems];
  const graph = [...priorLinks, ...next.links];
  while (queue.length) {
    const id = queue.shift()!;
    for (const l of graph)
      if (upstreamOf(l) === id) {
        const target = downstreamOf(l);
        if (!flagged.has(target) && !changedItems.has(target)) {
          flagged.add(target);
          queue.push(target);
        }
      }
  }
  for (const item of next.items) if (flagged.has(item.id)) item.needsReview = true;

  // Keep technology→decision links consistent with selections and remaining decisions.
  next.technologyDecisions = Object.fromEntries(
    Object.entries(next.technologyDecisions ?? {})
      .filter(([technologyId]) => next.technologyIds.includes(technologyId))
      .map(([technologyId, ids]) => [
        technologyId,
        ids.filter((id) => next.items.some((i) => i.id === id && i.type === 'decision')),
      ]),
  );

  next.id = current.id;
  next.schemaVersion = 1;
  next.revision = current.revision + 1;
  next.updatedAt = new Date().toISOString();
  next.updatedBy = author;
  return validateSpec(next);
}

/** Editing content never grants review authority, including imported/AI patches. */
export function preserveReviewAuthority(current: Spec, patch: SpecPatch): SpecPatch {
  if (!patch.sections) return patch;
  return {
    ...patch,
    sections: patch.sections.map((section) => {
      const previous = current.sections.find((s) => s.id === section.id);
      const merged = previous && {
        ...previous,
        ...section,
        answers: { ...previous.answers, ...(section.answers ?? {}) },
      };
      const unchanged =
        previous && json({ ...previous, status: 'draft' }) === json({ ...merged, status: 'draft' });
      return { ...section, status: unchanged ? previous.status : 'draft' };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Readiness

export type IssueCode =
  | 'required-missing'
  | 'unknown-answer'
  | 'section-unreviewed'
  | 'decision-pending'
  | 'requirement-untested'
  | 'no-requirements'
  | 'item-needs-review'
  | 'contradiction'
  | 'open-conflict'
  | 'acceptance-not-measurable'
  | 'link-to-superseded'
  | 'test-unlinked'
  | 'risk-unmitigated';
export type Issue = {
  code: IssueCode;
  severity: 'blocker' | 'warning';
  target?: string;
  count?: number;
};
const issueText: Record<IssueCode, { en: string; fr: string }> = {
  'required-missing': {
    en: '{count} required answers remain',
    fr: '{count} réponses obligatoires manquantes',
  },
  'unknown-answer': { en: '{target} is marked unknown', fr: '{target} est marquée inconnue' },
  'section-unreviewed': { en: '{target}: review required', fr: '{target} : révision requise' },
  'decision-pending': { en: '{target}: decision pending', fr: '{target} : décision en attente' },
  'requirement-untested': {
    en: '{target}: acceptance criteria or linked test missing',
    fr: '{target} : critères d’acceptation ou test associé manquant',
  },
  'no-requirements': {
    en: 'Add at least one requirement with acceptance criteria and a linked test',
    fr: 'Ajoutez au moins une exigence avec critères d’acceptation et test associé',
  },
  'item-needs-review': {
    en: '{target}: upstream item changed; review required',
    fr: '{target} : un élément amont a changé ; révision requise',
  },
  contradiction: {
    en: 'Unresolved contradiction: {target}',
    fr: 'Contradiction non résolue : {target}',
  },
  'open-conflict': {
    en: '{count} imported change(s) have unresolved conflicts',
    fr: '{count} changement(s) importé(s) avec conflits non résolus',
  },
  'acceptance-not-measurable': {
    en: '{target}: acceptance criteria may not be measurable',
    fr: '{target} : critères d’acceptation peut-être non mesurables',
  },
  'link-to-superseded': {
    en: '{target}: links to a superseded item',
    fr: '{target} : lié à un élément remplacé',
  },
  'test-unlinked': {
    en: '{target}: test is not linked to a requirement',
    fr: '{target} : test non relié à une exigence',
  },
  'risk-unmitigated': {
    en: '{target}: risk has no mitigation',
    fr: '{target} : risque sans atténuation',
  },
};
export const describeIssue = (issue: Issue, lang: Language = 'en') =>
  issueText[issue.code][lang]
    .replace('{count}', String(issue.count ?? ''))
    .replace('{target}', issue.target ?? '');

const measurable = (text: string) =>
  /\d/.test(text) || /\b(given|when|then|étant donné|quand|alors)\b/i.test(text);

/**
 * Whether a section must be reviewed before a baseline. Every section does at the complete level;
 * at the essentials level only the sections that hold a required question do, so the sections nobody
 * is asked about are not a hurdle.
 */
export function sectionNeedsReview(spec: Spec, sectionId: string) {
  const module = modules.find((m) => m.id === sectionId);
  return spec.level !== 'essentials' || !module || moduleQuestions(module, spec).some((q) => q.required);
}

/**
 * Readiness is computed from structured evidence only: answers, reviews, decisions, links and
 * contradictions. Generated or free Markdown never counts toward completeness.
 */
export function readiness(spec: Spec, context: { openConflicts?: number } = {}) {
  const issues: Issue[] = [];
  const required = modules.flatMap((m) => moduleQuestions(m, spec).filter((q) => q.required));
  const answerOf = (id: string) =>
    spec.sections.find((s) => s.id === id.split('.')[0])?.answers[id];
  const complete = required.filter((q) => isComplete(answerOf(q.id))).length;
  if (complete < required.length)
    issues.push({
      code: 'required-missing',
      severity: 'blocker',
      count: required.length - complete,
    });
  const unknown = spec.sections.flatMap((s) =>
    Object.entries(s.answers)
      .filter(([, a]) => a.state === 'unknown')
      .map(([id]) => id),
  );
  for (const id of unknown)
    issues.push({ code: 'unknown-answer', severity: 'blocker', target: id });
  for (const s of spec.sections)
    if (s.status !== 'reviewed' && sectionNeedsReview(spec, s.id))
      issues.push({ code: 'section-unreviewed', severity: 'blocker', target: s.id });
  const live = spec.items.filter((i) => i.status !== 'superseded');
  const liveIds = new Set(live.map((i) => i.id));
  for (const i of live.filter((i) => i.type === 'decision' && i.status === 'draft'))
    issues.push({ code: 'decision-pending', severity: 'blocker', target: i.id });
  const requirements = live.filter((i) => i.type === 'requirement');
  for (const r of requirements) {
    if (
      !r.acceptance.trim() ||
      !spec.links.some((l) => l.kind === 'tests' && l.to === r.id && liveIds.has(l.from))
    )
      issues.push({ code: 'requirement-untested', severity: 'blocker', target: r.id });
    else if (!measurable(r.acceptance))
      issues.push({ code: 'acceptance-not-measurable', severity: 'warning', target: r.id });
  }
  if (!requirements.length) issues.push({ code: 'no-requirements', severity: 'blocker' });
  for (const i of live.filter((i) => i.needsReview))
    issues.push({ code: 'item-needs-review', severity: 'blocker', target: i.id });
  for (const l of spec.links.filter((l) => l.kind === 'contradicts'))
    if (liveIds.has(l.from) && liveIds.has(l.to))
      issues.push({ code: 'contradiction', severity: 'blocker', target: `${l.from} ↔ ${l.to}` });
  if (context.openConflicts)
    issues.push({ code: 'open-conflict', severity: 'blocker', count: context.openConflicts });
  for (const l of spec.links)
    if (liveIds.has(l.from) && !liveIds.has(l.to) && l.kind !== 'contradicts')
      issues.push({ code: 'link-to-superseded', severity: 'warning', target: l.from });
  for (const test of live.filter((i) => i.type === 'test'))
    if (!spec.links.some((l) => l.kind === 'tests' && l.from === test.id))
      issues.push({ code: 'test-unlinked', severity: 'warning', target: test.id });
  for (const risk of live.filter((i) => i.type === 'risk'))
    if (!spec.links.some((l) => l.kind === 'mitigates' && l.to === risk.id))
      issues.push({ code: 'risk-unmitigated', severity: 'warning', target: risk.id });

  const blockers = issues.filter((i) => i.severity === 'blocker');
  return {
    complete,
    total: required.length,
    percent: required.length ? Math.round((complete / required.length) * 100) : 100,
    unknown: unknown.length,
    issues,
    blockers: blockers.map((i) => describeIssue(i)),
    warnings: issues.filter((i) => i.severity === 'warning').map((i) => describeIssue(i)),
    ready: blockers.length === 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Paths, change summaries and conflicts

/** Flattens a specification into comparable paths such as `sections.scope.answers.scope.3`. */
export function specPaths(spec: Spec): Map<string, unknown> {
  const paths = new Map<string, unknown>();
  for (const key of topLevel) paths.set(key, spec[key]);
  for (const s of spec.sections) {
    paths.set(`sections.${s.id}.markdown`, s.markdown);
    paths.set(`sections.${s.id}.diagram`, s.diagram);
    paths.set(`sections.${s.id}.references`, s.references);
    for (const [id, a] of Object.entries(s.answers)) paths.set(`sections.${s.id}.answers.${id}`, a);
  }
  for (const i of spec.items) paths.set(`items.${i.id}`, i);
  for (const l of spec.links) paths.set(`links.${l.id}`, l);
  for (const c of spec.customQuestions ?? []) paths.set(`customQuestions.${c.id}`, c);
  return paths;
}
/** Paths a patch writes to. */
export function patchPaths(patch: SpecPatch): string[] {
  const paths: string[] = topLevel.filter((k) => patch[k] !== undefined);
  for (const s of patch.sections ?? []) {
    for (const field of ['markdown', 'diagram', 'references'] as const)
      if (s[field] !== undefined) paths.push(`sections.${s.id}.${field}`);
    for (const id of Object.keys(s.answers ?? {})) paths.push(`sections.${s.id}.answers.${id}`);
  }
  for (const i of patch.items ?? []) paths.push(`items.${i.id}`);
  for (const id of patch.removeItems ?? []) paths.push(`items.${id}`);
  for (const l of patch.links ?? []) paths.push(`links.${l.id}`);
  for (const id of patch.removeLinks ?? []) paths.push(`links.${id}`);
  for (const c of patch.customQuestions ?? []) paths.push(`customQuestions.${c.id}`);
  for (const id of patch.removeCustomQuestions ?? []) paths.push(`customQuestions.${id}`);
  return paths;
}
const comparable = (path: string, v: unknown) =>
  path.startsWith('items.') && v ? json({ ...(v as Item), needsReview: undefined }) : json(v);

export function diffSpecs(before: Spec, after: Spec): Change[] {
  const a = specPaths(before),
    b = specPaths(after);
  const changes: Change[] = [];
  for (const [path, value] of b) {
    if (!a.has(path)) changes.push({ path, kind: 'added', after: value });
    else if (comparable(path, a.get(path)) !== comparable(path, value))
      changes.push({ path, kind: 'changed', before: a.get(path), after: value });
  }
  for (const [path, value] of a)
    if (!b.has(path)) changes.push({ path, kind: 'removed', before: value });
  return changes;
}

/**
 * For a write based on `base` that arrives after `current`, lists the fields the write touches
 * that someone else changed in between. An empty list means the write does not overlap.
 */
export function patchConflicts(
  base: Spec,
  current: Spec,
  patch: SpecPatch,
  yours?: Spec,
): Conflict[] {
  const a = specPaths(base),
    b = specPaths(current),
    mine = yours ? specPaths(yours) : undefined;
  return patchPaths(patch)
    .filter((path) => comparable(path, a.get(path)) !== comparable(path, b.get(path)))
    .map((path) => ({ path, base: a.get(path), current: b.get(path), yours: mine?.get(path) }));
}

// ---------------------------------------------------------------------------------------------
// Three-way merge (Git and other external edits)

/**
 * Field-level three-way merge of `remote` into `local` against their common `base`.
 * Non-overlapping changes merge; overlapping ones are reported and `local` is kept, so both
 * versions remain available for an explicit decision.
 */
export function threeWayMerge(base: Spec, local: Spec, remote: Spec) {
  const b = specPaths(base),
    l = specPaths(local),
    r = specPaths(remote);
  const patch: SpecPatch = {};
  const conflicts: Conflict[] = [];
  const sectionPatch = (id: string) => {
    patch.sections ??= [];
    let s = patch.sections.find((x) => x.id === id);
    if (!s) patch.sections.push((s = { id }));
    return s;
  };
  const all = new Set([...b.keys(), ...l.keys(), ...r.keys()]);
  for (const path of all) {
    const [bv, lv, rv] = [b.get(path), l.get(path), r.get(path)].map((v) => comparable(path, v));
    if (rv === bv || rv === lv) continue; // remote unchanged, or both made the same change
    if (lv !== bv) {
      conflicts.push({ path, base: b.get(path), current: l.get(path), yours: r.get(path) });
      continue;
    }
    const value = structuredClone(r.get(path));
    const parts = path.split('.');
    if (parts[0] === 'sections') {
      const s = sectionPatch(parts[1]);
      if (parts[2] === 'answers') {
        // Removing an answer is not representable as a merge patch; keep local (conservative).
        if (value !== undefined) (s.answers ??= {})[parts.slice(3).join('.')] = value as any;
      } else (s as any)[parts[2]] = value;
    } else if (parts[0] === 'items') {
      if (value === undefined) (patch.removeItems ??= []).push(parts.slice(1).join('.'));
      else (patch.items ??= []).push(value as Item);
    } else if (parts[0] === 'links') {
      if (value === undefined) (patch.removeLinks ??= []).push(parts.slice(1).join('.'));
      else (patch.links ??= []).push(value as Link);
    } else if (parts[0] === 'customQuestions') {
      if (value === undefined) (patch.removeCustomQuestions ??= []).push(parts.slice(1).join('.'));
      else (patch.customQuestions ??= []).push(value as any);
    } else (patch as any)[path] = value;
  }
  return { patch, conflicts };
}

// ---------------------------------------------------------------------------------------------
// Identifiers

export const itemPrefixes: Record<Item['type'], string> = {
  requirement: 'REQ',
  'use-case': 'UC',
  decision: 'ADR',
  component: 'CMP',
  risk: 'RISK',
  test: 'TEST',
};
export function nextItemId(spec: Pick<Spec, 'items'>, type: Item['type']) {
  const prefix = itemPrefixes[type];
  const max = Math.max(
    0,
    ...spec.items
      .map((i) => i.id.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1])
      .filter(Boolean)
      .map(Number),
  );
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
export function nextLinkId(spec: Pick<Spec, 'links'>) {
  const max = Math.max(0, ...spec.links.map((l) => Number(l.id.match(/^LINK-(\d+)$/)?.[1] ?? 0)));
  return `LINK-${String(max + 1).padStart(3, '0')}`;
}
