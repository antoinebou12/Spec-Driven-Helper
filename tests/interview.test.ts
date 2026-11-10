import { describe, expect, it } from 'vitest';
import { createSpec } from '../packages/shared/src/domain';
import { buildExampleSpec } from '../packages/shared/src/example';
import {
  answerSummary,
  emptyMemory,
  interviewCopy,
  interviewStep,
  isNextCommand,
  normalizeMemory,
  parseChoiceResult,
  parseInterviewResult,
  sectionProgress,
  type InterviewMemory,
} from '../packages/shared/src/interview';
import { modules, moduleQuestions, type Question } from '../packages/shared/src/templates';
import type { Spec } from '../packages/shared/src/schema';

/**
 * The guided interview: which question comes next, how answers read back, what a card returns, and
 * the assistant's lines in both languages. All of it is deterministic and needs no model.
 */
const fresh = () => createSpec('00000000-0000-4000-8000-0000000000d1', 'Fresh', 'en', false, 'Web application');
const complete = () => buildExampleSpec('00000000-0000-4000-8000-0000000000d2');
const memory = (patch: Partial<InterviewMemory> = {}): InterviewMemory => ({ ...emptyMemory(), ...patch });
const allQuestions = (spec: Spec) => modules.flatMap((m) => moduleQuestions(m, spec).map((q) => ({ q, m })));
const clear = (spec: Spec, id: string) => delete spec.sections.find((s) => s.id === id.split('.')[0])!.answers[id];

describe('interview order', () => {
  it('asks required questions in module order, starting with the first', () => {
    const step = interviewStep(fresh(), memory());
    expect(step.question!.id).toBe('discovery.1');
    expect(step.section!.id).toBe('discovery');
    expect(step.wrapUp).toBeUndefined();
    expect(step.counts.requiredLeft).toBeGreaterThan(20);
  });

  it('continues in the section the person is in, then returns to the others', () => {
    const step = interviewStep(fresh(), memory(), 'security');
    expect(step.section!.id).toBe('security');
    expect(step.question!.id.startsWith('security.')).toBe(true);
    expect(interviewStep(fresh(), memory(), 'no-such-section').question!.id).toBe('discovery.1');
  });

  it('leaves skipped questions until offered, and never asks answered ones', () => {
    const spec = fresh();
    expect(interviewStep(spec, memory({ skipped: ['discovery.1'] })).question!.id).toBe('discovery.2');
    spec.sections[0].answers['discovery.1'] = { value: 'Requests get lost', state: 'answered', reason: '' };
    expect(interviewStep(spec, memory()).question!.id).toBe('discovery.2');
    spec.sections[0].answers['discovery.2'] = { value: '', state: 'not-applicable', reason: 'Internal tool' };
    expect(interviewStep(spec, memory()).question!.id).not.toBe('discovery.2');
    // A blank answer does not count.
    spec.sections[0].answers['discovery.3'] = { value: '[["",""]]', state: 'answered', reason: '' };
    expect(interviewStep(spec, memory()).question!.id).toBe('discovery.3');
  });

  it('wraps up in a fixed order: skipped, unknown, optional, then done', () => {
    const spec = complete();
    expect(interviewStep(spec, memory())).toMatchObject({ wrapUp: 'done', counts: { requiredLeft: 0, skipped: 0, unknown: 0, optionalLeft: 0 } });

    const skippedId = allQuestions(spec).find(({ q }) => q.required)!.q.id;
    clear(spec, skippedId);
    expect(interviewStep(spec, memory({ skipped: [skippedId] }))).toMatchObject({ wrapUp: 'skipped', counts: { skipped: 1 } });
    expect(interviewStep(spec, memory({ skipped: [skippedId], deferSkipped: true })).wrapUp).toBe('done');
    // Going back to it asks it again.
    expect(interviewStep(spec, memory()).question!.id).toBe(skippedId);

    const unknownId = allQuestions(spec).filter(({ q }) => q.required && q.id !== skippedId)[3].q.id;
    spec.sections.find((s) => s.id === unknownId.split('.')[0])!.answers[unknownId] = { value: '', state: 'unknown', reason: '' };
    expect(interviewStep(spec, memory({ skipped: [skippedId], deferSkipped: true }))).toMatchObject({ wrapUp: 'unknown', counts: { unknown: 1 } });
    expect(interviewStep(spec, memory({ skipped: [skippedId], deferSkipped: true, deferUnknown: true })).wrapUp).toBe('done');
    expect(interviewStep(spec, memory({ skipped: [skippedId], reviewUnknown: true })).question!.id).toBe(unknownId);
    // Still unknown after a second look: parked, not asked again.
    expect(interviewStep(spec, memory({ skipped: [skippedId, unknownId], reviewUnknown: true, deferSkipped: true })).wrapUp).toBe('done');

    const optionalId = allQuestions(spec).find(({ q }) => !q.required)!.q.id;
    clear(spec, optionalId);
    expect(interviewStep(spec, memory({ skipped: [skippedId], deferSkipped: true, deferUnknown: true }))).toMatchObject({ wrapUp: 'optional', counts: { optionalLeft: 1 } });
    expect(interviewStep(spec, memory({ optional: true, skipped: [skippedId], deferSkipped: true, deferUnknown: true })).question!.id).toBe(optionalId);
  });

  it('measures a section by its required answers', () => {
    expect(sectionProgress(fresh(), 'discovery')).toMatchObject({ done: 0, complete: false });
    expect(sectionProgress(complete(), 'discovery')).toMatchObject({ complete: true });
    expect(sectionProgress(complete(), 'discovery').total).toBeGreaterThan(0);
    expect(sectionProgress(fresh(), 'no-such-section')).toEqual({ done: 0, total: 0, complete: true });
  });
});

