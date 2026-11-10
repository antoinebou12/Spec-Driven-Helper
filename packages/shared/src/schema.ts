import { z } from 'zod';
import { specLevels } from './essentials';
export const roleSchema = z.enum(['Owner', 'Admin', 'Editor', 'Reviewer', 'Viewer']);
export type Role = z.infer<typeof roleSchema>;
export const sourceSchema = z.object({
  id: z.string(),
  title: z.string().max(500),
  url: z
    .string()
    .max(2000)
    .refine((v) => /^https?:\/\//.test(v), 'Only http(s) references are allowed'),
  kind: z.enum(['official', 'custom']),
  accessedAt: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;
export const answerSchema = z
  .object({
    value: z.string().max(30000),
    state: z.enum(['answered', 'unknown', 'not-applicable']),
    reason: z.string().max(2000).default(''),
  })
  .refine(
    (a) => a.state !== 'not-applicable' || a.reason.trim().length > 0,
    'Explain why this does not apply',
  );
export type Answer = z.infer<typeof answerSchema>;
export const sectionSchema = z.object({
  id: z.string(),
  markdown: z.string().max(200000),
  diagram: z.string().max(20000).default(''),
  answers: z.record(z.string(), answerSchema),
  status: z.enum(['draft', 'needs-review', 'reviewed']).default('draft'),
  references: z.array(sourceSchema).default([]),
});
export type Section = z.infer<typeof sectionSchema>;
export const linkKinds = [
  'satisfies',
  'implements',
  'tests',
  'depends-on',
  'decides',
  'mitigates',
  'refines',
  'contradicts',
] as const;
export const linkSchema = z.object({
  id: z.string().min(1).max(100),
  from: z.string(),
  to: z.string(),
  kind: z.enum(linkKinds),
});
export type Link = z.infer<typeof linkSchema>;
export const itemTypes = ['requirement', 'use-case', 'decision', 'component', 'risk', 'test'] as const;
export const itemSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9][\w.-]*$/, 'Use letters, digits, dots, dashes or underscores'),
  type: z.enum(itemTypes),
  title: z.string().min(1).max(500),
  body: z.string().max(20000).default(''),
  status: z.enum(['draft', 'accepted', 'superseded']).default('draft'),
  acceptance: z.string().max(5000).default(''),
  priority: z.enum(['must', 'should', 'could', 'wont']).optional(),
  owner: z.string().max(200).default(''),
  /** Set when an upstream item changed; only a reviewer can clear it. */
  needsReview: z.boolean().default(false),
});
export type Item = z.infer<typeof itemSchema>;
export const stackLayers = [
  'frontend',
  'backend',
  'mobile',
  'desktop',
  'data',
  'communication',
  'contracts',
  'infrastructure',
  'iac',
  'cicd',
  'testing',
  'observability',
  'ai',
  'development',
] as const;
export type StackLayer = (typeof stackLayers)[number];
export const stackEntrySchema = z.object({
  technologyId: z.string().max(100),
  layer: z.enum(stackLayers),
  version: z.string().max(100).default(''),
  note: z.string().max(500).default(''),
});
export type StackEntry = z.infer<typeof stackEntrySchema>;
export const questionKinds = ['text', 'choice', 'multi', 'switch', 'slider', 'matrix', 'table', 'raci', 'requirements', 'comparison'] as const;
const localizedSchema = z.object({ en: z.string().max(2000), fr: z.string().max(2000) });
export const customQuestionSchema = z.object({
  id: z.string().regex(/^[a-z]+\.c-[a-z0-9-]{1,60}$/, 'Custom question IDs look like module.c-name'),
  moduleId: z.string(),
  label: localizedSchema,
  prompt: localizedSchema,
  explain: localizedSchema,
  kind: z.enum(questionKinds).default('text'),
  options: z.array(localizedSchema).max(30).optional(),
  required: z.boolean().default(false),
  origin: z.enum(['rule', 'ai', 'manual']),
  rule: z.string().max(100).optional(),
});
export type CustomQuestion = z.infer<typeof customQuestionSchema>;
export const specSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(3000),
  projectType: z.string().max(100),
  language: z.enum(['en', 'fr']),
  localOnly: z.boolean(),
  /** How much must be answered before the specification is correct (see essentials.ts). */
  level: z.enum(specLevels).default('complete'),
  revision: z.number().int().nonnegative(),
  sections: z.array(sectionSchema).length(14),
  items: z.array(itemSchema),
  links: z.array(linkSchema),
  technologyIds: z.array(z.string()),
  /** Project-specific links from selected technologies to this project's decision items. */
  technologyDecisions: z.record(z.string(), z.array(z.string())).default({}),
  /** Technology stack chosen before the interview, by layer. */
  stack: z.array(stackEntrySchema).max(200).default([]),
  /** Questions added for this project by stack rules, AI proposals or authors. */
  customQuestions: z.array(customQuestionSchema).max(300).default([]),
  updatedAt: z.string(),
  updatedBy: z.string(),
});
export type Spec = z.infer<typeof specSchema>;

