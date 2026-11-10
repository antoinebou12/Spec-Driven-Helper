import { afterEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom, of, toArray } from 'rxjs';
import { EventType, type BaseEvent, type HttpAgent, type Message, type RunAgentInput } from '@copilotkit/react-core/v2';
import { SpecAgent, type SpecAgentOptions } from './interview-agent';
import { createSpec } from '../../../packages/shared/src/domain';
import { buildExampleSpec } from '../../../packages/shared/src/example';
import { emptyMemory, interviewCopy, interviewSignal, interviewToolName, interviewChoiceToolName, type InterviewMemory } from '../../../packages/shared/src/interview';
import { modules, moduleQuestions } from '../../../packages/shared/src/templates';
import type { Language } from '../../../packages/shared/src/templates';
import type { Spec } from '../../../packages/shared/src/schema';

/**
 * The interview agent plays AG-UI events for CopilotKit: greeting and question card, the next turn
 * after an answer, wrap-up choices, jumps, and the hand-off to the AI. It runs here without a
 * network: the AI is a stub, and time is instant unless a test asks for a natural pace.
 */
const fresh = () => createSpec('00000000-0000-4000-8000-0000000000e1', 'Portal', 'en', false, 'Web application');
const answer = (spec: Spec, id: string, value = 'Answer') => {
  spec.sections.find((s) => s.id === id.split('.')[0])!.answers[id] = { value, state: 'answered', reason: '' };
};
const fillRequired = (spec: Spec, sectionId: string, except: string[] = []) => {
  for (const q of moduleQuestions(modules.find((m) => m.id === sectionId)!, spec)) if (q.required && !except.includes(q.id)) answer(spec, q.id);
};

function setup(options: { spec?: Spec; llm?: HttpAgent | null; lang?: Language; memory?: Partial<InterviewMemory>; pace?: number } = {}) {
  const spec = options.spec ?? fresh();
  let memory: InterviewMemory = { ...emptyMemory(), ...options.memory };
  const sections: string[] = [];
  const llm = options.llm === undefined ? ({ run: vi.fn(() => of({ type: EventType.RUN_FINISHED } as BaseEvent)) } as unknown as HttpAgent) : options.llm;
  const settings: SpecAgentOptions = {
    getSpec: () => spec,
    getLang: () => options.lang ?? 'en',
    memory: { get: () => memory, set: (m) => (memory = m) },
    llm: () => llm,
    pace: () => options.pace ?? 0,
    onSection: (id) => sections.push(id),
  };
  const agent = new SpecAgent(settings);
  const input = (messages: Message[]): RunAgentInput => ({ threadId: 't1', runId: 'r1', messages, tools: [], context: [], state: {}, forwardedProps: {} });
  const run = (messages: Message[]) => firstValueFrom(agent.run(input(messages)).pipe(toArray()));
  return { agent, spec, run, input, llm: llm as unknown as { run: ReturnType<typeof vi.fn> } | null, memory: () => memory, sections };
}

