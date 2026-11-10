import type { Language } from './templates';

/**
 * Structured use cases (Cockburn style: actor, trigger, preconditions, main success scenario,
 * extensions, guarantee). Stored as readable Markdown in the item body, so exports, Git and
 * agents see the same text, and parsed back for editing.
 */
export type UseCaseFields = {
  actor: string;
  trigger: string;
  preconditions: string[];
  steps: string[];
  alternates: string[];
  postconditions: string[];
};

export const emptyUseCase = (): UseCaseFields => ({ actor: '', trigger: '', preconditions: [], steps: [], alternates: [], postconditions: [] });

const headings: Record<Exclude<keyof UseCaseFields, 'actor' | 'trigger'>, { en: string; fr: string }> = {
  preconditions: { en: 'Preconditions', fr: 'Préconditions' },
  steps: { en: 'Main flow', fr: 'Scénario principal' },
  alternates: { en: 'Alternate flows and edge cases', fr: 'Variantes et cas limites' },
  postconditions: { en: 'Outcome', fr: 'Résultat' },
};
const labels = { actor: { en: 'Actor', fr: 'Acteur' }, trigger: { en: 'Trigger', fr: 'Déclencheur' } };

export function renderUseCase(fields: UseCaseFields, lang: Language = 'en'): string {
  const out: string[] = [];
  if (fields.actor.trim()) out.push(`**${labels.actor[lang]}:** ${fields.actor.trim()}`);
  if (fields.trigger.trim()) out.push(`**${labels.trigger[lang]}:** ${fields.trigger.trim()}`);
  const list = (items: string[], numbered: boolean) =>
    items
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i) => (numbered ? `${i + 1}. ${s}` : `- ${s}`))
      .join('\n');
  for (const key of ['preconditions', 'steps', 'alternates', 'postconditions'] as const) {
    const body = list(fields[key], key === 'steps');
    if (body) out.push(`### ${headings[key][lang]}\n\n${body}`);
  }
  return out.join('\n\n');
}

/** Reads Markdown written by renderUseCase (either language); returns null for free text. */
export function parseUseCase(markdown: string): UseCaseFields | null {
  const fields = emptyUseCase();
  let recognised = false;
  let current: keyof typeof headings | null = null;
  const headingKey = (text: string) =>
    (Object.keys(headings) as (keyof typeof headings)[]).find((k) => headings[k].en.toLowerCase() === text.toLowerCase() || headings[k].fr.toLowerCase() === text.toLowerCase()) ?? null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const field = /^\*\*(Actor|Acteur|Trigger|Déclencheur):\*\*\s*(.*)$/.exec(line);
    if (field) {
      fields[/^(Actor|Acteur)$/.test(field[1]) ? 'actor' : 'trigger'] = field[2];
      recognised = true;
      current = null;
      continue;
    }
    const heading = /^#{2,4}\s+(.+)$/.exec(line);
    if (heading) {
      current = headingKey(heading[1]);
      if (current) recognised = true;
      continue;
    }
    const item = /^(?:\d+\.|[-*])\s+(.+)$/.exec(line);
    if (item && current) fields[current].push(item[1]);
  }
  return recognised ? fields : null;
}

/** What a reviewer would ask for; shown as hints, never blocking. */
export function reviewUseCase(fields: UseCaseFields, lang: Language = 'en'): string[] {
  const t = (en: string, fr: string) => (lang === 'fr' ? fr : en);
  const hints: string[] = [];
  if (!fields.actor.trim()) hints.push(t('Name the actor (a role, not a person).', 'Nommez l’acteur (un rôle, pas une personne).'));
  if (!fields.trigger.trim()) hints.push(t('Say what starts the use case.', 'Indiquez ce qui déclenche le cas d’utilisation.'));
  const steps = fields.steps.filter((s) => s.trim());
  if (steps.length < 2) hints.push(t('Describe the main flow in at least two steps.', 'Décrivez le scénario principal en au moins deux étapes.'));
  if (steps.length > 12) hints.push(t('More than 12 steps: consider splitting the use case.', 'Plus de 12 étapes : envisagez de scinder le cas.'));
  if (!fields.alternates.some((s) => s.trim())) hints.push(t('Add at least one alternate flow or edge case (errors, timeouts, empty data).', 'Ajoutez au moins une variante ou un cas limite (erreurs, délais, données vides).'));
  if (!fields.postconditions.some((s) => s.trim())) hints.push(t('State the outcome that proves success.', 'Indiquez le résultat qui prouve le succès.'));
  return hints;
}
