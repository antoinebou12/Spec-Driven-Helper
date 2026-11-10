/**
 * Types shared by `templates.ts` and the question library. The library files import from here
 * rather than from `templates.ts`, which imports them, so the module graph stays acyclic.
 */
export type Language = 'en' | 'fr';
export type Localized = { en: string; fr: string };

export const projectTypes = [
  'Web application',
  'API / service',
  'Data / AI system',
  'Mobile application',
  'Desktop application',
  'Library / SDK',
  'Embedded / IoT',
] as const;
export type ProjectType = (typeof projectTypes)[number];

/**
 * Structured answer controls. Table-like kinds store their rows as a JSON array of string
 * arrays so they round-trip through JSON, Markdown and Git without a separate schema.
 */
export type QuestionKind = 'text' | 'choice' | 'multi' | 'switch' | 'slider' | 'matrix' | 'table' | 'raci' | 'requirements' | 'comparison';

/** Bounds of a slider answer; the value is stored as a plain number string. */
export type RangeDraft = { min: number; max: number; step: number; unit?: Pair };

export type ModuleReference = { title: string; url: string };

// Authoring format used by the library files: [English, French] pairs.
export type Pair = readonly [string, string];
export type QuestionDraft = {
  n: number;
  label: Pair;
  prompt: Pair;
  explain: Pair;
  hint: Pair;
  example: Pair;
  required?: boolean;
  kind?: QuestionKind;
  options?: Pair[];
  columns?: Pair[];
  /** Slider bounds (kind 'slider'). */
  range?: RangeDraft;
  /** Matrix rows (kind 'matrix'); `options` are the columns, one choice per row. */
  rows?: Pair[];
  only?: ProjectType[];
  skip?: ProjectType[];
};
export type ModuleDraft = {
  id: string;
  title: Pair;
  description: Pair;
  guidance: Pair;
  dependsOn: string[];
  references: ModuleReference[];
  diagrams: { id: string; title: Pair; code: string }[];
  questions: QuestionDraft[];
};
