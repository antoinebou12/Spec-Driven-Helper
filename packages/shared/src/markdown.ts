import {
  moduleQuestions,
  tableKinds,
  t,
  type Language,
  type Module,
  type Question,
} from './templates';
import type { Answer, CustomQuestion, Section } from './schema';

/**
 * Section Markdown contains managed answer blocks:
 *
 *   <!-- sdd:answer discovery.1 -->
 *   …rendered answer…
 *   <!-- sdd:end -->
 *
 * Everything outside the blocks is free text owned by authors. Regenerating from answers only
 * rewrites block contents; editing inside a block implies a structured change, which the API
 * turns into a proposal instead of silently rewriting the answer.
 */
const blockPattern = /<!-- sdd:answer ([\w.-]+) -->\n?([\s\S]*?)\n?<!-- sdd:end -->/g;
const words = {
  en: {
    empty: '_Not answered yet._',
    unknown: '_Open question — not yet answered._',
    na: 'Not applicable',
    example: 'Example',
  },
  fr: {
    empty: '_Pas encore de réponse._',
    unknown: '_Question ouverte — sans réponse pour l’instant._',
    na: 'Non applicable',
    example: 'Exemple',
  },
};

export function rowsOf(value: string): string[][] | null {
  try {
    const rows = JSON.parse(value);
    if (Array.isArray(rows) && rows.every((r) => Array.isArray(r))) return rows.map((r) => r.map(String));
  } catch {
    // Legacy or free-text value.
  }
  return null;
}
const cell = (v: string) => v.replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
export function markdownTable(columns: string[], rows: string[][]) {
  const width = Math.max(columns.length, ...rows.map((r) => r.length));
  const head = Array.from({ length: width }, (_, i) => columns[i] ?? '');
  return [
    `| ${head.map(cell).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? '')).join(' | ')} |`),
  ].join('\n');
}
function parseTable(text: string): string[][] | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines.every((l) => l.startsWith('|'))) return null;
  const split = (l: string) =>
    l
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replaceAll('\\|', '|'));
  return lines.slice(2).map(split);
}

export function formatAnswer(question: Question, answer: Answer | undefined, lang: Language) {
  const w = words[lang];
  if (!answer) return w.empty;
  if (answer.state === 'not-applicable') return `_${w.na}: ${answer.reason.trim()}_`;
  const body = answerBody(question, answer.value, lang);
  if (answer.state === 'unknown') return body ? `${w.unknown}\n\n${body}` : w.unknown;
  return body || w.empty;
}
const yesNo = { en: ['Yes', 'No'], fr: ['Oui', 'Non'] };
/** Values of multi-select answers: a JSON array of option values (English) or free text. */
export function listOf(value: string): string[] {
  try {
    const list = JSON.parse(value);
    if (Array.isArray(list)) return list.map(String).filter((v) => v.trim());
  } catch {
    // Legacy or free-text value.
  }
  return value.trim() ? [value.trim()] : [];
}
const optionLabel = (question: Question, value: string, lang: Language) =>
  question.options?.find((o) => o.en === value)?.[lang] ?? value;
const optionValue = (question: Question, label: string) =>
  question.options?.find((o) => o.en.toLowerCase() === label.toLowerCase() || o.fr.toLowerCase() === label.toLowerCase())?.en ??
  label;
/** Matrix answers: a JSON object { row (English): option (English) }; anything else is empty. */
export function matrixOf(value: string): Record<string, string> {
  try {
    const map = JSON.parse(value);
    if (map && typeof map === 'object' && !Array.isArray(map)) return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, String(v)]));
  } catch {
    // Free text or empty.
  }
  return {};
}
const rowValue = (question: Question, label: string) =>
  question.rows?.find((r) => r.en.toLowerCase() === label.toLowerCase() || r.fr.toLowerCase() === label.toLowerCase())?.en ?? label;
function answerBody(question: Question, value: string, lang: Language) {
  if (question.kind === 'slider') return value.trim() ? `${value.trim()}${question.range?.unit ? ` ${question.range.unit[lang]}` : ''}` : '';
  if (question.kind === 'matrix') {
    const map = matrixOf(value);
    const rows = (question.rows ?? []).filter((r) => map[r.en]);
    if (!rows.length) return value.trim().startsWith('{') ? '' : value.trim();
    const head = lang === 'fr' ? ['Élément', 'Choix'] : ['Item', 'Choice'];
    return markdownTable(head, rows.map((r) => [r[lang], optionLabel(question, map[r.en], lang)]));
  }
  if (question.kind === 'switch') return value === 'yes' ? yesNo[lang][0] : value === 'no' ? yesNo[lang][1] : value.trim();
  if (question.kind === 'multi') return listOf(value).map((v) => `- ${optionLabel(question, v, lang)}`).join('\n');
  if (question.kind === 'choice') return optionLabel(question, value.trim(), lang);
  const rows = tableKinds.includes(question.kind) ? rowsOf(value) : null;
  if (rows) {
    const filled = rows.filter((r) => r.some((c) => c.trim()));
    return filled.length ? markdownTable((question.columns ?? []).map((c) => t(c, lang)), filled) : '';
  }
  return value.trim();
}

