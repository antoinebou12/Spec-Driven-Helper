import { describe, expect, it } from 'vitest';
import { buildExampleSpec } from '../packages/shared/src/example';
import { createSpec } from '../packages/shared/src/domain';
import { designMarkdown, productMarkdown } from '../packages/shared/src/agent-docs';
import { implementationFiles } from '../apps/api/src/exports';

/** PRODUCT.md and DESIGN.md generated for every project bundle. */
describe('PRODUCT.md and DESIGN.md', () => {
  const spec = buildExampleSpec('00000000-0000-4000-8000-0000000000aa');

  it('PRODUCT.md covers problem, scope, users, requirements with acceptance, use cases and quality', () => {
    const md = productMarkdown(spec);
    expect(md.startsWith('# Customer Request Portal — Product')).toBe(true);
    for (const h of ['Problem, goals and stakeholders', 'Scope and non-goals', 'Users and workflows', 'Requirements', 'Use cases', 'Quality attributes', 'Release and governance']) expect(md, h).toContain(`\n## ${h}\n`);
    for (const r of spec.items.filter((i) => i.type === 'requirement')) expect(md, r.id).toContain(`| ${r.id} |`);
    expect(md).not.toContain('sdd:answer');
    expect(md.match(/^# /gm)).toHaveLength(1);
  });

  it('DESIGN.md follows the Google design-document sections and lists every decision', () => {
    const md = designMarkdown(spec);
    const sections = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(sections).toEqual(['Context and scope', 'Goals and non-goals', 'Design overview', 'Data & APIs', 'Alternatives considered (decisions)', 'Cross-cutting concerns', 'Risks', 'Visual design system (for UI agents)', 'Open questions']);
    for (const d of spec.items.filter((i) => i.type === 'decision')) expect(md, d.id).toContain(`### ${d.id}: ${d.title}`);
    expect(md.match(/^# /gm)).toHaveLength(1);
  });

  it('says so when content is missing, in the document language', () => {
    const empty = createSpec('00000000-0000-4000-8000-0000000000ab', 'Vide', 'fr');
    expect(productMarkdown(empty)).toContain('_Pas encore consigné._');
    expect(designMarkdown(empty)).toContain('## Questions ouvertes');
  });

  it('ships in the implementation bundle next to AGENTS.md', () => {
    const files = implementationFiles(spec);
    expect(files['spec.md']).toContain(spec.name);
    expect(files['spec.md']).toContain('```mermaid');
    expect(files['PRODUCT.md']).toBe(productMarkdown(spec));
    expect(files['DESIGN.md']).toBe(designMarkdown(spec));
    expect(JSON.parse(files['.plan/manifest.json']).files.map((f: { path: string }) => f.path)).toEqual(expect.arrayContaining(['PRODUCT.md', 'DESIGN.md']));
  });
});
