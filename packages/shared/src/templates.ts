import { productModules } from './library/product';
import { systemModules } from './library/system';
import { buildModules } from './library/build';
import { deliveryModules } from './library/delivery';
import { structuredQuestions } from './library/structured';
import type { CustomQuestion } from './schema';
import { isEssential, type SpecLevel } from './essentials';
import type {
  Language,
  Localized,
  ModuleDraft,
  ModuleReference,
  Pair,
  ProjectType,
  QuestionKind,
} from './template-types';

export * from './template-types';

export const projectTypeLabels: Record<ProjectType, Localized> = {
  'Web application': { en: 'Web application', fr: 'Application web' },
  'API / service': { en: 'API / service', fr: 'API / service' },
  'Data / AI system': { en: 'Data / AI system', fr: 'Système de données / IA' },
  'Mobile application': { en: 'Mobile application', fr: 'Application mobile' },
  'Desktop application': { en: 'Desktop application', fr: 'Application de bureau' },
  'Library / SDK': { en: 'Library / SDK', fr: 'Bibliothèque / SDK' },
  'Embedded / IoT': { en: 'Embedded / IoT', fr: 'Embarqué / IoT' },
};

export const tableKinds: QuestionKind[] = ['table', 'raci', 'requirements', 'comparison'];
/** Kinds whose value must be one or more of the question's options. */
export const optionKinds: QuestionKind[] = ['choice', 'multi'];

export type Question = {
  /** Stable identifier `${moduleId}.${n}`. Never renumber or reuse. */
  id: string;
  /** Short noun phrase used as the document heading. */
  label: Localized;
  /** The question asked in the interview. */
  prompt: Localized;
  /** Beginner explanation: why this matters and how to answer. */
  explain: Localized;
  /** Expert checklist: what a complete answer contains. */
  hint: Localized;
  example: Localized;
  required: boolean;
  kind: QuestionKind;
  options?: Localized[];
  columns?: Localized[];
  /** Slider bounds; the answer is a number string within them. */
  range?: { min: number; max: number; step: number; unit?: Localized };
  /** Matrix rows; the answer is a JSON object mapping each row (English) to an option (English). */
  rows?: Localized[];
  /** Restrict the question to these project types. */
  only?: ProjectType[];
  /** Hide the question for these project types. */
  skip?: ProjectType[];
  /** Set for project-specific questions (stack rules, AI proposals, authors). */
  origin?: CustomQuestion['origin'];
};
export type DiagramTemplate = { id: string; title: Localized; code: string };
export type Module = {
  id: string;
  title: Localized;
  description: Localized;
  guidance: Localized;
  questions: Question[];
  dependsOn: string[];
  /** Default starter diagram (first template). */
  diagram: string;
  diagrams: DiagramTemplate[];
  references: ModuleReference[];
};

const L = ([en, fr]: Pair): Localized => ({ en, fr });
export const defaultColumns: Partial<Record<QuestionKind, Pair[]>> = {
  table: [
    ['Item', 'Élément'],
    ['Details', 'Détails'],
    ['Owner', 'Responsable'],
  ],
  raci: [
    ['Activity', 'Activité'],
    ['Responsible', 'Réalise'],
    ['Accountable', 'Approuve'],
    ['Consulted', 'Consulté'],
    ['Informed', 'Informé'],
  ],
  requirements: [
    ['ID', 'ID'],
    ['Requirement', 'Exigence'],
    ['Priority', 'Priorité'],
    ['Acceptance criteria', 'Critères d’acceptation'],
  ],
  comparison: [
    ['Option', 'Option'],
    ['Strengths', 'Forces'],
    ['Weaknesses', 'Faiblesses'],
    ['Decision', 'Décision'],
  ],
};

function finalize(draft: ModuleDraft): Module {
  return {
    id: draft.id,
    title: L(draft.title),
    description: L(draft.description),
    guidance: L(draft.guidance),
    dependsOn: draft.dependsOn,
    references: draft.references,
    diagrams: draft.diagrams.map((d) => ({ id: d.id, title: L(d.title), code: d.code })),
    diagram: draft.diagrams[0]?.code ?? '',
    questions: draft.questions.map((q) => {
      const kind = q.kind ?? 'text';
      const columns = q.columns ?? defaultColumns[kind];
      return {
        id: `${draft.id}.${q.n}`,
        label: L(q.label),
        prompt: L(q.prompt),
        explain: L(q.explain),
        hint: L(q.hint),
        example: L(q.example),
        required: q.required ?? false,
        kind,
        ...(q.options ? { options: q.options.map(L) } : {}),
        ...(columns ? { columns: columns.map(L) } : {}),
        ...(q.range ? { range: { min: q.range.min, max: q.range.max, step: q.range.step, ...(q.range.unit ? { unit: L(q.range.unit) } : {}) } } : {}),
        ...(q.rows ? { rows: q.rows.map(L) } : {}),
        ...(q.only ? { only: q.only } : {}),
        ...(q.skip ? { skip: q.skip } : {}),
      };
    }),
  };
}

export const modules: Module[] = [...productModules, ...systemModules, ...buildModules, ...deliveryModules]
  .map((m) => ({ ...m, questions: [...m.questions, ...(structuredQuestions[m.id] ?? [])] }))
  .map(finalize);

const questionIndex = new Map(modules.flatMap((m) => m.questions.map((q) => [q.id, q] as const)));
export const findQuestion = (id: string) => questionIndex.get(id);
export const moduleOf = (questionId: string) =>
  modules.find((m) => m.id === questionId.split('.')[0]);

export function appliesTo(question: Question, projectType: string) {
  if (question.only && !question.only.includes(projectType as ProjectType)) return false;
  if (question.skip?.includes(projectType as ProjectType)) return false;
  return true;
}
export const applicableQuestions = (module: Module, projectType: string) =>
  module.questions.filter((q) => appliesTo(q, projectType));

const blank: Localized = { en: '', fr: '' };
export function customToQuestion(c: CustomQuestion): Question {
  const kind = c.kind;
  const columns = defaultColumns[kind];
  return {
    id: c.id,
    label: c.label,
    prompt: c.prompt,
    explain: c.explain,
    hint: c.explain,
    example: blank,
    required: c.required,
    kind,
    ...(c.options ? { options: c.options } : {}),
    ...(columns ? { columns: columns.map(L) } : {}),
    origin: c.origin,
  };
}
/**
 * Applicable template questions followed by the project's custom questions for the module. At the
 * "essentials" level a template question is required only when it is essential (see essentials.ts);
 * a custom question keeps the flag its author gave it. Every reader of `required` goes through here,
 * so readiness, completeness and the interview all follow the level without knowing about it.
 */
export function moduleQuestions(
  module: Module,
  spec: { projectType: string; customQuestions?: CustomQuestion[]; level?: SpecLevel },
): Question[] {
  const essentials = spec.level === 'essentials';
  return [
    ...applicableQuestions(module, spec.projectType).map((q) =>
      essentials && q.required && !isEssential(q.id, spec.projectType)
        ? { ...q, required: false }
        : q,
    ),
    ...(spec.customQuestions ?? []).filter((c) => c.moduleId === module.id).map(customToQuestion),
  ];
}
/** Template or custom question by identifier. */
export function questionIn(spec: { customQuestions?: CustomQuestion[] }, id: string): Question | undefined {
  const custom = spec.customQuestions?.find((c) => c.id === id);
  return custom ? customToQuestion(custom) : findQuestion(id);
}

export const t = (value: Localized, language: Language) => value[language];
