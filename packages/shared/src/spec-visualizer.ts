import { z } from 'zod';
import { completeness } from './completeness';
import { describeIssue, isComplete, readiness } from './domain';
import { modules, moduleQuestions } from './templates';
import type { Spec } from './schema';

export const specVisualSchema = z.object({
  name: z.string(),
  revision: z.number(),
  language: z.enum(['en', 'fr']),
  completeness: z.number(),
  ready: z.boolean(),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      done: z.number(),
      total: z.number(),
      status: z.string(),
      missing: z.array(z.string()),
    }),
  ),
  issues: z.array(z.string()),
  issueTotal: z.number(),
  items: z.array(z.object({ id: z.string(), title: z.string(), type: z.string() })),
  links: z.array(z.object({ from: z.string(), to: z.string(), kind: z.string() })),
  total: z.number(),
  offset: z.number(),
  nextOffset: z.number().nullable(),
  linkTotal: z.number(),
});
export type SpecVisual = z.infer<typeof specVisualSchema>;

/** Bounded snapshot of recorded facts. Relationships never imply architecture that was not recorded. */
export function specVisual(spec: Spec, offset = 0, language = spec.language): SpecVisual {
  const c = completeness(spec);
  const r = readiness(spec);
  const live = spec.items.filter((item) => item.status !== 'superseded');
  const items = live
    .slice(offset, offset + 24)
    .map(({ id, title, type }) => ({ id, title: title.slice(0, 160), type }));
  const ids = new Set(items.map((item) => item.id));
  const links = spec.links.filter((link) => ids.has(link.from) && ids.has(link.to));
  return {
    name: spec.name.slice(0, 200),
    revision: spec.revision,
    language,
    completeness: c.percent,
    ready: r.ready,
    sections: modules.map((module) => {
      const progress = c.perModule.find((entry) => entry.id === module.id)!;
      const section = spec.sections.find((entry) => entry.id === module.id)!;
      return {
        id: module.id,
        title: module.title[language],
        done: progress.requiredDone,
        total: progress.requiredTotal,
        status: progress.status,
        missing: moduleQuestions(module, spec)
          .filter((question) => question.required && !isComplete(section.answers[question.id]))
          .map((question) => question.id)
          .slice(0, 30),
      };
    }),
    issues: r.issues.slice(0, 24).map((issue) => describeIssue(issue, language).slice(0, 300)),
    issueTotal: r.issues.length,
    items,
    links: links.slice(0, 48).map(({ from, to, kind }) => ({ from, to, kind })),
    total: live.length,
    offset,
    nextOffset: offset + 24 < live.length ? offset + 24 : null,
    linkTotal: links.length,
  };
}
