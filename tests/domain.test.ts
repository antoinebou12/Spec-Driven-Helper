import { describe, it, expect } from 'vitest';
import {
  createSpec,
  applySpecPatch,
  preserveReviewAuthority,
  readiness,
  validateSpec,
  threeWayMerge,
  patchConflicts,
  diffSpecs,
  nextItemId,
  can,
} from '../packages/shared/src/domain';
import { generatedUISchema, importSchema, type Item, type Spec } from '../packages/shared/src/schema';
import {
  modules,
  applicableQuestions,
  findQuestion,
  projectTypes,
} from '../packages/shared/src/templates';
import {
  refreshSectionMarkdown,
  impliedAnswerChanges,
  renderSection,
} from '../packages/shared/src/markdown';
import { validateGeneratedForm } from '../packages/shared/src/generated';
import { implementationZip, serialize, bundle } from '../apps/api/src/exports';
import JSZip from 'jszip';

const answered = (value = 'Evidence') => ({ value, state: 'answered' as const, reason: '' });
const item = (id: string, type: Item['type'], extra: Partial<Item> = {}): Item => ({
  id,
  type,
  title: id,
  body: '',
  status: 'accepted',
  acceptance: '',
  owner: '',
  needsReview: false,
  ...extra,
});
/** A specification that satisfies every readiness rule for its project type. */
function readySpec(projectType = 'Web application'): Spec {
  const s = createSpec(crypto.randomUUID(), 'Ready', 'en', false, projectType);
  for (const section of s.sections) {
    section.status = 'reviewed';
    const m = modules.find((m) => m.id === section.id)!;
    section.answers = Object.fromEntries(
      applicableQuestions(m, projectType)
        .filter((q) => q.required)
        .map((q) => [q.id, answered()]),
    );
  }
  s.items = [
    item('REQ-001', 'requirement', { acceptance: 'Responds within 2 seconds' }),
    item('TEST-001', 'test'),
  ];
  s.links = [{ id: 'LINK-001', from: 'TEST-001', to: 'REQ-001', kind: 'tests' }];
  return s;
}

