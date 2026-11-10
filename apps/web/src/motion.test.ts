import { describe, expect, it } from 'vitest';
import { enterFrom, project, rubberband, spring } from './motion';

/** The physics behind the feel: Apple's rubber-band and momentum projection, and the shared springs. */
describe('motion', () => {
  it('rubber-bands: follows less the further past the edge, never past the dimension, both ways', () => {
    const d = 120;
    const steps = [10, 40, 120, 480, 5000].map((o) => rubberband(o, d));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    // Each extra pixel past the edge moves the element less than the one before.
    expect(rubberband(20, d) - rubberband(10, d)).toBeLessThan(rubberband(10, d));
    expect(steps.at(-1)!).toBeLessThan(d);
    expect(rubberband(-40, d)).toBeCloseTo(-rubberband(40, d));
    expect(rubberband(0, d)).toBe(0);
    expect(rubberband(40, 0)).toBe(0);
  });

  it('projects a flick like scroll deceleration', () => {
    // 1000 px/s at the normal rate comes to rest about 499 px further on; a snappier rate stops sooner.
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(1000, 0.99)).toBeCloseTo(99, 0);
    expect(project(-500)).toBeCloseTo(-249.5, 1);
  });

  it('keeps bounce for momentum only, and skips entrances under reduced motion', () => {
    expect(spring.ui.bounce).toBe(0);
    expect(spring.snappy.bounce).toBe(0);
    expect(spring.momentum.bounce).toBeGreaterThan(0);
    expect(enterFrom(true, { opacity: 0 })).toBe(false);
    expect(enterFrom(false, { opacity: 0 })).toEqual({ opacity: 0 });
  });
});