describe('answers read back', () => {
  const find = (kind: Question['kind']) => allQuestions(complete()).find(({ q }) => q.kind === kind)!.q;
  const a = (value: string) => ({ state: 'answered', value, reason: '' });

  it('shows options in the reader’s language and other kinds as one line', () => {
    const choice = find('choice');
    const option = choice.options![1];
    expect(answerSummary(choice, a(option.en), 'en')).toBe(option.en);
    expect(answerSummary(choice, a(option.en), 'fr')).toBe(option.fr);
    expect(answerSummary(choice, a('Something else'), 'fr')).toBe('Something else');
    const multi = find('multi');
    expect(answerSummary(multi, a(JSON.stringify([multi.options![0].en, multi.options![1].en])), 'fr')).toBe(`${multi.options![0].fr}, ${multi.options![1].fr}`);
    const toggle = find('switch');
    expect([answerSummary(toggle, a('yes'), 'en'), answerSummary(toggle, a('no'), 'fr'), answerSummary(toggle, a('maybe'), 'en')]).toEqual(['Yes', 'Non', 'maybe']);
    const slider = find('slider');
    expect(answerSummary(slider, a('99.9'), 'en')).toBe(`99.9 ${slider.range!.unit!.en}`.trimEnd());
    expect(answerSummary(find('matrix'), a('{"A":"x","B":"y"}'), 'en')).toBe('2 rows');
    expect(answerSummary(find('table'), a('[["a","b"],["",""],["c","d"]]'), 'en')).toBe('2 rows');
    expect(answerSummary(find('table'), a('[["a"]]'), 'fr')).toBe('1 ligne');
    expect(answerSummary(find('text'), a(`  many\n words ${'x'.repeat(400)}`), 'en')).toHaveLength(220);
  });

  it('says where an unanswered question stands', () => {
    const text = find('text');
    expect(answerSummary(text, { state: 'not-applicable', value: '', reason: 'n/a' }, 'en')).toBe('Not applicable');
    expect(answerSummary(text, { state: 'unknown', value: '' }, 'fr')).toBe('Inconnu pour l’instant');
    expect(answerSummary(text, undefined, 'en')).toBe('');
  });
});

