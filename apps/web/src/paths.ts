import { findQuestion, modules, type Language } from '../../../packages/shared/src/templates';
import { formatAnswer } from '../../../packages/shared/src/markdown';
import type { Answer, Item, Link, Source } from '../../../packages/shared/src/schema';

const fieldNames: Record<string, [string, string]> = {
  markdown: ['Document', 'Document'],
  diagram: ['Diagram', 'Diagramme'],
  references: ['References', 'Références'],
  name: ['Project name', 'Nom du projet'],
  description: ['Description', 'Description'],
  projectType: ['Project type', 'Type de projet'],
  language: ['Document language', 'Langue du document'],
  localOnly: ['Local-only AI', 'IA locale uniquement'],
  technologyIds: ['Technology selections', 'Technologies retenues'],
  technologyDecisions: ['Technology decisions', 'Décisions technologiques'],
};
const pick = ([en, fr]: [string, string], lang: Language) => (lang === 'fr' ? fr : en);

/** Human label for a change path such as `sections.scope.answers.scope.3`. */
export function describePath(path: string, lang: Language) {
  const parts = path.split('.');
  if (parts[0] === 'sections') {
    const module = modules.find((m) => m.id === parts[1]);
    const section = module ? module.title[lang] : parts[1];
    if (parts[2] === 'answers') {
      const q = findQuestion(parts.slice(3).join('.'));
      return `${section} › ${q ? q.label[lang] : parts.slice(3).join('.')}`;
    }
    return `${section} › ${pick(fieldNames[parts[2]] ?? [parts[2], parts[2]], lang)}`;
  }
  if (parts[0] === 'items') return `${pick(['Item', 'Élément'], lang)} ${parts.slice(1).join('.')}`;
  if (parts[0] === 'links') return `${pick(['Link', 'Lien'], lang)} ${parts.slice(1).join('.')}`;
  return pick(fieldNames[path] ?? [path, path], lang);
}

/** Text form of a value at a path, for side-by-side comparison. */
export function displayValue(path: string, value: unknown, lang: Language): string {
  if (value === undefined || value === null) return '';
  const parts = path.split('.');
  if (parts[0] === 'sections' && parts[2] === 'answers') {
    const q = findQuestion(parts.slice(3).join('.'));
    return q ? formatAnswer(q, value as Answer, lang) : JSON.stringify(value, null, 2);
  }
  if (parts[0] === 'sections' && parts[2] === 'references')
    return (value as Source[]).map((r) => `- ${r.title} <${r.url}>`).join('\n');
  if (parts[0] === 'items') {
    const i = value as Item;
    return [
      `${i.id} (${i.type}, ${i.status}${i.priority ? `, ${i.priority}` : ''})`,
      i.title,
      i.body,
      i.acceptance && `${pick(['Acceptance', 'Acceptation'], lang)}: ${i.acceptance}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  if (parts[0] === 'links') {
    const k = value as Link;
    return `${k.from} —${k.kind}→ ${k.to}`;
  }
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
