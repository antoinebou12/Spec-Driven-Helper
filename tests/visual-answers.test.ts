import { describe, expect, it } from 'vitest';
import {
  parseVisual,
  rankOptions,
  showVisualTool,
  visualAnswerSchema,
  type ComparisonVisual,
} from '../packages/shared/src/visual-answers';

/** Interactive answers: the AI sends data in one of three shapes, checked before anything is drawn. */
const comparison = {
  kind: 'comparison',
  title: 'Database for the request store',
  options: ['PostgreSQL', 'MongoDB'],
  criteria: [
    { name: 'Team knows it', weight: 3 },
    { name: 'Flexible documents', weight: 1 },
  ],
  cells: [
    [{ score: 5 }, { score: 2 }],
    [{ score: 3 }, { score: 5 }],
  ],
  basis: 'Estimate from what the user said about the team.',
};

describe('the visual answer schema', () => {
  it('accepts a comparison, steps and a chart, filling defaults', () => {
    const c = visualAnswerSchema.parse(comparison) as ComparisonVisual;
    expect(c.cells[0][0].note).toBe('');
    expect(
      visualAnswerSchema.parse({
        kind: 'steps',
        title: 'Submit a request',
        steps: [{ title: 'Sign in' }, { title: 'Submit' }],
      }),
    ).toMatchObject({ steps: [{ detail: '', actor: '' }, {}] });
    expect(
      visualAnswerSchema.parse({
        kind: 'chart',
        title: 'Latency budget',
        unit: 'ms',
        bars: [
          { label: 'API', value: 120 },
          { label: 'DB', value: 40 },
        ],
        target: 200,
      }),
    ).toMatchObject({ target: 200, targetLabel: '' });
  });

  it('refuses shapes that cannot be drawn honestly', () => {
    const bad = [
      { ...comparison, cells: [[{ score: 5 }, { score: 2 }]] },
      { ...comparison, options: ['Only one'] },
      {
        ...comparison,
        cells: [
          [{ score: 9 }, { score: 2 }],
          [{ score: 3 }, { score: 5 }],
        ],
      },
      {
        kind: 'chart',
        title: 'x',
        bars: [
          { label: 'a', value: -1 },
          { label: 'b', value: 1 },
        ],
      },
      { kind: 'steps', title: 'x', steps: [{ title: 'only' }] },
      { kind: 'html', title: 'x', html: '<script>alert(1)</script>' },
    ];
    for (const value of bad)
      expect(visualAnswerSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
  });

  it('turns a model’s arguments into a visual, or an error the model can act on', () => {
    expect(parseVisual(JSON.stringify({ visual: comparison }))).toMatchObject({
      visual: { kind: 'comparison' },
    });
    expect(parseVisual({ visual: comparison })).toMatchObject({ visual: { kind: 'comparison' } });
    expect(parseVisual('{not json')).toEqual({ error: expect.stringContaining('not valid JSON') });
    expect(parseVisual({ visual: { ...comparison, cells: [] } })).toEqual({
      error: expect.stringContaining('cells'),
    });
  });

  it('is offered to the model as an object with the visual under one key', () => {
    const schema = showVisualTool.parameters as {
      type: string;
      required?: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['visual']);
    expect(showVisualTool.description).toMatch(/changes nothing in the document/);
  });
});

describe('ranking a comparison', () => {
  const c = visualAnswerSchema.parse(comparison) as ComparisonVisual;
  it('scores each option 0–100 by the weights, best first', () => {
    // PostgreSQL: (5×3 + 3×1)/4 = 4.5 → 88; MongoDB: (2×3 + 5×1)/4 = 2.75 → 44.
    expect(rankOptions(c)).toEqual([
      { option: 'PostgreSQL', index: 0, score: 88 },
      { option: 'MongoDB', index: 1, score: 44 },
    ]);
  });
  it('follows changed weights, and ignores a criterion at weight 0', () => {
    expect(rankOptions(c, [0, 3])[0]).toMatchObject({ option: 'MongoDB', score: 100 });
    expect(rankOptions(c, [0, 0]).map((r) => r.score)).toEqual([0, 0]);
  });
});