describe('what a card returns', () => {
  it('accepts only well-formed results', () => {
    expect(parseInterviewResult(JSON.stringify({ action: 'answered', questionId: 'discovery.1', value: 'x', summary: 'x', extra: 1 }))).toEqual({ action: 'answered', questionId: 'discovery.1', value: 'x', summary: 'x' });
    expect(parseInterviewResult(JSON.stringify({ action: 'not-applicable', questionId: 'a.1', reason: 'Internal' }))).toEqual({ action: 'not-applicable', questionId: 'a.1', reason: 'Internal' });
    for (const bad of ['not json', '"text"', '{}', JSON.stringify({ action: 'delete', questionId: 'a.1' }), JSON.stringify({ action: 'skipped' }), null, 3]) expect(parseInterviewResult(bad)).toBeNull();
    expect(parseChoiceResult(JSON.stringify({ key: 'go-optional', label: 'Yes' }))).toEqual({ key: 'go-optional', label: 'Yes' });
    for (const bad of ['x', JSON.stringify({ key: 'format-disk' }), JSON.stringify({}), undefined]) expect(parseChoiceResult(bad)).toBeNull();
  });

  it('reads remembered state defensively', () => {
    expect(normalizeMemory(undefined)).toEqual(emptyMemory());
    expect(normalizeMemory({ skipped: ['a.1', 3, null], optional: 'yes', reviewUnknown: true, lastSection: 7 })).toEqual({ ...emptyMemory(), skipped: ['a.1'], reviewUnknown: true });
    expect(normalizeMemory({ skipped: Array.from({ length: 900 }, (_, i) => `q.${i}`) }).skipped).toHaveLength(500);
  });
});

describe('the assistant’s lines', () => {
  it('speak English and French, and stay short', () => {
    const en = interviewCopy('en');
    const fr = interviewCopy('fr');
    const m = modules[0];
    for (const [a, b] of [
      [en.greeting(true), fr.greeting(true)],
      [en.greeting(false), fr.greeting(false)],
      [en.sectionIntro(m, 6, 2), fr.sectionIntro(m, 6, 2)],
      [en.sectionDone(m), fr.sectionDone(m)],
      [en.skipped, fr.skipped],
      [en.unknown, fr.unknown],
      [en.notApplicable, fr.notApplicable],
      [en.aiAsked, fr.aiAsked],
      [en.jump, fr.jump],
      [en.pause, fr.pause],
      [en.offline, fr.offline],
      [en.opening, fr.opening],
      [en.welcomeBack, fr.welcomeBack],
      [en.wrapUp('skipped', 2), fr.wrapUp('skipped', 2)],
      [en.wrapUp('unknown', 1), fr.wrapUp('unknown', 1)],
      [en.wrapUp('optional', 5), fr.wrapUp('optional', 5)],
      [en.wrapUp('done', 0), fr.wrapUp('done', 0)],
      ...Object.keys(en.choices).map((k) => [en.choices[k as keyof typeof en.choices], fr.choices[k as keyof typeof fr.choices]]),
    ])
      expect(a && b && a !== b, `${a} | ${b}`).toBeTruthy();
    expect(en.greeting(true)).toMatch(/AI/);
    expect(en.greeting(false)).not.toMatch(/AI/);
    expect(en.wrapUp('skipped', 1)).toMatch(/1 question\. Want to go back to it/);
    expect(en.wrapUp('skipped', 3)).toMatch(/3 questions\. Want to go back to them/);
    expect(fr.wrapUp('unknown', 1)).toMatch(/1 réponse est marquée inconnue/);
    expect(en.ack(0)).not.toBe(en.ack(1));
    expect(en.ack(500)).toBeTruthy();
  });

  it('recognise a request to carry on, in either language, and nothing else', () => {
    for (const yes of ['Next question', ' next ', 'CONTINUE.', 'question suivante', 'Suivante!']) expect(isNextCommand(yes), yes).toBe(true);
    for (const no of ['What is next?', 'Our next release is in May', '', 'skip']) expect(isNextCommand(no), no).toBe(false);
  });
});
