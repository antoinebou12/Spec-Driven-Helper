import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { applySpecPatch, diffSpecs, readiness, threeWayMerge, validateSpec } from '../packages/shared/src/domain';
import { completeness } from '../packages/shared/src/completeness';
import { parsePlanTasks, planTasksMarkdown, cardSchema } from '../packages/shared/src/board';
import { readPlanFolder } from '../packages/shared/src/plan-folder';
import { parseBundleText } from '../packages/shared/src/bundle-formats';
import { importSchema, type Spec } from '../packages/shared/src/schema';
import { buildExampleSpec } from '../packages/shared/src/example';
import { implementationFiles } from '../apps/api/src/exports';

/**
 * Performance budgets for the code on every request path (median of repeated runs, on the complete
 * example and the SDD Studio fixture). Budgets are ~10× the measured time on a laptop so CI noise does
 * not fail them, but a regression by an order of magnitude does. The load test (`pnpm perf`) covers HTTP.
 */
function median(run: () => unknown, times = 15) {
  run(); // warm up
  const samples: number[] = [];
  for (let i = 0; i < times; i++) {
    const started = performance.now();
    run();
    samples.push(performance.now() - started);
  }
  return samples.sort((a, b) => a - b)[Math.floor(times / 2)];
}
const folder = (() => {
  const base = join(__dirname, '..', 'fixtures', 'sdd-studio');
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(base, p).split('\\').join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(base);
  return out;
})();
const example: Spec = buildExampleSpec('00000000-0000-4000-8000-0000000000bb');
const answer = (value: string) => ({ sections: [{ id: 'discovery', answers: { 'discovery.1': { value, state: 'answered' as const, reason: '' } } }] });

describe('performance budgets (median ms)', () => {
  const cases: [string, () => unknown, number][] = [
    ['readiness of the complete example', () => readiness(example), 40],
    ['completeness of the complete example', () => completeness(example), 40],
    ['validateSpec', () => validateSpec(example), 40],
    ['applySpecPatch (one answer, Markdown refreshed)', () => applySpecPatch(example, answer('Changed'), 'perf', { canReview: false }), 60],
    ['diffSpecs after one change', () => diffSpecs(example, applySpecPatch(example, answer('Changed'), 'perf', { canReview: false })), 80],
    ['threeWayMerge of two edits', () => threeWayMerge(example, applySpecPatch(example, answer('Mine'), 'a', { canReview: false }), applySpecPatch(example, answer('Theirs'), 'b', { canReview: false })), 120],
    ['implementation bundle (all files)', () => implementationFiles(example), 200],
    ['read the SDD Studio .plan folder', () => readPlanFolder(folder), 150],
    ['decode the TOON bundle', () => parseBundleText(folder['.plan/specification.toon']), 200],
    ['validate the imported bundle', () => importSchema.parse(JSON.parse(folder['.plan/specification.json'])), 80],
  ];
  for (const [name, run, budget] of cases)
    it(`${name} ≤ ${budget} ms`, () => {
      const ms = median(run);
      expect(ms, `${name}: ${ms.toFixed(2)} ms`).toBeLessThan(budget);
    });

  it('parses and writes a 2 000-card tasks.md quickly and linearly', () => {
    const cards = (n: number) => Array.from({ length: n }, (_, i) => cardSchema.parse({ id: `TASK-${i}`, title: `Task ${i}`, column: (['todo', 'doing', 'done'] as const)[i % 3], group: `Gate ${i % 20}` }));
    const small = planTasksMarkdown(cards(200));
    const large = planTasksMarkdown(cards(2000));
    const tSmall = median(() => parsePlanTasks(small));
    const tLarge = median(() => parsePlanTasks(large));
    expect(tLarge, `2 000 cards: ${tLarge.toFixed(2)} ms`).toBeLessThan(150);
    // 10× the input must not cost more than ~25× the time (no quadratic blow-up).
    expect(tLarge / Math.max(tSmall, 0.05)).toBeLessThan(25);
  });
});