const developer = (content: string): Message => ({ id: crypto.randomUUID(), role: 'developer', content });
const user = (content: string): Message => ({ id: crypto.randomUUID(), role: 'user', content });
const asked = (id: string, name: string = interviewToolName, args: unknown = { questionId: id }, text = ''): Message => ({ id: `m-${id}`, role: 'assistant', content: text, toolCalls: [{ id: `call-${id}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
const result = (id: string, body: unknown): Message => ({ id: `r-${id}`, role: 'tool', toolCallId: `call-${id}`, content: JSON.stringify(body) });

const types = (events: BaseEvent[]) => events.map((e) => e.type);
const text = (events: BaseEvent[]) => events.filter((e) => e.type === EventType.TEXT_MESSAGE_CONTENT).map((e: any) => e.delta).join('');
const card = (events: BaseEvent[]) => {
  const start = events.find((e) => e.type === EventType.TOOL_CALL_START) as any;
  const args = events.find((e) => e.type === EventType.TOOL_CALL_ARGS) as any;
  return start ? { name: start.toolCallName as string, args: JSON.parse(args.delta) } : null;
};

afterEach(() => vi.useRealTimers());

describe('starting the interview', () => {
  it('greets, introduces the first section and asks the first question as a card', async () => {
    const { run, memory, sections } = setup();
    const events = await run([developer(interviewSignal.start)]);
    expect(types(events)[0]).toBe(EventType.RUN_STARTED);
    expect(types(events).at(-1)).toBe(EventType.RUN_FINISHED);
    expect(types(events)).toEqual(expect.arrayContaining([EventType.TEXT_MESSAGE_START, EventType.TEXT_MESSAGE_END, EventType.TOOL_CALL_START, EventType.TOOL_CALL_ARGS, EventType.TOOL_CALL_END]));
    expect(text(events)).toContain(interviewCopy('en').greeting(true));
    expect(text(events)).toContain('**Business & discovery**');
    expect(card(events)).toEqual({ name: interviewToolName, args: { questionId: 'discovery.1' } });
    expect(memory().lastSection).toBe('discovery');
    expect(sections).toEqual(['discovery']);
    // The card belongs to the same assistant message as the text.
    const messageId = (events.find((e) => e.type === EventType.TEXT_MESSAGE_START) as any).messageId;
    expect((events.find((e) => e.type === EventType.TOOL_CALL_START) as any).parentMessageId).toBe(messageId);
  });

  it('greets in French, without offering the AI when there is none, and welcomes people back', async () => {
    const { run } = setup({ lang: 'fr', llm: null });
    const events = await run([developer(interviewSignal.start)]);
    expect(text(events)).toContain(interviewCopy('fr').greeting(false));
    expect(text(events)).not.toMatch(/IA/);
    expect(text(events)).toContain(`**${modules[0].title.fr}**`);
    const back = await setup().run([user('Earlier message'), developer(interviewSignal.start)]);
    expect(text(back)).toContain(interviewCopy('en').welcomeBack);
  });

  it('asks the first open question, not one that is already answered', async () => {
    const spec = fresh();
    answer(spec, 'discovery.1');
    expect(card(await setup({ spec }).run([developer(interviewSignal.start)]))!.args).toEqual({ questionId: 'discovery.2' });
  });
});

describe('after an answer', () => {
  it('acknowledges and asks the next question of the same section without repeating the introduction', async () => {
    const spec = fresh();
    const { run, memory } = setup({ spec, memory: { lastSection: 'discovery' } });
    answer(spec, 'discovery.1');
    const events = await run([developer(interviewSignal.start), asked('discovery.1'), result('discovery.1', { action: 'answered', questionId: 'discovery.1', value: 'Answer', summary: 'Answer' })]);
    expect(text(events)).toBe(interviewCopy('en').ack(1));
    expect(card(events)!.args).toEqual({ questionId: 'discovery.2' });
    expect(memory().skipped).toEqual([]);
  });

  it('says when a section is complete and moves on to the next one', async () => {
    const spec = fresh();
    fillRequired(spec, 'discovery');
    const { run, memory, sections } = setup({ spec, memory: { lastSection: 'discovery' } });
    const events = await run([asked('discovery.1'), result('discovery.1', { action: 'answered', questionId: 'discovery.1' })]);
    expect(text(events)).toContain('**Business & discovery** is complete.');
    expect(text(events)).toContain('**Scope & requirements**');
    expect(card(events)!.args.questionId.startsWith('scope.')).toBe(true);
    expect(memory().lastSection).toBe('scope');
    expect(sections).toEqual(['scope']);
  });

  it('remembers a skipped question and comes back to it only when offered', async () => {
    const { run, memory } = setup({ memory: { lastSection: 'discovery' } });
    const events = await run([asked('discovery.1'), result('discovery.1', { action: 'skipped', questionId: 'discovery.1' })]);
    expect(text(events)).toContain(interviewCopy('en').skipped);
    expect(memory().skipped).toEqual(['discovery.1']);
    expect(card(events)!.args).toEqual({ questionId: 'discovery.2' });
    // Answering it later takes it off the list.
    const again = await run([asked('discovery.1'), result('discovery.1', { action: 'answered', questionId: 'discovery.1' })]);
    expect(memory().skipped).toEqual([]);
    expect(text(again)).toBeTruthy();
  });

  it('acknowledges unknown and not-applicable answers in the assistant’s words', async () => {
    const { run } = setup({ memory: { lastSection: 'discovery' } });
    expect(text(await run([asked('discovery.1'), result('discovery.1', { action: 'unknown', questionId: 'discovery.1' })]))).toContain(interviewCopy('en').unknown);
    expect(text(await run([asked('discovery.1'), result('discovery.1', { action: 'not-applicable', questionId: 'discovery.1', reason: 'Internal tool' })]))).toContain(interviewCopy('en').notApplicable);
  });

  it('asks again when a result cannot be read', async () => {
    const { run } = setup();
    expect(card(await run([asked('discovery.1'), { id: 'x', role: 'tool', toolCallId: 'call-discovery.1', content: 'garbage' }]))!.args).toEqual({ questionId: 'discovery.1' });
  });
});

describe('wrapping up', () => {
  const almost = () => {
    const spec = buildExampleSpec('00000000-0000-4000-8000-0000000000e2');
    return spec;
  };

  it('offers to finish with readiness once every answer is in', async () => {
    const { run } = setup({ spec: almost(), memory: { lastSection: 'governance' } });
    const events = await run([asked('governance.1'), result('governance.1', { action: 'answered', questionId: 'governance.1' })]);
    expect(text(events)).toContain(interviewCopy('en').wrapUp('done', 0));
    expect(card(events)).toEqual({ name: interviewChoiceToolName, args: { options: [{ key: 'open-readiness', label: 'Open readiness' }, { key: 'stay', label: 'Stay here' }] } });
  });

  it('offers to go back to skipped questions, then acts on the answer', async () => {
    const spec = almost();
    const skipped = moduleQuestions(modules[0], spec).find((q) => q.required)!.id;
    delete spec.sections[0].answers[skipped];
    const { run, memory } = setup({ spec, memory: { skipped: [skipped], lastSection: 'governance' } });
    const offered = await run([developer(interviewSignal.next)]);
    expect(card(offered)!.name).toBe(interviewChoiceToolName);
    expect(text(offered)).toContain('Want to go back to it now?');
    const later = await run([asked('w', interviewChoiceToolName, { options: [] }), result('w', { key: 'later' })]);
    expect(memory().deferSkipped).toBe(true);
    expect(text(later)).toContain(interviewCopy('en').wrapUp('done', 0));
    const back = await run([asked('w', interviewChoiceToolName, { options: [] }), result('w', { key: 'go-skipped' })]);
    expect(memory().skipped).toEqual([]);
    expect(memory().deferSkipped).toBe(false);
    expect(card(back)!.args).toEqual({ questionId: skipped });
  });

  it('reviews unknown answers and asks the optional questions when the person says yes', async () => {
    const spec = almost();
    const target = moduleQuestions(modules[0], spec).find((q) => q.required)!.id;
    spec.sections[0].answers[target] = { value: '', state: 'unknown', reason: '' };
    const optional = moduleQuestions(modules[1], spec).find((q) => !q.required)!.id;
    delete spec.sections[1].answers[optional];
    const yesUnknown = setup({ spec, memory: { lastSection: 'governance' } });
    expect(text(await yesUnknown.run([developer(interviewSignal.next)]))).toContain('marked unknown');
    const review = await yesUnknown.run([asked('u', interviewChoiceToolName, { options: [] }), result('u', { key: 'go-unknown' })]);
    expect(yesUnknown.memory().reviewUnknown).toBe(true);
    expect(card(review)!.args).toEqual({ questionId: target });

    // "Not now" to the unknown answers moves on to the optional questions.
    const notNow = setup({ spec, memory: { lastSection: 'governance' } });
    const skip = await notNow.run([asked('u', interviewChoiceToolName, { options: [] }), result('u', { key: 'later' })]);
    expect(notNow.memory().deferUnknown).toBe(true);
    expect(text(skip)).toContain('optional');
    expect(card(skip)!.args.options.map((o: { key: string }) => o.key)).toEqual(['go-optional', 'stop']);

    const yes = await notNow.run([asked('o', interviewChoiceToolName, { options: [] }), result('o', { key: 'go-optional' })]);
    expect(notNow.memory().optional).toBe(true);
    expect(card(yes)!.args).toEqual({ questionId: optional });
  });

  it('answers the last choices with a word, not another card', async () => {
    const { run } = setup({ spec: almost() });
    const readiness = await run([asked('d', interviewChoiceToolName, { options: [] }), result('d', { key: 'open-readiness' })]);
    expect(text(readiness)).toBe(interviewCopy('en').opening);
    expect(card(readiness)).toBeNull();
    const stop = await run([asked('d', interviewChoiceToolName, { options: [] }), result('d', { key: 'stop' })]);
    expect(text(stop)).toBe(interviewCopy('en').pause);
    expect(card(await run([asked('d', interviewChoiceToolName, { options: [] }), result('d', { key: 'bogus' })]))).not.toBeNull();
  });
});

describe('moving around', () => {
  it('keeps the current question when the same outline entry is selected again', async () => {
    const { run, memory } = setup();
    const events = await run([asked('discovery.1'), developer(`${interviewSignal.jump}discovery.1`)]);
    expect(card(events)).toBeNull();
    expect(text(events)).toBe('');
    expect(events.some((e) => e.type === EventType.TOOL_CALL_RESULT)).toBe(false);
    expect(memory().skipped).toEqual([]);
  });
  it('jumps to any question, in any section, and continues from there', async () => {
    const { run, memory, sections } = setup();
    const events = await run([developer(`${interviewSignal.jump}security.3`)]);
    expect(text(events)).toBe('');
    expect(card(events)!.args).toEqual({ questionId: 'security.3' });
    expect(memory().lastSection).toBe('security');
    expect(sections).toEqual(['security']);
    // The question after it is in the same section.
    const next = await run([asked('security.3', interviewToolName, { questionId: 'security.3' }), result('security.3', { action: 'skipped', questionId: 'security.3' })]);
    expect(card(next)!.args.questionId.startsWith('security.')).toBe(true);
  });

  it('carries on when asked to, in English or French, without troubling the AI', async () => {
    const { run, llm } = setup();
    expect(card(await run([user('Next question')]))!.name).toBe(interviewToolName);
    expect(card(await run([user('question suivante')]))!.name).toBe(interviewToolName);
    expect(card(await run([developer(interviewSignal.next)]))!.name).toBe(interviewToolName);
    expect(llm!.run).not.toHaveBeenCalled();
  });

  it('closes the cards nobody answered, so only the newest question stays open', async () => {
    const { run, memory } = setup();
    const pending = [developer(interviewSignal.start), asked('discovery.1')];
    const closing = (events: BaseEvent[]) => events.filter((e) => e.type === EventType.TOOL_CALL_RESULT) as any[];

    const jump = await run([...pending, developer(`${interviewSignal.jump}security.3`)]);
    expect(closing(jump)).toHaveLength(1);
    expect(closing(jump)[0]).toMatchObject({ toolCallId: 'call-discovery.1', role: 'tool' });
    expect(JSON.parse(closing(jump)[0].content)).toEqual({ action: 'navigated', questionId: 'discovery.1' });
    expect(types(jump).indexOf(EventType.TOOL_CALL_RESULT)).toBeLessThan(types(jump).indexOf(EventType.TOOL_CALL_START));
    // Jumping away does not park the question: it is simply still open.
    expect(memory().skipped).toEqual([]);

    // Moving on does: it is set aside until offered, and the next question is a different one.
    const moving = setup();
    const next = await moving.run([...pending, user('Next question')]);
    expect(closing(next)).toHaveLength(1);
    expect(moving.memory().skipped).toEqual(['discovery.1']);
    expect(card(next)!.args).toEqual({ questionId: 'discovery.2' });

    // A wrap-up choice left open closes with "stay"; answered cards are left alone.
    const wrap = await run([asked('w', interviewChoiceToolName, { options: [] }), developer(interviewSignal.next)]);
    expect(JSON.parse(closing(wrap)[0].content)).toEqual({ key: 'stay' });
    const answered = await run([asked('discovery.1'), result('discovery.1', { action: 'skipped', questionId: 'discovery.1' }), developer(interviewSignal.next)]);
    expect(closing(answered)).toHaveLength(0);
  });

  it('asks the next question when nothing else says what to do', async () => {
    const { run } = setup();
    expect(card(await run([]))!.args).toEqual({ questionId: 'discovery.1' });
    expect(card(await run([{ id: 'a', role: 'assistant', content: 'Hello' }]))!.args).toEqual({ questionId: 'discovery.1' });
    expect(card(await run([developer(`${interviewSignal.jump}not.a.question`)]))!.args.questionId).toBe('discovery.1');
  });
});

describe('the AI', () => {
  it('receives what the person types, with interview cards turned into a plain conversation', async () => {
    const { run, llm } = setup();
    await run([
      developer(interviewSignal.start),
      asked('discovery.1', interviewToolName, { questionId: 'discovery.1' }, 'Let’s begin.'),
      result('discovery.1', { action: 'answered', questionId: 'discovery.1', summary: 'Agents lose requests' }),
      asked('discovery.2', interviewToolName, { questionId: 'discovery.2' }),
      result('discovery.2', { action: 'skipped', questionId: 'discovery.2' }),
      asked('wrap', interviewChoiceToolName, { options: [] }),
      result('wrap', { key: 'later', label: 'Not now' }),
      user('What is a persona?'),
    ]);
    expect(llm!.run).toHaveBeenCalledTimes(1);
    const sent = (llm!.run.mock.calls[0][0] as RunAgentInput).messages;
    expect(sent.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'user']);
    expect(sent.every((m) => !('toolCalls' in m && m.toolCalls))).toBe(true);
    expect((sent[0] as any).content).toContain('Let’s begin.');
    expect((sent[0] as any).content).toContain(`Question: ${moduleQuestions(modules[0], fresh())[0].prompt.en} (discovery.1)`);
    expect((sent[1] as any).content).toBe('Agents lose requests');
    expect((sent[3] as any).content).toBe('(skipped)');
    expect((sent[5] as any).content).toBe('Not now');
    expect((sent.at(-1) as any).content).toBe('What is a persona?');
  });

  it('keeps the AI’s own tool calls, and hands its results back to it', async () => {
    const { run, llm } = setup();
    const own: Message = { id: 'a1', role: 'assistant', content: '', toolCalls: [{ id: 'own', type: 'function', function: { name: 'ask_choice', arguments: '{}' } }] };
    await run([user('Hello'), own, { id: 't', role: 'tool', toolCallId: 'own', content: 'Agents' }]);
    const sent = (llm!.run.mock.calls[0][0] as RunAgentInput).messages;
    expect(sent.map((m) => m.role)).toEqual(['user', 'assistant', 'tool']);
    expect((sent[1] as any).toolCalls[0].function.name).toBe('ask_choice');
    // A result whose call is gone is dropped, not sent on its own.
    await run([{ id: 'orphan', role: 'tool', toolCallId: 'gone', content: 'x' }, user('Hi')]);
    expect((llm!.run.mock.calls[1][0] as RunAgentInput).messages.map((m) => m.role)).toEqual(['user']);
  });

  it('is asked for a suggestion when the card says so, and answers the person’s own question otherwise', async () => {
    const { run, llm, agent } = setup();
    const events = await run([asked('discovery.1'), result('discovery.1', { action: 'ask-ai', questionId: 'discovery.1' })]);
    expect(types(events)).toEqual([EventType.RUN_FINISHED]);
    const sent = (llm!.run.mock.calls[0][0] as RunAgentInput).messages;
    expect((sent.at(-1) as any).content).toBe(interviewCopy('en').askAiPrompt(moduleQuestions(modules[0], fresh())[0]));
    // The server is told which question the suggestion is for.
    expect((llm!.run.mock.calls[0][0] as RunAgentInput).forwardedProps).toMatchObject({ suggest: 'discovery.1' });
    expect(agent.clone()).toBeInstanceOf(SpecAgent);
  });

  it('routes a contextual form action through the same question-scoped suggestion contract', async () => {
    const { run, llm } = setup();
    await run([developer(`${interviewSignal.suggest}discovery.2`)]);
    expect((llm!.run.mock.calls[0][0] as RunAgentInput).forwardedProps).toMatchObject({ suggest: 'discovery.2' });
    expect((llm!.run.mock.calls[0][0] as RunAgentInput).messages.at(-1)).toMatchObject({ role: 'user', content: interviewCopy('en').askAiPrompt(moduleQuestions(modules[0], fresh())[1]) });
  });

  it('says so plainly, and keeps guiding, when there is no AI', async () => {
    const { run } = setup({ llm: null });
    const typed = await run([user('Can you write this for me?')]);
    expect(text(typed)).toBe(interviewCopy('en').offline);
    expect(card(typed)).toBeNull();
    // A card's "Suggest with AI" cannot happen without one, but is handled if it does.
    expect(text(await run([asked('discovery.1'), result('discovery.1', { action: 'ask-ai', questionId: 'discovery.1' })]))).toBe(interviewCopy('en').offline);
    expect(card(await run([asked('discovery.1'), result('discovery.1', { action: 'ask-ai', questionId: 'unknown.id' })]))!.name).toBe(interviewToolName);
  });
});

describe('pace and failures', () => {
  it('types at a natural pace, and stops when the conversation is abandoned', async () => {
    vi.useFakeTimers();
    const { agent, input } = setup({ pace: 1 });
    const seen: string[] = [];
    let done = false;
    const subscription = agent.run(input([developer(interviewSignal.start)])).subscribe({ next: (e) => seen.push(e.type as string), complete: () => (done = true) });
    expect(seen).toEqual([EventType.RUN_STARTED]);
    await vi.advanceTimersByTimeAsync(330);
    expect(seen).toContain(EventType.TEXT_MESSAGE_START);
    expect(seen).not.toContain(EventType.TOOL_CALL_START);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(seen.at(-1)).toBe(EventType.RUN_FINISHED);
    expect(done).toBe(true);
    subscription.unsubscribe();

    const second: string[] = [];
    const cut = agent.run(input([developer(interviewSignal.start)])).subscribe((e) => second.push(e.type as string));
    await vi.advanceTimersByTimeAsync(400);
    const count = second.length;
    cut.unsubscribe();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(second).toHaveLength(count);
  });

  it('reports a failure as a run error instead of hanging', async () => {
    const { agent, input } = setup();
    (agent as any).options.getSpec = () => {
      throw new Error('Specification not loaded');
    };
    const events = await firstValueFrom(agent.run(input([developer(interviewSignal.start)])).pipe(toArray()));
    expect(types(events)).toEqual([EventType.RUN_STARTED, EventType.RUN_ERROR]);
    expect((events[1] as any).message).toBe('Specification not loaded');
  });

  it('keeps the conversation when copied', () => {
    const { agent } = setup();
    agent.messages = [user('Hello')];
    agent.threadId = 'thread-9';
    const copy = agent.clone();
    expect(copy.threadId).toBe('thread-9');
    expect(copy.messages).toEqual(agent.messages);
    expect(copy.messages).not.toBe(agent.messages);
  });
});
