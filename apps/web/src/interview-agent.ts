import { AbstractAgent, EventType, type BaseEvent, type HttpAgent, type Message, type RunAgentInput } from '@copilotkit/react-core/v2';
import { Observable } from 'rxjs';
import {
  interviewChoiceToolName,
  interviewCopy,
  interviewSignal,
  interviewStep,
  interviewToolName,
  isNextCommand,
  parseChoiceResult,
  parseInterviewResult,
  sectionProgress,
  type InterviewChoiceKey,
  type InterviewMemory,
  type WrapUp,
} from '../../../packages/shared/src/interview';
import type { Spec } from '../../../packages/shared/src/schema';
import { moduleOf, questionIn, type Language } from '../../../packages/shared/src/templates';

/**
 * The agent behind Build with AI. It asks the specification's questions itself, instantly and
 * without a model, one card at a time, and hands everything else to the AI conversation: a message
 * typed by the person, or a card's "Suggest with AI". Both speak AG-UI, so CopilotKit renders the
 * interview and the AI in the same conversation. The interview only asks; the person's answers are
 * saved by the cards, and anything the AI suggests stays a proposal.
 */
export type SpecAgentOptions = {
  getSpec: () => Spec;
  getLang: () => Language;
  memory: { get: () => InterviewMemory; set: (memory: InterviewMemory) => void };
  /** The AI conversation (the server's AG-UI agent); null when no model is available. Read at each run, so the agent itself stays the same while models load. */
  llm: () => HttpAgent | null;
  /** 1 is a natural pace, 0 answers at once (tests, and people who prefer reduced motion). Read at each run. */
  pace?: () => number;
  /** Called with the section of each question asked, so the document can open it. */
  onSection?: (sectionId: string) => void;
};

type Step = { wait: number } | { event: BaseEvent };
type Card = { name: string; args: unknown };
/** What one turn says: paragraphs, an optional card, and the results that close cards left open. */
type Turn = { parts: string[]; card: Card | null; settled: BaseEvent[] };

const textOf = (content: unknown) => (typeof content === 'string' ? content : Array.isArray(content) ? content.map((p: any) => (p?.type === 'text' ? String(p.text ?? '') : '')).join('') : '');
const callName = (messages: readonly Message[], id: string) => {
  for (const m of messages) if (m.role === 'assistant') for (const c of m.toolCalls ?? []) if (c.id === id) return c.function.name;
  return undefined;
};
const ownTools: string[] = [interviewToolName, interviewChoiceToolName];

export class SpecAgent extends AbstractAgent {
  constructor(private readonly options: SpecAgentOptions) {
    super({ agentId: 'builder', description: 'Guided interview with an AI assistant' });
  }

  clone(): any {
    const copy = new SpecAgent(this.options);
    copy.threadId = this.threadId;
    copy.messages = structuredClone(this.messages);
    copy.state = structuredClone(this.state);
    return copy;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    try {
      return this.route(input);
    } catch (error) {
      return this.failed(input, error);
    }
  }

  private route(input: RunAgentInput): Observable<BaseEvent> {
    const last = input.messages.at(-1);
    const copy = interviewCopy(this.options.getLang());
    if (last?.role === 'developer') {
      const signal = textOf(last.content);
      if (signal.startsWith(interviewSignal.suggest)) return this.afterAnswer(input, JSON.stringify({ action: 'ask-ai', questionId: signal.slice(interviewSignal.suggest.length) }));
      if (signal.startsWith(interviewSignal.jump)) {
        const questionId = signal.slice(interviewSignal.jump.length);
        const answered = new Set(input.messages.filter((m) => m.role === 'tool').map((m) => m.toolCallId));
        const active = input.messages.some((m) => m.role === 'assistant' && m.toolCalls?.some((c) => {
          if (c.function.name !== interviewToolName || answered.has(c.id)) return false;
          try { return JSON.parse(c.function.arguments).questionId === questionId; } catch { return false; }
        }));
        if (active) return this.play(input, { parts: [], card: null, settled: [] });
        return this.play(input, this.turn({ jump: questionId }, this.settle(input.messages, false)));
      }
      if (signal === interviewSignal.start) return this.play(input, this.turn({ greet: true, welcome: input.messages.length > 1 }));
      if (signal === interviewSignal.next) return this.play(input, this.turn({ lead: [copy.ack(input.messages.length)] }, this.settle(input.messages, true)));
    }
    if (last?.role === 'tool') {
      const name = callName(input.messages, last.toolCallId);
      if (name === interviewToolName) return this.afterAnswer(input, last.content);
      if (name === interviewChoiceToolName) return this.afterChoice(input, last.content);
      return this.ai(input);
    }
    if (last?.role === 'user') return isNextCommand(textOf(last.content)) ? this.play(input, this.turn({ lead: [copy.ack(input.messages.length)] }, this.settle(input.messages, true))) : this.ai(input);
    return this.play(input, this.turn({}));
  }