describe('template library', () => {
  it('has 14 modules with unique, stable question identifiers', () => {
    expect(modules).toHaveLength(14);
    const ids = modules.flatMap((m) => m.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    // Identifiers are part of stored data; these must never change meaning.
    expect(findQuestion('discovery.1')!.label.en).toBe('Problem to solve');
    expect(findQuestion('scope.3')!.kind).toBe('requirements');
    expect(findQuestion('governance.1')!.kind).toBe('raci');
    expect(findQuestion('governance.7')!.label.en).toBe('Coding-agent instructions');
  });
  it('provides bilingual guidance, examples, references and diagrams for every module', () => {
    for (const m of modules) {
      expect(m.references.length, m.id).toBeGreaterThan(0);
      expect(m.references.every((r) => r.url.startsWith('https://')), m.id).toBe(true);
      expect(m.diagrams.length, m.id).toBeGreaterThan(0);
      expect(m.guidance.en && m.guidance.fr, m.id).toBeTruthy();
      for (const q of m.questions)
        for (const field of ['label', 'prompt', 'explain', 'hint', 'example'] as const) {
          expect(q[field].en.trim(), `${q.id}.${field}.en`).not.toBe('');
          expect(q[field].fr.trim(), `${q.id}.${field}.fr`).not.toBe('');
          expect(q[field].fr, `${q.id}.${field} is untranslated`).not.toBe(q[field].en);
        }
      expect(m.questions.some((q) => q.required), m.id).toBe(true);
    }
  });
  it('adapts questions and readiness to the project type', () => {
    const design = modules.find((m) => m.id === 'design')!;
    const web = applicableQuestions(design, 'Web application').map((q) => q.id);
    const api = applicableQuestions(design, 'API / service').map((q) => q.id);
    expect(web).toContain('design.1');
    expect(web).not.toContain('design.8');
    expect(api).toEqual(['design.8']);
    const totals = projectTypes.map(
      (type) => readiness(createSpec(crypto.randomUUID(), 'x', 'en', false, type)).total,
    );
    expect(new Set(totals).size).toBeGreaterThan(1);
    for (const type of projectTypes)
      for (const m of modules)
        expect(applicableQuestions(m, type).length, `${m.id}/${type}`).toBeGreaterThan(0);
  });
});

describe('specification invariants', () => {
  it('round-trips bilingual structured answers and custom Markdown', () => {
    const s = createSpec(crypto.randomUUID(), 'Équipe', 'fr');
    s.sections[0].answers['discovery.1'] = answered('Une réponse précise');
    s.sections[0].markdown = '# Personnalisé\n\nTexte libre';
    s.items = [item('REQ-001', 'requirement', { priority: 'must' })];
    expect(importSchema.parse(JSON.parse(serialize(s, 'json'))).spec).toEqual(s);
    expect(validateSpec(s)).toEqual(s);
  });
  it('merges partial section patches without touching other answers', () => {
    const s = createSpec(crypto.randomUUID(), 'Test');
    s.sections[0].answers['discovery.2'] = answered('Existing goal');
    const next = applySpecPatch(
      s,
      { sections: [{ id: 'discovery', answers: { 'discovery.1': answered('New') } }] },
      'editor',
    );
    expect(next.sections[0].answers['discovery.2'].value).toBe('Existing goal');
    expect(next.sections[0].answers['discovery.1'].value).toBe('New');
    expect(next.sections[1]).toEqual(s.sections[1]);
    expect(next.revision).toBe(1);
    expect(s.revision).toBe(0);
  });
  it('invalidates downstream reviews when an upstream answer changes', () => {
    const s = createSpec(crypto.randomUUID(), 'Test');
    s.sections.forEach((x) => (x.status = 'reviewed'));
    const next = applySpecPatch(
      s,
      { sections: [{ id: 'discovery', answers: { 'discovery.1': answered('Changed') } }] },
      'editor',
    );
    expect(next.sections[0].status).toBe('draft');
    expect(next.sections.find((x) => x.id === 'architecture')!.status).toBe('needs-review');
    expect(next.sections.find((x) => x.id === 'operations')!.status).toBe('needs-review');
  });
  it('flags traceability items downstream of a changed item', () => {
    const s = readySpec();
    s.items.push(item('CMP-001', 'component'), item('ADR-001', 'decision'));
    s.links.push(
      { id: 'LINK-002', from: 'CMP-001', to: 'REQ-001', kind: 'implements' },
      { id: 'LINK-003', from: 'ADR-001', to: 'CMP-001', kind: 'decides' },
    );
    const changed = applySpecPatch(
      s,
      { items: [{ ...s.items[0], acceptance: 'Responds within 1 second' }] },
      'editor',
      { canReview: true },
    );
    const flag = (id: string) => changed.items.find((i) => i.id === id)!.needsReview;
    expect(flag('TEST-001')).toBe(true);
    expect(flag('CMP-001')).toBe(true);
    expect(flag('ADR-001')).toBe(false);
    expect(readiness(changed).ready).toBe(false);
    // Editing the flagged item does not clear the flag; only review does.
    const edited = applySpecPatch(
      changed,
      { items: [{ ...changed.items.find((i) => i.id === 'TEST-001')!, needsReview: false }] },
      'editor',
    );
    expect(edited.items.find((i) => i.id === 'TEST-001')!.needsReview).toBe(true);
  });
  it('does not let editors accept decisions or requirements', () => {
    const s = createSpec(crypto.randomUUID(), 'Test');
    const byEditor = applySpecPatch(s, { items: [item('ADR-001', 'decision')] }, 'editor');
    expect(byEditor.items[0].status).toBe('draft');
    const byReviewer = applySpecPatch(s, { items: [item('ADR-001', 'decision')] }, 'reviewer', {
      canReview: true,
    });
    expect(byReviewer.items[0].status).toBe('accepted');
  });
  it('removes items together with their links', () => {
    const s = readySpec();
    const next = applySpecPatch(s, { removeItems: ['TEST-001'] }, 'editor');
    expect(next.items.map((i) => i.id)).toEqual(['REQ-001']);
    expect(next.links).toEqual([]);
  });
  it('does not turn generated text into readiness', () => {
    const s = createSpec(crypto.randomUUID(), 'Test', 'en', true);
    expect(s.sections[0].markdown).toContain('Example');
    expect(readiness(s).percent).toBe(0);
    expect(readiness(s).ready).toBe(false);
  });
  it('requires acceptance criteria, linked tests and resolved contradictions for readiness', () => {
    const s = readySpec();
    expect(readiness(s).ready).toBe(true);
    const untested = structuredClone(s);
    untested.links = [];
    expect(readiness(untested).blockers).toContain('REQ-001: acceptance criteria or linked test missing');
    const contradicted = structuredClone(s);
    contradicted.items.push(item('REQ-002', 'requirement', { acceptance: '1 second' }));
    contradicted.links.push(
      { id: 'LINK-002', from: 'TEST-001', to: 'REQ-002', kind: 'tests' },
      { id: 'LINK-003', from: 'REQ-001', to: 'REQ-002', kind: 'contradicts' },
    );
    expect(readiness(contradicted).ready).toBe(false);
    contradicted.items[2].status = 'superseded';
    expect(readiness(contradicted).ready).toBe(true);
    expect(readiness(s, { openConflicts: 1 }).ready).toBe(false);
    const vague = structuredClone(s);
    vague.items[0].acceptance = 'Works well';
    expect(readiness(vague).ready).toBe(true);
    expect(readiness(vague).warnings.join()).toContain('may not be measurable');
  });
  it('prevents imported section states from bypassing review', () => {
    const s = createSpec(crypto.randomUUID(), 'Test');
    const sections = structuredClone(s.sections);
    sections[0].status = 'reviewed';
    sections[0].markdown = 'Unreviewed change';
    expect(preserveReviewAuthority(s, { sections }).sections![0].status).toBe('draft');
    const reviewed = structuredClone(s);
    reviewed.sections.forEach((x) => (x.status = 'reviewed'));
    const next = applySpecPatch(
      reviewed,
      { sections: [{ id: 'scope', markdown: 'Changed', status: 'reviewed' }] },
      'editor',
    );
    expect(next.sections.find((x) => x.id === 'scope')!.status).toBe('draft');
  });
  it('rejects duplicate sections, unknown questions and dangling links', () => {
    const s = createSpec(crypto.randomUUID(), 'Test');
    s.sections[1] = s.sections[0];
    expect(() => validateSpec(s)).toThrow();
    const wrongSection = createSpec(crypto.randomUUID(), 'Test');
    wrongSection.sections[0].answers['scope.1'] = answered();
    expect(() => validateSpec(wrongSection)).toThrow(/Unknown question/);
    const other = createSpec(crypto.randomUUID(), 'Test');
    other.links = [{ id: 'x', from: 'missing', to: 'also-missing', kind: 'tests' }];
    expect(() => validateSpec(other)).toThrow();
  });
  it('allocates typed stable identifiers', () => {
    const s = readySpec();
    expect(nextItemId(s, 'requirement')).toBe('REQ-002');
    expect(nextItemId(s, 'decision')).toBe('ADR-001');
  });
  it('separates editing and reviewing roles', () => {
    expect(can('Viewer', 'edit')).toBe(false);
    expect(can('Editor', 'review')).toBe(false);
    expect(can('Reviewer', 'edit')).toBe(false);
    expect(can('Reviewer', 'review')).toBe(true);
  });
});

describe('conflicts and merging', () => {
  it('detects only overlapping stale writes', () => {
    const base = createSpec(crypto.randomUUID(), 'Test');
    const current = applySpecPatch(
      base,
      { sections: [{ id: 'discovery', answers: { 'discovery.1': answered('Theirs') } }] },
      'other',
    );
    expect(
      patchConflicts(base, current, {
        sections: [{ id: 'discovery', answers: { 'discovery.2': answered('Mine') } }],
      }),
    ).toEqual([]);
    const conflicts = patchConflicts(base, current, {
      sections: [{ id: 'discovery', answers: { 'discovery.1': answered('Mine') } }],
    });
    expect(conflicts.map((c) => c.path)).toEqual(['sections.discovery.answers.discovery.1']);
    expect((conflicts[0].current as any).value).toBe('Theirs');
  });
  it('summarizes changes by path', () => {
    const s = createSpec(crypto.randomUUID(), 'Test');
    const next = applySpecPatch(
      s,
      { description: 'New', items: [item('REQ-001', 'requirement')] },
      'editor',
    );
    expect(diffSpecs(s, next).map((c) => `${c.kind}:${c.path}`)).toEqual([
      'changed:description',
      'added:items.REQ-001',
    ]);
  });
  it('merges non-overlapping external edits and preserves both sides of conflicts', () => {
    const base = createSpec(crypto.randomUUID(), 'Test');
    const local = structuredClone(base),
      remote = structuredClone(base);
    local.sections[0].markdown = 'Local';
    remote.sections[0].markdown = 'Remote';
    remote.sections[1].markdown = 'Remote scope';
    remote.items = [item('REQ-001', 'requirement')];
    const result = threeWayMerge(base, local, remote);
    expect(result.conflicts.map((c) => c.path)).toEqual(['sections.discovery.markdown']);
    expect(result.conflicts[0].current).toBe('Local');
    expect(result.conflicts[0].yours).toBe('Remote');
    expect(result.patch.sections).toEqual([{ id: 'scope', markdown: 'Remote scope' }]);
    expect(result.patch.items?.map((i) => i.id)).toEqual(['REQ-001']);
  });
});

describe('Markdown and structured answers', () => {
  const discovery = modules.find((m) => m.id === 'discovery')!;
  it('regenerates answer blocks while preserving free text', () => {
    const answers = { 'discovery.1': answered('Old problem') };
    const initial = renderSection(discovery, { answers }, 'en', 'Web application');
    const withNotes = initial.replace('# Business & discovery', '# Business & discovery\n\nAuthor notes stay.');
    const refreshed = refreshSectionMarkdown(
      discovery,
      { answers: { 'discovery.1': answered('New problem') }, markdown: withNotes },
      'en',
      'Web application',
    );
    expect(refreshed).toContain('Author notes stay.');
    expect(refreshed).toContain('New problem');
    expect(refreshed).not.toContain('Old problem');
  });
  it('detects structured changes implied by Markdown edits, including tables and states', () => {
    const answers = {
      'discovery.1': answered('Original'),
      'discovery.3': answered(JSON.stringify([['Sponsor', 'Funding', 'Approves budget']])),
    };
    const markdown = renderSection(discovery, { answers }, 'en', 'Web application');
    expect(impliedAnswerChanges(discovery, answers, markdown, 'en')).toEqual({});
    const edited = markdown
      .replace('Original', 'Edited in Markdown')
      .replace('Approves budget', 'Approves scope')
      .replace(
        '<!-- sdd:answer discovery.6 -->\n_Not answered yet._',
        '<!-- sdd:answer discovery.6 -->\n_Not applicable: Internal tool without revenue_',
      );
    const implied = impliedAnswerChanges(discovery, answers, edited, 'en');
    expect(implied['discovery.1'].value).toBe('Edited in Markdown');
    expect(JSON.parse(implied['discovery.3'].value)).toEqual([['Sponsor', 'Funding', 'Approves scope']]);
    expect(implied['discovery.6']).toEqual({
      state: 'not-applicable',
      value: '',
      reason: 'Internal tool without revenue',
    });
  });
});

describe('generated interface validation', () => {
  it('rejects executable properties and unknown generated controls', () => {
    expect(
      generatedUISchema.safeParse({ kind: 'text', questionId: 'a', label: 'Safe', onClick: 'alert(1)' })
        .success,
    ).toBe(false);
    expect(generatedUISchema.safeParse({ kind: 'script', questionId: 'a', label: 'Bad' }).success).toBe(
      false,
    );
  });
  it('binds controls to applicable template questions', () => {
    const ok = validateGeneratedForm(
      [
        { kind: 'choice', questionId: 'quality.3', label: 'Availability', options: ['99.5%', '99.9%'] },
        { kind: 'raci', questionId: 'governance.1', label: 'RACI' },
        { kind: 'diagram', questionId: 'data', label: 'Entities', code: 'erDiagram\n  A ||--o{ B : has' },
      ],
      'Web application',
    );
    expect(ok.ok).toBe(true);
    for (const bad of [
      { kind: 'text', questionId: 'nope.1', label: 'Unknown' },
      { kind: 'text', questionId: 'governance.1', label: 'RACI as text' },
      { kind: 'text', questionId: 'design.1', label: 'Not for APIs' },
      { kind: 'diagram', questionId: 'data', label: 'x', code: '%%{init: {"securityLevel":"loose"}}%%\ngraph TD' },
      { kind: 'diagram', questionId: 'data', label: 'x', code: 'graph TD\n  A-->B\n  click A call alert()' },
    ])
      expect(validateGeneratedForm(bad, 'API / service').ok, JSON.stringify(bad)).toBe(false);
  });
});

describe('exports', () => {
  it('exports safe serializers and complete .plan records', async () => {
    const spec = createSpec(crypto.randomUUID(), 'A < B & C');
    expect(serialize(spec, 'xml')).toContain('A &lt; B &amp; C');
    expect(serialize(spec, 'latex')).toContain('A \\textless{} B \\& C');
    expect(serialize(spec, 'html')).toContain('A &lt; B &amp; C');
    expect(serialize(spec, 'toon')).toContain('sdd-studio');
    const zip = await JSZip.loadAsync(await implementationZip(spec));
    for (const file of [
      '.plan/README.md',
      '.plan/plan.md',
      '.plan/tasks.md',
      '.plan/backlog.md',
      '.plan/designs.md',
      '.plan/changes.md',
      '.plan/manifest.json',
      'AGENTS.md',
      'CLAUDE.md',
      '.github/copilot-instructions.md',
      '.claude/skills/maintain-spec/SKILL.md',
    ])
      expect(zip.file(file), file).not.toBeNull();
    expect(JSON.parse(await zip.file('.plan/specification.json')!.async('string'))).toEqual(bundle(spec));
  });
});
