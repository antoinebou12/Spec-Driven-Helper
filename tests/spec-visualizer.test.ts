import { describe, it, expect } from 'vitest';
import { createSpec } from '../packages/shared/src/domain';
import { specVisual, specVisualSchema } from '../packages/shared/src/spec-visualizer';
import { itemSchema } from '../packages/shared/src/schema';

describe('specification visualizer', () => {
  it('uses required questions for the current level and localizes the snapshot', () => {
    const spec = createSpec('visualizer', 'New project');
    spec.level = 'essentials';
    const data = specVisual(spec, 0, 'fr');
    expect(data.sections).toHaveLength(14);
    expect(data.sections.reduce((sum, section) => sum + section.total, 0)).toBeLessThan(20);
    expect(data.sections.flatMap((section) => section.missing).length).toBeGreaterThan(0);
    expect(data.ready).toBe(false);
    expect(data.language).toBe('fr');
    expect(specVisualSchema.parse(data)).toEqual(data);
  });
  it('paginates live items and never fabricates relationships or returns unbounded content', () => {
    const spec = createSpec('visualizer', 'Large');
    spec.items = Array.from({ length: 80 }, (_, i) =>
      itemSchema.parse({ id: `REQ-${i}`, title: 'x'.repeat(500), type: 'requirement' }),
    );
    spec.items[0].status = 'superseded';
    spec.links = [{ id: 'link', from: 'REQ-1', to: 'REQ-2', kind: 'depends-on' }];
    const first = specVisual(spec);
    expect(first.items).toHaveLength(24);
    expect(first.total).toBe(79);
    expect(first.nextOffset).toBe(24);
    expect(first.links).toEqual([{ from: 'REQ-1', to: 'REQ-2', kind: 'depends-on' }]);
    expect(first.issues).toHaveLength(24);
    expect(first.issueTotal).toBeGreaterThan(24);
    expect(JSON.stringify(first).length).toBeLessThan(32_000);
    const next = specVisual(spec, first.nextOffset!);
    expect(next.items[0].id).toBe('REQ-25');
    expect(next.links).toEqual([]);
    expect(specVisual(spec, 72).nextOffset).toBeNull();
  });
});
