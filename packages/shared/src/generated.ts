import { appliesTo, modules, questionIn, tableKinds } from './templates';
import { generatedFormSchema, type CustomQuestion, type GeneratedUI } from './schema';

// Mermaid directives can change renderer configuration, and click statements bind callbacks
// or links. Neither is needed for a preview, so generated diagrams may not contain them.
const unsafeDiagram = /%%\s*\{|^\s*click\s|\bhref\b|javascript:|<\s*script/im;

export type GeneratedFormResult =
  | { ok: true; controls: GeneratedUI[] }
  | { ok: false; reason: string };

/**
 * Validates model-proposed interface controls against the approved component library and the
 * project's template. Any invalid control rejects the whole form so the client falls back to
 * the ordinary schema-based interview.
 */
type Context = string | { projectType: string; customQuestions?: CustomQuestion[] };
export function validateGeneratedForm(input: unknown, context: Context): GeneratedFormResult {
  const spec = typeof context === 'string' ? { projectType: context } : context;
  if (input === undefined || input === null) return { ok: true, controls: [] };
  const parsed = generatedFormSchema.safeParse(Array.isArray(input) ? input : [input]);
  if (!parsed.success) return { ok: false, reason: 'Controls do not match the approved schema' };
  for (const control of parsed.data) {
    const reason = controlProblem(control, spec);
    if (reason) return { ok: false, reason: `${control.questionId}: ${reason}` };
  }
  return { ok: true, controls: parsed.data };
}

function controlProblem(c: GeneratedUI, spec: { projectType: string; customQuestions?: CustomQuestion[] }): string | null {
  if (c.kind === 'diagram') {
    if (!modules.some((m) => m.id === c.questionId)) return 'diagram target must be a section';
    if (!c.code?.trim()) return 'diagram preview requires Mermaid source';
    if (unsafeDiagram.test(c.code)) return 'diagram contains directives, links or scripts';
    return null;
  }
  const question = questionIn(spec, c.questionId);
  if (!question) return 'unknown question';
  if (!question.origin && !appliesTo(question, spec.projectType)) return 'question does not apply to this project type';
  if (tableKinds.includes(question.kind) || ['multi', 'switch'].includes(question.kind)) {
    if (c.kind !== question.kind) return `question requires a ${question.kind} control`;
  } else if (!['text', 'choice'].includes(c.kind)) return 'question requires a text or choice control';
  if ((c.kind === 'choice' || c.kind === 'multi') && (c.options?.length ?? 0) < 2) return `${c.kind} requires at least two options`;
  if (c.code !== undefined) return 'only diagram controls may include code';
  return null;
}