  // ---- The interview -------------------------------------------------------------------------

  private afterAnswer(input: RunAgentInput, content: string): Observable<BaseEvent> {
    const result = parseInterviewResult(content);
    const copy = interviewCopy(this.options.getLang());
    const memory = this.options.memory.get();
    if (!result) return this.play(input, this.turn({}));
    const settled = memory.skipped.filter((id) => id !== result.questionId);
    if (result.action === 'ask-ai') {
      const q = questionIn(this.options.getSpec(), result.questionId);
      return q ? this.ai(input, [{ id: crypto.randomUUID(), role: 'user', content: copy.askAiPrompt(q) }], q.id) : this.play(input, this.turn({}));
    }
    if (result.action === 'skipped') this.options.memory.set({ ...memory, skipped: [...new Set([...settled, result.questionId])] });
    else this.options.memory.set({ ...memory, skipped: settled });
    const lead = { answered: copy.ack(input.messages.filter((m) => m.role === 'tool').length), skipped: copy.skipped, unknown: copy.unknown, 'not-applicable': copy.notApplicable, navigated: '' }[result.action];
    return this.play(input, this.turn({ lead: [lead], afterAnswer: true }));
  }

  private afterChoice(input: RunAgentInput, content: string): Observable<BaseEvent> {
    const choice = parseChoiceResult(content);
    const copy = interviewCopy(this.options.getLang());
    const spec = this.options.getSpec();
    const memory = this.options.memory.get();
    if (!choice) return this.play(input, this.turn({}));
    const wrap = interviewStep(spec, memory, memory.lastSection).wrapUp;
    const set = (patch: Partial<InterviewMemory>) => this.options.memory.set({ ...memory, ...patch });
    switch (choice.key) {
      case 'go-skipped':
        // Skipped optional questions are only asked in the optional pass.
        set({ skipped: [], deferSkipped: false, optional: memory.optional || memory.skipped.some((id) => questionIn(spec, id)?.required === false) });
        return this.play(input, this.turn({}));
      case 'go-unknown':
        set({ reviewUnknown: true, deferUnknown: false });
        return this.play(input, this.turn({}));
      case 'go-optional':
        set({ optional: true });
        return this.play(input, this.turn({}));
      case 'later':
        set(wrap === 'skipped' ? { deferSkipped: true } : { deferUnknown: true });
        return this.play(input, this.turn({}));
      case 'open-readiness':
        return this.play(input, this.textOnly(copy.opening));
      default:
        return this.play(input, this.textOnly(copy.pause));
    }
  }

