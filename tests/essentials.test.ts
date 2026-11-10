import { describe, expect, it } from 'vitest';
import {
  applySpecPatch,
  createSpec,
  readiness,
  sectionNeedsReview,
} from '../packages/shared/src/domain';
import { completeness } from '../packages/shared/src/completeness';
import {
  essentialCount,
  essentialIdsFor,
  essentialQuestionIds,
  isEssential,
  levelHelp,
  levelLabels,
  specLevels,
} from '../packages/shared/src/essentials';
import { emptyMemory, interviewStep } from '../packages/shared/src/interview';
import { buildExampleSpec } from '../packages/shared/src/example';
import {
  appliesTo,
  findQuestion,
  moduleQuestions,
  modules,
  projectTypes,
} from '../packages/shared/src/templates';
import { specSchema, type Spec } from '../packages/shared/src/schema';

/**
 * The essentials level: 15 required questions instead of 60, so a correct specification (and the
 * automatic task plan that follows it) is quick to reach. Nothing is deleted; "complete" requires it all again.
 */
const blank = (level: Spec['level'], projectType = 'Web application') => ({
  ...createSpec('00000000-0000-4000-8000-0000000000b1', 'Minimal', 'en', false, projectType),
  level,
});
const required = (spec: Spec) =>
  modules.flatMap((m) => moduleQuestions(m, spec).filter((q) => q.required)).map((q) => q.id);
const answered = (spec: Spec, ids: readonly string[]) => {
  for (const id of ids)
    spec.sections.find((s) => s.id === id.split('.')[0])!.answers[id] = {
      value: `Answer to ${id}`,
      state: 'answered',
      reason: '',
    };
};
/** A specification that is correct at the essentials level: the 15 answers, the sections that hold one reviewed, one tested requirement. */
const correct = (projectType = 'Web application') => {
  const spec = blank('essentials', projectType);
  answered(spec, essentialIdsFor(projectType));
  for (const s of spec.sections) if (sectionNeedsReview(spec, s.id)) s.status = 'reviewed';
  spec.items = [
    {
      id: 'REQ-001',
      type: 'requirement',
      title: 'Sign in',
      body: '',
      status: 'accepted',
      acceptance: 'Within 2 seconds',
      owner: '',
      needsReview: false,
    },
    {
      id: 'TEST-001',
      type: 'test',
      title: 'Sign-in test',
      body: '',
      status: 'accepted',
      acceptance: '',
      owner: '',
      needsReview: false,
    },
  ];
  spec.links = [{ id: 'LINK-1', from: 'TEST-001', to: 'REQ-001', kind: 'tests' }];
  return spec;
};

describe('the essential questions', () => {
  it('are 15 questions that exist, are required at the complete level and are written in both languages', () => {
    expect(essentialQuestionIds).toHaveLength(15);
    expect(new Set(essentialQuestionIds).size).toBe(15);
    const all = required(blank('complete'));
    for (const id of essentialQuestionIds) {
      const q = findQuestion(id);
      expect(q, id).toBeTruthy();
      expect(all, `${id} is required at the complete level`).toContain(id);
      for (const language of ['en', 'fr'] as const)
        expect(q!.label[language].trim(), `${id} ${language}`).not.toBe('');
      expect(isEssential(id)).toBe(true);
    }
    expect(isEssential('quality.1')).toBe(false);
    for (const level of specLevels)
      for (const language of ['en', 'fr'] as const) {
        expect(levelLabels[level][language]).toBeTruthy();
        expect(levelHelp(level, language)).toBeTruthy();
      }
    expect(levelHelp('essentials', 'en', 'Mobile application')).toContain('16 core questions');
    expect(levelHelp('essentials', 'fr', 'Library / SDK')).toContain('15 questions essentielles');
  });

  it('cover nine modules, so the other five need no review at this level', () => {
    const spec = blank('essentials');
    expect(new Set(essentialQuestionIds.map((id) => id.split('.')[0]))).toEqual(
      new Set([
        'discovery',
        'scope',
        'workflows',
        'architecture',
        'data',
        'security',
        'technology',
        'testing',
        'delivery',
      ]),
    );
    expect(modules.filter((m) => !sectionNeedsReview(spec, m.id)).map((m) => m.id)).toEqual([
      'quality',
      'design',
      'conventions',
      'operations',
      'governance',
    ]);
    expect(modules.every((m) => sectionNeedsReview(blank('complete'), m.id))).toBe(true);
  });
});

/** The questions in the order the interview asks them: module order, then number. */
const inModuleOrder = (ids: readonly string[]) =>
  ids
    .slice()
    .sort(
      (a, b) =>
        modules.findIndex((m) => m.id === a.split('.')[0]) -
          modules.findIndex((m) => m.id === b.split('.')[0]) ||
        Number(a.split('.')[1]) - Number(b.split('.')[1]),
    );

