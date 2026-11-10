import { isBlankValue } from './domain';
import { listOf } from './markdown';
import { slugOf, stackAnswerSuggestions, preferredVersion } from './stack';
import { findQuestion, modules, moduleQuestions, type Question } from './templates';
import type { Finding } from './import-rules';
import type { Item, Spec, SpecPatch, StackEntry, Technology } from './schema';

/**
 * Turns repository findings into a proposed patch: new stack entries (matched to the catalog by
 * slug), answers for empty structured questions and a description when the project has none.
 * Existing answers are never overwritten; multi-select answers only gain options.
 */
export function findingsToPatch(spec: Spec, catalog: Technology[], findings: Finding[], lang: 'en' | 'fr'): SpecPatch {
  const bySlug = new Map(catalog.map((t) => [slugOf(t), t]));
  const stack: StackEntry[] = [...spec.stack];
  for (const f of findings) {
    if (!f.stack) continue;
    const tech = bySlug.get(f.stack.slug);
    if (!tech || stack.some((e) => e.technologyId === tech.id && e.layer === f.stack!.layer)) continue;
    const version = f.stack.version
      ? (tech.versions.find((v) => v.version === f.stack!.version || v.version.startsWith(`${f.stack!.version} `) || v.version.startsWith(`${f.stack!.version}.`))?.version ?? f.stack.version)
      : preferredVersion(tech, true);
    stack.push({ technologyId: tech.id, layer: f.stack.layer, version, note: `Detected: ${f.evidence}`.slice(0, 500) });
  }
  const answers: Record<string, Record<string, { value: string; state: 'answered'; reason: string }>> = {};
  const current = (id: string) => spec.sections.find((s) => s.id === id.split('.')[0])?.answers[id];
  const set = (id: string, value: string) => {
    const moduleId = id.split('.')[0];
    (answers[moduleId] ??= {})[id] = { value, state: 'answered', reason: '' };
  };
  const collected = new Map<string, string[] | string>();
  for (const f of findings)
    for (const [id, value] of Object.entries(f.answers ?? {})) {
      const prev = collected.get(id);
      collected.set(id, Array.isArray(value) ? [...new Set([...(Array.isArray(prev) ? prev : []), ...value])] : (prev ?? value));
    }
  for (const [id, value] of collected) {
    const q = findQuestion(id);
    if (!q) continue;
    const existing = current(id);
    if (Array.isArray(value)) {
      const had = existing && existing.state === 'answered' ? listOf(existing.value) : [];
      const merged = [...new Set([...had, ...value])];
      if (merged.length > had.length) set(id, JSON.stringify(merged));
    } else if (!existing || isBlankValue(existing.value)) set(id, value);
  }
  const withStack = { ...spec, stack };
  for (const s of stackAnswerSuggestions(withStack, catalog, lang).sections ?? [])
    for (const [id, a] of Object.entries(s.answers ?? {})) if (!answers[s.id]?.[id]) set(id, a.value);
  const description = findings.find((f) => f.description)?.description;
  const patch: SpecPatch = {};
  if (stack.length > spec.stack.length) patch.stack = stack;
  if (Object.keys(answers).length) patch.sections = Object.entries(answers).map(([id, a]) => ({ id, answers: a }));
  if (description && !spec.description.trim()) patch.description = description.slice(0, 3000);
  return patch;
}

// ---- Documents ------------------------------------------------------------------------------

export type DocumentBlock = { heading: string; body: string };
const stop = new Set('the a an and or of to for in on with de la le les des du et ou pour dans sur avec un une est are is what which how who quels quelles quel quelle comment qui que'.split(' '));
const tokens = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));

/** Markdown, plain text or HTML into heading/body blocks. */
export function documentBlocks(content: string, format: 'markdown' | 'text' | 'html'): DocumentBlock[] {
  let text = content.replace(/\r\n/g, '\n');
  if (format === 'html')
    text = text
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, n, t) => `\n${'#'.repeat(Number(n))} ${t.replace(/<[^>]+>/g, '')}\n`)
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<(br|\/p|\/div)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  if (format === 'text')
    // Plain text: treat short lines ending with a colon, or ALL CAPS lines, as headings.
    text = text.replace(/^([A-Z][^\n.:]{2,80}):?\s*$/gm, (line, h) => (/:\s*$/.test(line) || h === h.toUpperCase() ? `## ${h}` : line));
  const blocks: DocumentBlock[] = [];
  let current: DocumentBlock = { heading: '', body: '' };
  for (const line of text.split('\n')) {
    const h = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (h) {
      if (current.heading || current.body.trim()) blocks.push(current);
      current = { heading: h[1].trim(), body: '' };
    } else current.body += `${line}\n`;
  }
  if (current.heading || current.body.trim()) blocks.push(current);
  return blocks.map((b) => ({ heading: b.heading, body: b.body.trim() }));
}