  /** The next message: an acknowledgement, a word about the section, then the next question as a card. */
  private turn(opts: { lead?: string[]; jump?: string; greet?: boolean; welcome?: boolean; afterAnswer?: boolean }, settled: BaseEvent[] = []): Turn {
    const spec = this.options.getSpec();
    const lang = this.options.getLang();
    const copy = interviewCopy(lang);
    const memory = this.options.memory.get();
    const parts = [...(opts.lead ?? [])];
    if (opts.greet) parts.unshift(opts.welcome ? copy.welcomeBack : copy.greeting(!!this.options.llm()));

    if (opts.jump) {
      const question = questionIn(spec, opts.jump);
      if (question) {
        const sectionId = question.id.split('.')[0];
        this.options.memory.set({ ...memory, lastSection: sectionId });
        this.options.onSection?.(sectionId);
        return { parts: [], card: { name: interviewToolName, args: { questionId: question.id } }, settled };
      }
    }

    const step = interviewStep(spec, memory, memory.lastSection);
    const previous = memory.lastSection ? moduleOf(`${memory.lastSection}.0`) : undefined;
    const leaving = !step.section || step.section.id !== memory.lastSection;
    if (opts.afterAnswer && previous && leaving && sectionProgress(spec, previous.id).complete) parts.push(copy.sectionDone(previous));

    if (step.question && step.section) {
      if (leaving) {
        const progress = sectionProgress(spec, step.section.id);
        parts.push(copy.sectionIntro(step.section, progress.total, progress.done));
        this.options.memory.set({ ...this.options.memory.get(), lastSection: step.section.id });
      }
      this.options.onSection?.(step.section.id);
      return { parts, card: { name: interviewToolName, args: { questionId: step.question.id } }, settled };
    }

    const wrap = step.wrapUp as WrapUp;
    const count = { skipped: step.counts.skipped, unknown: step.counts.unknown, optional: step.counts.optionalLeft, done: 0 }[wrap];
    parts.push(copy.wrapUp(wrap, count));
    const keys: InterviewChoiceKey[] = { skipped: ['go-skipped', 'later'], unknown: ['go-unknown', 'later'], optional: ['go-optional', 'stop'], done: ['open-readiness', 'stay'] }[wrap] as InterviewChoiceKey[];
    return { parts, card: { name: interviewChoiceToolName, args: { options: keys.map((key) => ({ key, label: copy.choices[key] })) } }, settled };
  }

  private textOnly(text: string): Turn {
    return { parts: [text], card: null, settled: [] };
  }

  /**
   * Closes the cards nobody answered, so only the newest question stays open: they fold into a
   * "skipped" record. When the person asked to move on, the question is also parked for later.
   */
  private settle(messages: readonly Message[], park: boolean): BaseEvent[] {
    const answered = new Set(messages.filter((m) => m.role === 'tool').map((m: any) => m.toolCallId));
    const events: BaseEvent[] = [];
    const parked: string[] = [];
    for (const m of messages)
      if (m.role === 'assistant')
        for (const call of m.toolCalls ?? []) {
          if (!ownTools.includes(call.function.name) || answered.has(call.id)) continue;
          let content = JSON.stringify({ key: 'stay' });
          if (call.function.name === interviewToolName) {
            const questionId = (() => {
              try {
                return String(JSON.parse(call.function.arguments).questionId ?? '');
              } catch {
                return '';
              }
            })();
            content = JSON.stringify({ action: park ? 'skipped' : 'navigated', questionId });
            if (park && questionId) parked.push(questionId);
          }
          events.push({ type: EventType.TOOL_CALL_RESULT, messageId: crypto.randomUUID(), toolCallId: call.id, content, role: 'tool' } as BaseEvent);
        }
    if (parked.length) {
      const memory = this.options.memory.get();
      this.options.memory.set({ ...memory, skipped: [...new Set([...memory.skipped, ...parked])] });
    }
    return events;
  }

  // ---- The AI --------------------------------------------------------------------------------

  /** `suggest` names the question a suggestion is for, so the server can turn the AI's answer into a proposal for it. */
  private ai(input: RunAgentInput, extra: Message[] = [], suggest?: string): Observable<BaseEvent> {
    const llm = this.options.llm();
    if (!llm) return this.play(input, this.textOnly(interviewCopy(this.options.getLang()).offline));
    return llm.run({ ...input, messages: [...this.forAi(input.messages), ...extra], ...(suggest ? { forwardedProps: { ...(input.forwardedProps as object), suggest } } : {}) });
  }