describe('the essentials of each project type', () => {
  const baseModules = new Set(essentialQuestionIds.map((id) => id.split('.')[0]));

  it('are real, applicable, required questions of that type, near fifteen, in the same nine modules', () => {
    for (const type of projectTypes) {
      const ids = essentialIdsFor(type);
      expect(new Set(ids).size, type).toBe(ids.length);
      expect(ids.length, type).toBeGreaterThanOrEqual(14);
      expect(ids.length, type).toBeLessThanOrEqual(17);
      expect(essentialCount(type)).toBe(ids.length);
      expect(new Set(ids.map((id) => id.split('.')[0])), type).toEqual(baseModules);
      for (const id of ids) {
        const q = findQuestion(id);
        expect(q, `${type} ${id}`).toBeTruthy();
        expect(appliesTo(q!, type), `${id} applies to ${type}`).toBe(true);
        // Essentials are a subset of what the complete level requires, never more.
        expect(q!.required, `${id} is required at the complete level`).toBe(true);
        expect(isEssential(id, type)).toBe(true);
      }
    }
  });

  it('are the base list for a web application and an API, and fit a library, a device and the rest', () => {
    expect(essentialIdsFor('Web application')).toEqual(essentialQuestionIds);
    expect(essentialIdsFor('API / service')).toEqual(essentialQuestionIds);
    expect(essentialIdsFor('Something else')).toEqual(essentialQuestionIds);
    const library = essentialIdsFor('Library / SDK');
    expect(library).not.toContain('security.3');
    expect(library).not.toContain('delivery.1');
    expect(library).toEqual(expect.arrayContaining(['data.9', 'delivery.8']));
    expect(essentialIdsFor('Embedded / IoT')).not.toContain('security.3');
    expect(essentialIdsFor('Embedded / IoT')).toEqual(
      expect.arrayContaining(['testing.9', 'delivery.8']),
    );
    expect(essentialIdsFor('Mobile application')).toContain('delivery.8');
    expect(essentialIdsFor('Desktop application')).toContain('delivery.8');
    expect(essentialIdsFor('Data / AI system')).toContain('testing.10');
    expect(isEssential('security.3')).toBe(true);
    expect(isEssential('security.3', 'Library / SDK')).toBe(false);
    expect(isEssential('data.9')).toBe(false);
  });

  it('are exactly what each type requires at the essentials level, with the same nine reviews', () => {
    for (const type of projectTypes) {
      const spec = blank('essentials', type);
      expect(required(spec).sort(), type).toEqual([...essentialIdsFor(type)].sort());
      const r = readiness(spec);
      expect(r.total, type).toBe(essentialCount(type));
      expect(
        r.issues.filter((i) => i.code === 'section-unreviewed'),
        type,
      ).toHaveLength(9);
    }
  });

  it('let a library, a device and a model reach a correct specification with their own answers', () => {
    for (const type of [
      'Library / SDK',
      'Embedded / IoT',
      'Mobile application',
      'Data / AI system',
    ]) {
      const r = readiness(correct(type));
      expect(r.blockers, type).toEqual([]);
      expect(r.ready, type).toBe(true);
      // Without the questions the type added to the base list, it is not ready.
      const missing = correct(type);
      for (const id of essentialIdsFor(type).filter(
        (id) => !(essentialQuestionIds as readonly string[]).includes(id),
      ))
        delete missing.sections.find((s) => s.id === id.split('.')[0])!.answers[id];
      expect(readiness(missing).ready, `${type} still owes its own questions`).toBe(false);
    }
  });

  it('are what the interview asks first for a library, in module order', () => {
    const spec = blank('essentials', 'Library / SDK');
    const asked: string[] = [];
    for (let i = 0; i < 30; i++) {
      const step = interviewStep(spec, emptyMemory());
      if (!step.question || !step.counts.requiredLeft) break;
      asked.push(step.question.id);
      answered(spec, [step.question.id]);
    }
    expect(asked).toEqual(inModuleOrder(essentialIdsFor('Library / SDK')));
    expect(asked).not.toContain('security.3');
  });
});

