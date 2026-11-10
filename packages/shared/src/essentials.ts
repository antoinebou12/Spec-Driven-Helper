import type { ProjectType } from './template-types';

/**
 * The minimal specification. At the "essentials" level only these questions are required, so a
 * correct specification (and with it the automatic task plan) takes 15 answers instead of 60.
 * Nothing is deleted: the other questions stay available, and the "complete" level requires them again.
 *
 * They are what a team needs to start building: the problem and who has it, what is in and out of
 * scope, the requirements with their acceptance criteria, the main journey, the shape of the system
 * and its data, how people sign in, the chosen stack, how it is verified end to end, and where it runs.
 * The list is for a web application or an API; `essentialIdsFor` adjusts it for the other project types.
 */
export const specLevels = ['essentials', 'complete'] as const;
export type SpecLevel = (typeof specLevels)[number];

export const essentialQuestionIds = [
  'discovery.1',
  'discovery.4',
  'scope.1',
  'scope.2',
  'scope.3',
  'scope.4',
  'workflows.2',
  'architecture.1',
  'architecture.2',
  'data.1',
  'security.1',
  'security.3',
  'technology.1',
  'testing.4',
  'delivery.1',
] as const;

/**
 * The list above is the one for a web application or an API. Other project types swap the few
 * questions that do not fit: a library has no sign-in and no environments of its own but has a public
 * API and a release; a device has no sign-in but has a test matrix of its own. Every question added
 * here applies to that type and is already required at the complete level (a test checks both, so the
 * essentials are always a subset of the complete requirements), and every type keeps an essential in
 * the same nine modules, so the reviews needed stay the same.
 */
const adjustments: Partial<Record<ProjectType, { drop: string[]; add: string[] }>> = {
  'Library / SDK': { drop: ['security.3', 'delivery.1'], add: ['data.9', 'delivery.8'] },
  'Embedded / IoT': { drop: ['security.3'], add: ['testing.9', 'delivery.8'] },
  'Mobile application': { drop: [], add: ['delivery.8'] },
  'Desktop application': { drop: [], add: ['delivery.8'] },
  'Data / AI system': { drop: [], add: ['testing.10'] },
};
const byType = new Map<string, readonly string[]>();
/** The essential question identifiers of a project type, in the order of the base list then the additions. */
export function essentialIdsFor(projectType: string): readonly string[] {
  let ids = byType.get(projectType);
  if (!ids) {
    const change = adjustments[projectType as ProjectType];
    ids = change
      ? [...essentialQuestionIds.filter((id) => !change.drop.includes(id)), ...change.add]
      : essentialQuestionIds;
    byType.set(projectType, ids);
  }
  return ids;
}
export const essentialCount = (projectType: string) => essentialIdsFor(projectType).length;
export const isEssential = (questionId: string, projectType = 'Web application') =>
  essentialIdsFor(projectType).includes(questionId);

export const levelLabels: Record<SpecLevel, { en: string; fr: string }> = {
  essentials: { en: 'Essentials', fr: 'L’essentiel' },
  complete: { en: 'Complete', fr: 'Complet' },
};
/** One line saying what a level requires, for a project type. */
export function levelHelp(
  level: SpecLevel,
  language: 'en' | 'fr',
  projectType = 'Web application',
) {
  if (level === 'complete')
    return language === 'fr'
      ? 'Toutes les questions des 14 modules sont obligatoires.'
      : 'Every question of the 14 modules is required.';
  const count = essentialCount(projectType);
  return language === 'fr'
    ? `${count} questions essentielles sont obligatoires ; ajoutez le reste plus tard.`
    : `${count} core questions are required; add the rest later.`;
}
