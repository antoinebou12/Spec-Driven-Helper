import { answerStatus } from './domain';
import { answerSummary } from './interview';
import { moduleQuestions, modules } from './templates';
import type { Spec } from './schema';

// Labels are data, never Mermaid syntax, links, HTML or renderer directives.
function label(value: string) {
  return value
    .replace(/[<>"`{}[\]\\]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110);
}

/** Evidence maps show recorded answers, not inferred architecture or causality. */
export function sectionEvidenceDiagram(spec: Spec, sectionId: string): string | null {
  const module = modules.find((m) => m.id === sectionId);
  const section = spec.sections.find((s) => s.id === sectionId);
  if (!module || !section) return null;
  const answered = moduleQuestions(module, spec).filter(
    (q) => answerStatus(section.answers[q.id]) === 'answered',
  );
  if (!answered.length) return null;
  const lines = ['flowchart TB', `  section["${label(module.title[spec.language])}"]`];
  for (const [index, q] of answered.entries()) {
    lines.push(`  q${index}["${label(q.label[spec.language])}"]`);
    lines.push(`  a${index}["${label(answerSummary(q, section.answers[q.id], spec.language))}"]`);
    lines.push(`  section --- q${index}`, `  q${index} --- a${index}`);
  }
  return lines.join('\n');
}
