import { z } from 'zod';

/**
 * Answers you can interact with (after CopilotKit's Open Intelligent UI): instead of prose, the AI in
 * Build with AI may answer with one of a few native components — a weighted comparison, a step-by-step
 * walkthrough, or a bar chart. The model only sends data in this shape; the browser renders it with
 * its own components. No model-written HTML or JavaScript is ever run, and nothing here changes the
 * specification: a follow-up the person clicks becomes a message, and recorded facts stay proposals.
 */
const text = (max: number) => z.string().trim().min(1).max(max);
const basis = z
  .string()
  .trim()
  .max(300)
  .default('')
  .describe(
    'Where the scores or numbers come from: what the user said, or "estimate" with the assumption',
  );

export const comparisonVisual = z
  .object({
    kind: z.literal('comparison'),
    title: text(120).describe('The decision being compared, e.g. "Database for the request store"'),
    options: z.array(text(60)).min(2).max(5).describe('The choices, 2 to 5'),
    criteria: z
      .array(
        z.object({
          name: text(60),
          weight: z
            .number()
            .int()
            .min(0)
            .max(3)
            .default(1)
            .describe('How much it matters: 0 (ignore) to 3 (critical)'),
        }),
      )
      .min(1)
      .max(8),
    cells: z
      .array(
        z.array(
          z.object({
            score: z.number().int().min(1).max(5).describe('1 (poor) to 5 (excellent)'),
            note: z.string().trim().max(140).default(''),
          }),
        ),
      )
      .describe('One row per criterion, one cell per option, in the same order'),
    basis,
  })
  .superRefine((v, ctx) => {
    if (
      v.cells.length !== v.criteria.length ||
      v.cells.some((row) => row.length !== v.options.length)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'cells must have one row per criterion and one cell per option',
      });
  });

export const stepsVisual = z.object({
  kind: z.literal('steps'),
  title: text(120).describe('What the steps explain, e.g. "How a request is submitted"'),
  steps: z
    .array(
      z.object({
        title: text(80),
        detail: z.string().trim().max(400).default(''),
        actor: z.string().trim().max(40).default(''),
      }),
    )
    .min(2)
    .max(10),
  basis,
});

export const chartVisual = z.object({
  kind: z.literal('chart'),
  title: text(120).describe('What is measured, e.g. "Latency budget per step"'),
  unit: z.string().trim().max(20).default(''),
  bars: z
    .array(z.object({ label: text(40), value: z.number().finite().min(0).max(1e12) }))
    .min(2)
    .max(12),
  target: z
    .number()
    .finite()
    .min(0)
    .max(1e12)
    .optional()
    .describe('An optional limit drawn as a line, e.g. an SLO'),
  targetLabel: z.string().trim().max(40).default(''),
  basis,
});

export const visualAnswerSchema = z.discriminatedUnion('kind', [
  comparisonVisual,
  stepsVisual,
  chartVisual,
]);
export type VisualAnswer = z.infer<typeof visualAnswerSchema>;
export type ComparisonVisual = z.infer<typeof comparisonVisual>;
export type StepsVisual = z.infer<typeof stepsVisual>;
export type ChartVisual = z.infer<typeof chartVisual>;

/** The tool's arguments: the visual sits under one key, because providers want an object at the top. */
export const showVisualArgs = z.object({ visual: visualAnswerSchema });

export const showVisualTool = {
  name: 'show_visual',
  description:
    'Show an interactive answer instead of prose when it helps the user decide or understand: "comparison" when they weigh options (score each option 1-5 per weighted criterion), "steps" to walk through a flow or sequence, "chart" for a few numbers. Use at most once per reply, then add one short sentence. Fill basis honestly; never present an estimate as a fact. It changes nothing in the document.',
  parameters: z.toJSONSchema(showVisualArgs, { io: 'input' }),
} as const;

/** Parses a model's `show_visual` arguments; the error is written for the model to fix and retry. */
export function parseVisual(raw: unknown): { visual: VisualAnswer } | { error: string } {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw || '{}');
    } catch {
      return {
        error:
          'show_visual arguments were not valid JSON. Send one JSON object: {"visual": {...}}.',
      };
    }
  }
  const parsed = showVisualArgs.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: `show_visual: ${issue?.path.join('.') || 'visual'} ${issue?.message ?? 'is invalid'}. Fix it and send it again, or answer in prose.`,
    };
  }
  return { visual: parsed.data.visual };
}

/** Weighted score of each option, 0–100, best first; the ranking the comparison shows. */
export function rankOptions(v: ComparisonVisual, weights = v.criteria.map((c) => c.weight)) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  return v.options
    .map((option, i) => {
      const points = v.cells.reduce((sum, row, c) => sum + (row[i]?.score ?? 0) * weights[c], 0);
      return { option, index: i, score: total ? Math.round(((points / total - 1) / 4) * 100) : 0 };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