describe('questions at each level', () => {
  it('require 15 answers at the essentials level and 60 at the complete level, with the same questions in both', () => {
    expect(required(blank('essentials')).sort()).toEqual([...essentialQuestionIds].sort());
    expect(required(blank('complete'))).toHaveLength(60);
    const ids = (spec: Spec) => modules.flatMap((m) => moduleQuestions(m, spec).map((q) => q.id));
    expect(ids(blank('essentials'))).toEqual(ids(blank('complete')));
  });

  it('leave a custom question as its author set it', () => {
    const spec = blank('essentials');
    spec.customQuestions = [
      {
        id: 'security.c-pen',
        moduleId: 'security',
        label: { en: 'Pen test', fr: 'Test d’intrusion' },
        prompt: { en: 'Pen test?', fr: 'Test ?' },
        explain: { en: 'x', fr: 'x' },
        kind: 'text',
        required: true,
        origin: 'manual',
      },
    ];
    expect(required(spec)).toContain('security.c-pen');
    expect(required(spec)).toHaveLength(16);
  });

  it('read an older document without a level as complete', () => {
    const { level: _level, ...old } = buildExampleSpec('00000000-0000-4000-8000-0000000000b2');
    expect(specSchema.parse(old).level).toBe('complete');
    expect(buildExampleSpec('00000000-0000-4000-8000-0000000000b3').level).toBe('complete');
  });
});

describe('readiness at the essentials level', () => {
  it('blocks on the 15 answers and only the nine sections that hold one', () => {
    const r = readiness(blank('essentials'));
    expect(r.total).toBe(15);
    expect(r.issues.filter((i) => i.code === 'section-unreviewed').map((i) => i.target)).toEqual([
      'discovery',
      'scope',
      'workflows',
      'architecture',
      'data',
      'security',
      'technology',
      'testing',
      'delivery',
    ]);
    expect(r.issues.find((i) => i.code === 'required-missing')?.count).toBe(15);
  });

  it('is ready with the 15 answers, nine reviews, and a tested requirement', () => {
    const r = readiness(correct());
    expect(r.blockers).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.percent).toBe(100);
    expect(completeness(correct()).parts).toMatchObject({ required: 100, reviewed: 100 });
  });

  it('is not enough at the complete level: the same specification then lacks 45 answers and five reviews', () => {
    const spec = { ...correct(), level: 'complete' as const };
    const r = readiness(spec);
    expect(r.ready).toBe(false);
    expect(r.issues.find((i) => i.code === 'required-missing')?.count).toBe(45);
    expect(r.issues.filter((i) => i.code === 'section-unreviewed')).toHaveLength(5);
  });

  it('still asks for what the task plan needs: a requirement with acceptance criteria and a test', () => {
    const spec = correct();
    spec.items = [];
    spec.links = [];
    expect(readiness(spec).issues.map((i) => i.code)).toEqual(['no-requirements']);
    spec.items = correct().items.slice(0, 1);
    expect(readiness(spec).issues.map((i) => i.code)).toEqual(['requirement-untested']);
  });

  it('keeps answers given outside the essentials: they count as optional, and unknown ones still block', () => {
    const spec = correct();
    answered(spec, ['quality.1']);
    expect(readiness(spec).ready).toBe(true);
    expect(completeness(spec).parts.optional).toBeGreaterThan(0);
    spec.sections.find((s) => s.id === 'quality')!.answers['quality.2'] = {
      value: '',
      state: 'unknown',
      reason: '',
    };
    expect(readiness(spec).blockers.some((b) => /unknown/i.test(b))).toBe(true);
  });
});

describe('the interview at the essentials level', () => {
  it('asks the 15 essentials first, in module order, then offers the rest as optional', () => {
    const spec = blank('essentials');
    const asked: string[] = [];
    for (let i = 0; i < 30; i++) {
      const step = interviewStep(spec, emptyMemory());
      if (!step.question || !step.counts.requiredLeft) break;
      asked.push(step.question.id);
      answered(spec, [step.question.id]);
    }
    expect(asked).toEqual(inModuleOrder(essentialQuestionIds));
    const done = interviewStep(spec, emptyMemory());
    expect(done.counts.requiredLeft).toBe(0);
    // Everything not answered is now optional: the 45 questions that were required plus those that never were.
    expect(done.counts.optionalLeft).toBe(
      modules.flatMap((m) => moduleQuestions(m, spec)).length - essentialQuestionIds.length,
    );
    expect(done.wrapUp).toBe('optional');
  });
});

describe('changing the level', () => {
  it('is a patch that changes nothing else, and going to complete adds requirements without losing an answer', () => {
    const spec = correct();
    const complete = applySpecPatch(spec, { level: 'complete' }, 'someone');
    expect(complete.level).toBe('complete');
    expect(complete.revision).toBe(spec.revision + 1);
    expect(complete.sections.map((s) => s.answers)).toEqual(spec.sections.map((s) => s.answers));
    expect(readiness(complete).ready).toBe(false);
    expect(applySpecPatch(complete, { level: 'essentials' }, 'someone').level).toBe('essentials');
    expect(applySpecPatch(spec, { description: 'x' }, 'someone').level).toBe('essentials');
  });
});
