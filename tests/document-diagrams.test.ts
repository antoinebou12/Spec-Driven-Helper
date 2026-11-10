import { describe, expect, it } from 'vitest';
import { sectionEvidenceDiagram } from '../packages/shared/src/document-diagrams';
import { buildExampleSpec } from '../packages/shared/src/example';
import { productMarkdown, designMarkdown } from '../packages/shared/src/agent-docs';

describe('document evidence diagrams', () => {
  it('uses only recorded answers and deterministic grouping links', () => {
    const spec = buildExampleSpec('00000000-0000-4000-8000-000000000001');
    const first = sectionEvidenceDiagram(spec, 'discovery')!;
    expect(first).toContain('flowchart TB');
    expect(first).toContain('Business');
    expect(first).not.toContain('-->');
    expect(sectionEvidenceDiagram(spec, 'discovery')).toBe(first);
    spec.sections[0].answers = {};
    expect(sectionEvidenceDiagram(spec, 'discovery')).toBeNull();
    expect(sectionEvidenceDiagram(spec, 'missing')).toBeNull();
  });
  it('escapes diagram syntax, uses document language and exports accepted diagrams', () => {
    const spec = buildExampleSpec('00000000-0000-4000-8000-000000000002');
    spec.language = 'fr';
    spec.sections[0].answers['discovery.1'] = {
      state: 'answered',
      value: '"]\nclick x "https://bad" <script> &',
      reason: '',
    };
    const code = sectionEvidenceDiagram(spec, 'discovery')!;
    expect(code).not.toContain('<script>');
    expect(code).not.toContain('\nclick');
    expect(code).toContain('Métier');
    spec.sections[0].diagram = code;
    expect(productMarkdown(spec)).toContain(code);
    spec.sections.find((s) => s.id === 'architecture')!.diagram = 'flowchart LR\n A --> B';
    expect(designMarkdown(spec)).toContain('A --> B');
  });
});
