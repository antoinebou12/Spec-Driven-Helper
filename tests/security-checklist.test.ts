import { describe, expect, it } from 'vitest';
import { applySpecPatch, createSpec, isComplete } from '../packages/shared/src/domain';
import { buildExampleSpec } from '../packages/shared/src/example';
import { findQuestion, moduleQuestions, modules } from '../packages/shared/src/templates';
import { formatAnswer, parseAnswer } from '../packages/shared/src/markdown';
import { securityChecklist, securityChecklistMarkdown, securityControls } from '../packages/shared/src/security-checklist';
import { implementationFiles } from '../apps/api/src/exports';

describe('complete example project', () => {
  it('answers every question that applies to it (add an answer when you add a question)', () => {
    const spec = buildExampleSpec('00000000-0000-4000-8000-0000000000c1');
    const missing = modules.flatMap((m) => moduleQuestions(m, spec).filter((q) => !isComplete(spec.sections.find((s) => s.id === m.id)!.answers[q.id])).map((q) => q.id));
    expect(missing).toEqual([]);
  });
});

describe('slider and matrix answers', () => {
  it('round-trip through the managed Markdown in both languages', () => {
    for (const lang of ['en', 'fr'] as const) {
      const slider = findQuestion('quality.11')!;
      expect(parseAnswer(slider, formatAnswer(slider, { value: '99.95', state: 'answered', reason: '' }, lang))?.value).toBe('99.95');
      const matrix = findQuestion('security.14')!;
      const value = JSON.stringify({ 'Personal data': 'Confidential', 'Logs and telemetry': 'Internal' });
      const md = formatAnswer(matrix, { value, state: 'answered', reason: '' }, lang);
      expect(md.split('\n')[0]).toBe(lang === 'fr' ? '| Élément | Choix |' : '| Item | Choice |');
      expect(JSON.parse(parseAnswer(matrix, md)!.value)).toEqual(JSON.parse(value));
    }
  });

  it('reads a decimal comma and ignores the unit when a slider is edited in Markdown', () => {
    const slider = findQuestion('quality.12')!;
    expect(parseAnswer(slider, '0,8 s')?.value).toBe('0.8');
    expect(findQuestion('quality.11')!.range).toEqual({ min: 95, max: 99.99, step: 0.01, unit: { en: '%', fr: '%' } });
  });
});

describe('security completeness checklist', () => {
  it('covers ASVS and SSDF areas with real questions', () => {
    expect(securityControls).toHaveLength(15);
    for (const c of securityControls) for (const id of c.questions) expect(findQuestion(id), `${c.id}: ${id}`).toBeTruthy();
  });

  it('scores the complete example at 100 % and an empty project at 0 %', () => {
    expect(securityChecklist(buildExampleSpec('00000000-0000-4000-8000-0000000000c2')).score).toBe(100);
    const empty = securityChecklist(createSpec('00000000-0000-4000-8000-0000000000c3', 'Empty'));
    expect(empty.score).toBe(0);
    expect(empty.items.find((i) => i.id === 'authentication')?.open).toEqual(['security.3', 'security.12']);
  });

  it('marks partial coverage and honours "not applicable"', () => {
    let spec = createSpec('00000000-0000-4000-8000-0000000000c4', 'Partial');
    spec = applySpecPatch(spec, { sections: [{ id: 'security', answers: { 'security.3': { value: 'OIDC sessions, 8 h', state: 'answered', reason: '' }, 'security.9': { value: '', state: 'not-applicable', reason: 'No AI features' } } }] }, 'test', { canReview: false });
    const items = Object.fromEntries(securityChecklist(spec).items.map((i) => [i.id, i.status]));
    expect(items.authentication).toBe('partial');
    expect(items['ai-misuse']).toBe('not-applicable');
    expect(items['threat-model']).toBe('missing');
  });

  it('is written to the bundle as .plan/security-checklist.md', () => {
    const spec = createSpec('00000000-0000-4000-8000-0000000000c5', 'Bundle', 'fr');
    const md = securityChecklistMarkdown(spec);
    expect(md.startsWith('# Liste de contrôle de sécurité')).toBe(true);
    expect(md).toContain('- [ ] **Authentification et multifacteur** (ASVS V6) — répondre à');
    expect(implementationFiles(spec)['.plan/security-checklist.md']).toBe(md);
  });
});