  /** The conversation as the AI should read it: interview cards become plain questions and answers. */
  private forAi(messages: readonly Message[]): Message[] {
    const spec = this.options.getSpec();
    const lang = this.options.getLang();
    const out: Message[] = [];
    for (const m of messages) {
      if (m.role === 'developer') continue;
      if (m.role === 'assistant' && m.toolCalls?.some((c) => ownTools.includes(c.function.name))) {
        const questions = m.toolCalls
          .filter((c) => c.function.name === interviewToolName)
          .map((c) => {
            try {
              const q = questionIn(spec, JSON.parse(c.function.arguments).questionId);
              return q ? `Question: ${q.prompt[lang]} (${q.id})` : '';
            } catch {
              return '';
            }
          });
        const others = m.toolCalls.filter((c) => !ownTools.includes(c.function.name));
        out.push({ ...m, content: [textOf(m.content), ...questions].filter(Boolean).join('\n'), toolCalls: others.length ? others : undefined } as Message);
        continue;
      }
      if (m.role === 'tool') {
        const name = callName(messages, m.toolCallId);
        // A result whose call was cut from the history (long conversations) means nothing on its own.
        if (!name) continue;
        if (ownTools.includes(name)) {
          const answer = name === interviewToolName ? parseInterviewResult(m.content) : parseChoiceResult(m.content);
          const said = answer && 'action' in answer ? (answer.action === 'answered' ? answer.summary : `(${answer.action})`) : answer?.label;
          if (said) out.push({ id: m.id, role: 'user', content: said });
          continue;
        }
      }
      out.push(m);
    }
    return out;
  }

  // ---- Events --------------------------------------------------------------------------------

  private failed(input: RunAgentInput, error: unknown): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId } as BaseEvent);
      subscriber.next({ type: EventType.RUN_ERROR, message: (error as Error).message ?? 'The interview failed' } as BaseEvent);
      subscriber.complete();
    });
  }

  /** Plays a turn as AG-UI events, with a short pause and a quick stream so it reads like a person typing. */
  private play(input: RunAgentInput, turn: Turn): Observable<BaseEvent> {
    const pace = this.options.pace?.() ?? 1;
    // Cards left open are closed first, so the conversation shows one open question.
    const steps: Step[] = [...turn.settled.map((event) => ({ event })), { wait: 320 * pace }];
    const messageId = crypto.randomUUID();
    const text = turn.parts.filter(Boolean).join('\n\n');
    if (text) {
      steps.push({ event: { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent });
      for (const chunk of text.match(/\S+\s*/g) ?? [text]) steps.push({ event: { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: chunk } as BaseEvent }, { wait: 14 * pace });
      steps.push({ event: { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent });
    }
    if (turn.card) {
      const toolCallId = `call_${crypto.randomUUID()}`;
      steps.push(
        { wait: 160 * pace },
        { event: { type: EventType.TOOL_CALL_START, toolCallId, toolCallName: turn.card.name, parentMessageId: messageId } as BaseEvent },
        { event: { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(turn.card.args) } as BaseEvent },
        { event: { type: EventType.TOOL_CALL_END, toolCallId } as BaseEvent },
      );
    }
    return new Observable((subscriber) => {
      let stopped = false;
      const timers = new Set<ReturnType<typeof setTimeout>>();
      const at = (i: number) => {
        if (stopped) return;
        if (i === 0) subscriber.next({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId } as BaseEvent);
        if (i >= steps.length) {
          subscriber.next({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId } as BaseEvent);
          subscriber.complete();
          return;
        }
        const step = steps[i];
        if ('event' in step) {
          subscriber.next(step.event);
          at(i + 1);
        } else if (step.wait > 0) {
          const timer = setTimeout(() => {
            timers.delete(timer);
            at(i + 1);
          }, step.wait);
          timers.add(timer);
        } else at(i + 1);
      };
      at(0);
      return () => {
        stopped = true;
        timers.forEach(clearTimeout);
      };
    });
  }
}
