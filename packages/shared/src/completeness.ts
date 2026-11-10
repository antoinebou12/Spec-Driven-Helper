import { isComplete, sectionNeedsReview } from './domain';
import { moduleQuestions, modules } from './templates';
import type { Spec } from './schema';

/**
 * How complete a specification is, for progress visuals. Unlike readiness (a strict gate), this is
 * a weighted indicator: required answers 50%, optional answers 15%, section reviews 20% and
 * requirement-to-test coverage 15%. Generated Markdown never counts.
 */
export function completeness(spec: Spec) {
  const perModule = modules.map((m) => {
    const section = spec.sections.find((s) => s.id === m.id)!;
    const questions = moduleQuestions(m, spec);
    const required = questions.filter((q) => q.required);
    const optional = questions.filter((q) => !q.required);
    const done = (list: typeof questions) => list.filter((q) => isComplete(section.answers[q.id])).length;
    return {
      id: m.id,
      status: section.status,
      requiredDone: done(required),
      requiredTotal: required.length,
      optionalDone: done(optional),
      optionalTotal: optional.length,
      unknown: questions.filter((q) => section.answers[q.id]?.state === 'unknown').length,
    };
  });
  const sum = (key: keyof (typeof perModule)[number]) => perModule.reduce((n, m) => n + (m[key] as number), 0);
  const ratio = (a: number, b: number) => (b ? a / b : 1);
  const requirements = spec.items.filter((i) => i.type === 'requirement' && i.status !== 'superseded');
  const tested = requirements.filter((r) => spec.links.some((l) => l.kind === 'tests' && l.to === r.id));
  // Only sections that need a review count (at the essentials level, those holding a required question).
  const needReview = spec.sections.filter((s) => sectionNeedsReview(spec, s.id));
  const reviewed = needReview.filter((s) => s.status === 'reviewed').length;
  const parts = {
    required: ratio(sum('requiredDone'), sum('requiredTotal')),
    optional: ratio(sum('optionalDone'), sum('optionalTotal')),
    reviewed: ratio(reviewed, needReview.length),
    coverage: requirements.length ? tested.length / requirements.length : 0,
  };
  return {
    percent: Math.round((parts.required * 0.5 + parts.optional * 0.15 + parts.reviewed * 0.2 + parts.coverage * 0.15) * 100),
    parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 100)])) as Record<keyof typeof parts, number>,
    requiredDone: sum('requiredDone'),
    requiredTotal: sum('requiredTotal'),
    optionalDone: sum('optionalDone'),
    optionalTotal: sum('optionalTotal'),
    reviewed,
    /** How many sections need a review: all of them, or at the essentials level those holding a required question. */
    reviewNeeded: needReview.length,
    requirements: requirements.length,
    tested: tested.length,
    stackLayers: new Set(spec.stack.map((e) => e.layer)).size,
    perModule,
  };
}