/** Parses a managed block back into an answer. `undefined` means “not answered”. */
export function parseAnswer(question: Question, text: string): Answer | undefined {
  const body = text.trim();
  const na = body.match(/^_(?:Not applicable|Non applicable) ?: ([\s\S]*)_$/);
  if (na) return { value: '', state: 'not-applicable', reason: na[1].trim() };
  if (!body || Object.values(words).some((w) => body === w.empty)) return undefined;
  for (const w of Object.values(words))
    if (body.startsWith(w.unknown))
      return { value: parseValue(question, body.slice(w.unknown.length)), state: 'unknown', reason: '' };
  return { value: parseValue(question, body), state: 'answered', reason: '' };
}
function parseValue(question: Question, text: string) {
  const body = text.trim();
  if (question.kind === 'switch') return /^(yes|oui)$/i.test(body) ? 'yes' : /^(no|non)$/i.test(body) ? 'no' : body;
  if (question.kind === 'choice') return optionValue(question, body);
  if (question.kind === 'slider') return /-?\d+(?:[.,]\d+)?/.exec(body)?.[0].replace(',', '.') ?? body;
  if (question.kind === 'matrix') {
    const rows = parseTable(body);
    if (rows) return JSON.stringify(Object.fromEntries(rows.filter((r) => r[0]?.trim() && r[1]?.trim()).map((r) => [rowValue(question, r[0].trim()), optionValue(question, r[1].trim())])));
    return body;
  }
  if (question.kind === 'multi')
    return JSON.stringify(
      body
        .split('\n')
        .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean)
        .map((l) => optionValue(question, l)),
    );
  if (tableKinds.includes(question.kind)) {
    const rows = parseTable(body);
    if (rows) return JSON.stringify(rows);
  }
  return body;
}

export function answerBlocks(markdown: string) {
  return [...markdown.matchAll(blockPattern)].map((m) => ({ questionId: m[1], text: m[2] }));
}

/** Section Markdown for readers: the answer text stays, the managed block markers go. */
export const stripAnswerMarkers = (markdown: string) => markdown.replace(/<!-- sdd:(?:answer [\w.-]+|end) -->\r?\n?/g, '');
const block = (question: Question, answer: Answer | undefined, lang: Language) =>
  `<!-- sdd:answer ${question.id} -->\n${formatAnswer(question, answer, lang)}\n<!-- sdd:end -->`;

/** Project type plus custom questions; a bare project type is accepted for convenience. */
export type QuestionContext = string | { projectType: string; customQuestions?: CustomQuestion[] };
const contextOf = (c: QuestionContext) => (typeof c === 'string' ? { projectType: c } : c);

export function renderSection(
  module: Module,
  section: Pick<Section, 'answers'>,
  lang: Language,
  context: QuestionContext,
  options: { example?: boolean } = {},
) {
  const w = words[lang];
  const parts = [`# ${t(module.title, lang)}`, t(module.description, lang)];
  if (options.example) parts.push(`> ${t(module.guidance, lang)}`);
  for (const q of moduleQuestions(module, contextOf(context))) {
    parts.push(`## ${t(q.label, lang)}`);
    if (options.example && q.example.en) parts.push(`> **${w.example}:** ${t(q.example, lang)}`);
    parts.push(block(q, section.answers[q.id], lang));
  }
  return parts.join('\n\n') + '\n';
}

/**
 * Rewrites managed blocks from the stored answers and (optionally) appends missing applicable
 * questions, preserving every character of free text around the blocks.
 */
export function refreshSectionMarkdown(
  module: Module,
  section: Pick<Section, 'answers' | 'markdown'>,
  lang: Language,
  context: QuestionContext,
  options: { appendMissing?: boolean } = { appendMissing: true },
) {
  const questions = moduleQuestions(module, contextOf(context));
  const seen = new Set<string>();
  let markdown = section.markdown.replace(blockPattern, (whole, id: string) => {
    const q = questions.find((x) => x.id === id) ?? module.questions.find((x) => x.id === id);
    if (!q) return whole;
    seen.add(id);
    return block(q, section.answers[id], lang);
  });
  if (!options.appendMissing) return markdown;
  const missing = questions.filter((q) => !seen.has(q.id));
  if (missing.length)
    markdown =
      markdown.trimEnd() +
      '\n\n' +
      missing.map((q) => `## ${t(q.label, lang)}\n\n${block(q, section.answers[q.id], lang)}`).join('\n\n') +
      '\n';
  return markdown;
}

/** Appends answer blocks for the given questions when the document does not have them yet. */
export function appendQuestionBlocks(
  markdown: string,
  questions: Question[],
  answers: Section['answers'],
  lang: Language,
) {
  const present = new Set(answerBlocks(markdown).map((b) => b.questionId));
  const missing = questions.filter((q) => !present.has(q.id));
  if (!missing.length) return markdown;
  return (
    markdown.trimEnd() +
    '\n\n' +
    missing.map((q) => `## ${t(q.label, lang)}\n\n${block(q, answers[q.id], lang)}`).join('\n\n') +
    '\n'
  );
}

const same = (a: Answer | undefined, b: Answer | undefined) =>
  (!a && !b) ||
  (!!a &&
    !!b &&
    a.state === b.state &&
    (a.state === 'not-applicable' ? a.reason.trim() === b.reason.trim() : a.value.trim() === b.value.trim()));

/** Answers whose managed block text no longer matches the stored structured answer. */
export function impliedAnswerChanges(
  module: Module,
  answers: Section['answers'],
  markdown: string,
  lang: Language,
  context: QuestionContext = '',
): Record<string, Answer> {
  const questions = [...module.questions, ...moduleQuestions(module, contextOf(context)).filter((q) => q.origin)];
  const changes: Record<string, Answer> = {};
  for (const { questionId, text } of answerBlocks(markdown)) {
    const q = questions.find((x) => x.id === questionId);
    if (!q) continue;
    const parsed = parseAnswer(q, text);
    const stored = answers[questionId];
    // Compare rendered forms so table whitespace and legacy text values do not cause noise.
    if (same(parsed, stored)) continue;
    if (formatAnswer(q, parsed, lang).trim() === formatAnswer(q, stored, lang).trim()) continue;
    if (parsed) changes[questionId] = parsed;
  }
  return changes;
}