/**
 * Partial section change. Present fields replace the stored value, except `answers`, which
 * merges per question. `status` is accepted for compatibility and always recomputed.
 */
export const sectionPatchSchema = z
  .object({
    id: z.string(),
    markdown: z.string().max(200000).optional(),
    diagram: z.string().max(20000).optional(),
    answers: z.record(z.string(), answerSchema).optional(),
    references: z.array(sourceSchema).optional(),
    status: z.enum(['draft', 'needs-review', 'reviewed']).optional(),
  })
  .strict();
export type SectionPatch = z.infer<typeof sectionPatchSchema>;
export const patchSchema = z
  .object({
    sections: z.array(sectionPatchSchema).max(14).optional(),
    /** Upserted by identifier. */
    items: z.array(itemSchema).max(500).optional(),
    removeItems: z.array(z.string()).max(500).optional(),
    /** Upserted by identifier. */
    links: z.array(linkSchema).max(2000).optional(),
    removeLinks: z.array(z.string()).max(2000).optional(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(3000).optional(),
    projectType: z.string().max(100).optional(),
    language: z.enum(['en', 'fr']).optional(),
    localOnly: z.boolean().optional(),
    level: z.enum(specLevels).optional(),
    technologyIds: z.array(z.string()).optional(),
    technologyDecisions: z.record(z.string(), z.array(z.string())).optional(),
    stack: z.array(stackEntrySchema).max(200).optional(),
    /** Upserted by identifier. */
    customQuestions: z.array(customQuestionSchema).max(300).optional(),
    removeCustomQuestions: z.array(z.string()).max(300).optional(),
  })
  .strict();
export type SpecPatch = z.infer<typeof patchSchema>;

export const changeSchema = z.object({
  path: z.string(),
  kind: z.enum(['added', 'changed', 'removed']),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
export type Change = z.infer<typeof changeSchema>;
export const conflictSchema = z.object({
  path: z.string(),
  base: z.unknown().optional(),
  current: z.unknown().optional(),
  yours: z.unknown().optional(),
});
export type Conflict = z.infer<typeof conflictSchema>;

/**
 * Approved generated controls. The model returns data matching this schema; the client
 * renders it through a fixed OpenUI component library. Nothing here is executable.
 */
export const generatedUISchema = z
  .object({
    kind: z.enum(['text', 'choice', 'multi', 'switch', 'table', 'raci', 'requirements', 'comparison', 'diagram']),
    questionId: z.string().max(100),
    label: z.string().max(500),
    help: z.string().max(2000).optional(),
    options: z.array(z.string().max(500)).max(30).optional(),
    columns: z.array(z.string().max(100)).max(8).optional(),
    suggestion: z.string().max(5000).optional(),
    code: z.string().max(5000).optional(),
  })
  .strict();
export type GeneratedUI = z.infer<typeof generatedUISchema>;
export const generatedFormSchema = z.array(generatedUISchema).max(5);

export const proposalSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  baseRevision: z.number().int(),
  title: z.string().max(300),
  patch: patchSchema,
  assumptions: z.array(z.string().max(2000)).max(50),
  sources: z.array(sourceSchema).max(50),
  status: z.enum(['pending', 'accepted', 'rejected']),
  createdAt: z.string(),
  createdBy: z.string(),
  /** `agent`: submitted by a coding agent through the MCP server. */
  origin: z.enum(['ai', 'git', 'import', 'manual', 'agent']),
  changes: z.array(changeSchema).optional(),
  ui: generatedFormSchema.optional(),
});
export type Proposal = z.infer<typeof proposalSchema>;
export const quadrants = ['Languages & Frameworks', 'Tools', 'Platforms', 'Techniques'] as const;
export const rings = ['Adopt', 'Trial', 'Assess', 'Hold'] as const;
export const technologyCategories = [
  'language',
  'framework',
  'runtime',
  'library',
  'database',
  'search',
  'storage',
  'messaging',
  'contract',
  'platform',
  'cloud',
  'networking',
  'identity',
  'os',
  'iac',
  'ci-cd',
  'testing',
  'development',
  'tooling',
  'observability',
  'security',
  'ai',
] as const;
export const technologyVersionSchema = z.object({
  version: z.string().max(60),
  lts: z.boolean().default(false),
  latest: z.boolean().default(false),
  support: z.string().max(200).default(''),
});
export type TechnologyVersion = z.infer<typeof technologyVersionSchema>;
export const technologySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  version: z.string().max(100),
  quadrant: z.enum(quadrants),
  ring: z.enum(rings),
  owner: z.string().max(200),
  rationale: z.string().max(5000),
  license: z.string().max(100),
  support: z.string().max(1000),
  tags: z.array(z.string().max(100)),
  alternatives: z.array(z.string().max(200)),
  references: z.array(sourceSchema),
  reviewDate: z.string(),
  decisionIds: z.array(z.string()),
  category: z.enum(technologyCategories).default('tooling'),
  /** Stack layers this technology fits. */
  layers: z.array(z.enum(stackLayers)).default([]),
  versions: z.array(technologyVersionSchema).max(40).default([]),
  /** Simple Icons slug; the interface falls back to a category icon. */
  icon: z.string().max(60).default(''),
  source: z.enum(['seed', 'custom']).default('custom'),
  history: z.array(
    z.object({ ring: z.string(), at: z.string(), by: z.string(), note: z.string().optional() }),
  ),
});
export type Technology = z.infer<typeof technologySchema>;
export const connectorSchema = z.object({
  id: z.string(),
  name: z.string(),
  authentication: z.enum(['api-key', 'oauth', 'none', 'service-token']),
  capabilities: z.array(z.enum(['read', 'propose', 'publish', 'generate'])),
  status: z.enum(['available', 'planned', 'configured']),
});
export const importSchema = z.object({
  format: z.literal('sdd-studio'),
  version: z.literal(1),
  spec: specSchema,
  technologies: z.array(technologySchema).default([]),
});
export type Bundle = z.infer<typeof importSchema>;
export const exportManifestSchema = z.object({
  format: z.literal('sdd-studio'),
  version: z.literal(1),
  projectId: z.string(),
  revision: z.number().int(),
  generatedAt: z.string(),
  files: z.array(z.object({ path: z.string(), sha256: z.string() })),
});
export const jsonSchemas = {
  specification: z.toJSONSchema(specSchema),
  patch: z.toJSONSchema(patchSchema),
  proposal: z.toJSONSchema(proposalSchema),
  technology: z.toJSONSchema(technologySchema),
  generatedUI: z.toJSONSchema(generatedUISchema),
  bundle: z.toJSONSchema(importSchema),
  manifest: z.toJSONSchema(exportManifestSchema),
  connector: z.toJSONSchema(connectorSchema),
};