function bestQuestion(heading: string, candidates: Question[]) {
  const h = new Set(tokens(heading));
  if (!h.size) return null;
  let best: { q: Question; score: number } | null = null;
  for (const q of candidates) {
    for (const text of [q.label.en, q.label.fr, q.prompt.en, q.prompt.fr]) {
      const t = new Set(tokens(text));
      const shared = [...h].filter((w) => t.has(w)).length;
      const score = shared / Math.max(1, Math.min(h.size, t.size));
      if (!best || score > best.score) best = { q, score };
    }
  }
  return best && best.score >= 0.6 ? best.q : null;
}
function bestModule(heading: string) {
  const h = new Set(tokens(heading));
  return modules.find((m) => [m.title.en, m.title.fr].some((t) => tokens(t).some((w) => h.has(w))));
}
const itemPattern = /^\s*[-*]?\s*\**\b(REQ|UC|ADR|CMP|RISK|TEST)-(\d{1,4})\**\s*[:—–-]\s*(.+)$/gm;
const itemTypes: Record<string, Item['type']> = { REQ: 'requirement', UC: 'use-case', ADR: 'decision', CMP: 'component', RISK: 'risk', TEST: 'test' };

export type DocumentMapping = { patch: SpecPatch; matched: { heading: string; target: string }[]; unmatched: string[] };

/**
 * Maps a document onto the specification: headings that match a question become answers for
 * empty questions, identifiers such as REQ-001 become draft items, and everything else is kept as
 * notes in the closest section (or Discovery).
 */
export function mapDocument(spec: Spec, blocks: DocumentBlock[], source: string): DocumentMapping {
  const questions = modules.flatMap((m) => moduleQuestions(m, spec));
  const answers: Record<string, Record<string, { value: string; state: 'answered'; reason: string }>> = {};
  const notes: Record<string, string[]> = {};
  const matched: DocumentMapping['matched'] = [];
  const unmatched: string[] = [];
  const items: Item[] = [];
  for (const block of blocks) {
    for (const m of block.body.matchAll(itemPattern)) {
      const id = `${m[1]}-${m[2].padStart(3, '0')}`;
      if (spec.items.some((i) => i.id === id) || items.some((i) => i.id === id)) continue;
      items.push({ id, type: itemTypes[m[1]], title: m[3].replace(/\*+/g, '').trim().slice(0, 500), body: '', status: 'draft', acceptance: '', owner: '', needsReview: false });
    }
    if (!block.body) continue;
    const q = block.heading ? bestQuestion(block.heading, questions) : null;
    const moduleId = q?.id.split('.')[0];
    const existing = q && moduleId ? spec.sections.find((s) => s.id === moduleId)?.answers[q.id] : undefined;
    if (q && moduleId && !['table', 'raci', 'requirements', 'comparison', 'multi', 'switch'].includes(q.kind) && (!existing || isBlankValue(existing.value))) {
      (answers[moduleId] ??= {})[q.id] = { value: block.body.slice(0, 30000), state: 'answered', reason: '' };
      matched.push({ heading: block.heading, target: q.id });
      continue;
    }
    const target = (block.heading && bestModule(block.heading)?.id) || 'discovery';
    (notes[target] ??= []).push(`### ${block.heading || 'Imported notes'}\n\n${block.body}`);
    if (block.heading) unmatched.push(block.heading);
  }
  const sections = new Map<string, NonNullable<SpecPatch['sections']>[number]>();
  for (const [id, a] of Object.entries(answers)) sections.set(id, { id, answers: a });
  for (const [id, list] of Object.entries(notes)) {
    const section = spec.sections.find((s) => s.id === id)!;
    sections.set(id, {
      ...(sections.get(id) ?? { id }),
      markdown: `${section.markdown.trimEnd()}\n\n## Imported from ${source}\n\n${list.join('\n\n')}\n`,
    });
  }
  const patch: SpecPatch = {};
  if (sections.size) patch.sections = [...sections.values()];
  if (items.length) patch.items = items;
  return { patch, matched, unmatched };
}
