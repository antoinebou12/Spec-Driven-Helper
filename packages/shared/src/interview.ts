import { answerStatus, type AnswerStatus } from './domain';
import { listOf, matrixOf, rowsOf } from './markdown';
import type { Spec } from './schema';
import { moduleQuestions, modules, type Language, type Module, type Question } from './templates';

/**
 * The guided interview behind Build with AI: the specification asked as a conversation, one
 * question at a time, each with its own interactive control. Everything here is deterministic and
 * needs no model, so the interview is instant, works offline and in local-only projects, and costs
 * no tokens. The AI joins in when the person types, or asks for a suggestion on a question.
 */
export const interviewToolName = 'ask_question' as const;
export const interviewChoiceToolName = 'interview_choice' as const;
/** Control messages (role "developer", never shown) that steer the interview from the page. */
export const interviewSignal = { start: 'interview:start', next: 'interview:next', jump: 'interview:jump:', suggest: 'interview:suggest:' } as const;

export type InterviewAction = 'answered' | 'skipped' | 'unknown' | 'not-applicable' | 'ask-ai' | 'navigated';
/** What a question card returns to the conversation (JSON in the tool result). */
export type InterviewResult = { action: InterviewAction; questionId: string; value?: string; summary?: string; reason?: string };
export type InterviewChoiceKey = 'go-skipped' | 'later' | 'go-unknown' | 'go-optional' | 'stop' | 'open-readiness' | 'stay';
export type InterviewChoiceResult = { key: InterviewChoiceKey; label?: string };
const actions: InterviewAction[] = ['answered', 'skipped', 'unknown', 'not-applicable', 'ask-ai', 'navigated'];
const choiceKeys: InterviewChoiceKey[] = ['go-skipped', 'later', 'go-unknown', 'go-optional', 'stop', 'open-readiness', 'stay'];

const json = (content: unknown): Record<string, unknown> | null => {
  if (typeof content !== 'string') return null;
  try {
    const value = JSON.parse(content);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
export function parseInterviewResult(content: unknown): InterviewResult | null {
  const v = json(content);
  if (!v || !actions.includes(v.action as InterviewAction) || typeof v.questionId !== 'string') return null;
  return {
    action: v.action as InterviewAction,
    questionId: v.questionId,
    ...(typeof v.value === 'string' ? { value: v.value } : {}),
    ...(typeof v.summary === 'string' ? { summary: v.summary } : {}),
    ...(typeof v.reason === 'string' ? { reason: v.reason } : {}),
  };
}
export function parseChoiceResult(content: unknown): InterviewChoiceResult | null {
  const v = json(content);
  if (!v || !choiceKeys.includes(v.key as InterviewChoiceKey)) return null;
  return { key: v.key as InterviewChoiceKey, ...(typeof v.label === 'string' ? { label: v.label } : {}) };
}

/** What the interview remembers between turns (kept in the browser, per project). */
export type InterviewMemory = {
  /** Questions passed over for now. */
  skipped: string[];
  /** Also ask the optional questions once the required ones are done. */
  optional: boolean;
  /** Go through the answers marked unknown. */
  reviewUnknown: boolean;
  /** The person declined to revisit skipped or unknown answers this time. */
  deferSkipped: boolean;
  deferUnknown: boolean;
  /** Section of the last question asked, to say when the conversation moves to another one. */
  lastSection: string | null;
};
export const emptyMemory = (): InterviewMemory => ({ skipped: [], optional: false, reviewUnknown: false, deferSkipped: false, deferUnknown: false, lastSection: null });
export function normalizeMemory(value: unknown): InterviewMemory {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<InterviewMemory>;
  const flag = (x: unknown) => x === true;
  return {
    skipped: Array.isArray(v.skipped) ? v.skipped.filter((x): x is string => typeof x === 'string').slice(0, 500) : [],
    optional: flag(v.optional),
    reviewUnknown: flag(v.reviewUnknown),
    deferSkipped: flag(v.deferSkipped),
    deferUnknown: flag(v.deferUnknown),
    lastSection: typeof v.lastSection === 'string' ? v.lastSection : null,
  };
}

export type WrapUp = 'skipped' | 'unknown' | 'optional' | 'done';
export type InterviewStep = {
  /** The next question to ask, or undefined when it is time to wrap up. */
  question?: Question;
  section?: Module;
  /** What to offer when there is no question left in the current pass. */
  wrapUp?: WrapUp;
  counts: { requiredLeft: number; skipped: number; unknown: number; optionalLeft: number };
};

/**
 * The next step of the interview: required questions first (the section of `focus` before the
 * others, so a jump continues where the person is), then answers marked unknown when asked to
 * review them, then optional questions when asked for them. Skipped questions wait until offered.
 */
export function interviewStep(spec: Spec, memory: InterviewMemory, focus?: string | null): InterviewStep {
  const skipped = new Set(memory.skipped);
  const ordered = focus && modules.some((m) => m.id === focus) ? [...modules.filter((m) => m.id === focus), ...modules.filter((m) => m.id !== focus)] : modules;
  const entries = ordered.flatMap((module) => {
    const section = spec.sections.find((s) => s.id === module.id);
    return moduleQuestions(module, spec).map((question) => ({ question, module, status: answerStatus(section?.answers[question.id]) as AnswerStatus }));
  });
  const requiredOpen = entries.filter((e) => e.status === 'empty' && e.question.required && !skipped.has(e.question.id));
  const unknown = entries.filter((e) => e.status === 'unknown');
  const unknownOpen = unknown.filter((e) => !skipped.has(e.question.id));
  const optionalOpen = entries.filter((e) => e.status === 'empty' && !e.question.required && !skipped.has(e.question.id));
  const skippedOpen = entries.filter((e) => e.status === 'empty' && skipped.has(e.question.id));
  const counts = { requiredLeft: requiredOpen.length, skipped: skippedOpen.length, unknown: unknown.length, optionalLeft: optionalOpen.length };
  const pick = (list: typeof entries): InterviewStep => ({ question: list[0].question, section: list[0].module, counts });
  if (requiredOpen.length) return pick(requiredOpen);
  if (memory.reviewUnknown && unknownOpen.length) return pick(unknownOpen);
  if (memory.optional && optionalOpen.length) return pick(optionalOpen);
  if (skippedOpen.length && !memory.deferSkipped) return { wrapUp: 'skipped', counts };
  if (unknown.length && !memory.reviewUnknown && !memory.deferUnknown) return { wrapUp: 'unknown', counts };
  if (optionalOpen.length && !memory.optional) return { wrapUp: 'optional', counts };
  return { wrapUp: 'done', counts };
}

/** Required questions answered (or marked not applicable) in a section. */
export function sectionProgress(spec: Spec, sectionId: string) {
  const module = modules.find((m) => m.id === sectionId);
  if (!module) return { done: 0, total: 0, complete: true };
  const section = spec.sections.find((s) => s.id === sectionId);
  const required = moduleQuestions(module, spec).filter((q) => q.required);
  const done = required.filter((q) => ['answered', 'na'].includes(answerStatus(section?.answers[q.id]))).length;
  return { done, total: required.length, complete: done === required.length };
}

const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);
const label = (o: { en: string; fr: string } | undefined, value: string, lang: Language) => o?.[lang] ?? value;

/** An answer as one readable line, in the reader's language. */
export function answerSummary(question: Question, answer: { state: string; value: string; reason?: string } | undefined, lang: Language): string {
  const fr = lang === 'fr';
  const status = answerStatus(answer);
  if (status === 'na') return fr ? 'Ne s’applique pas' : 'Not applicable';
  if (status === 'unknown') return fr ? 'Inconnu pour l’instant' : 'Unknown for now';
  if (status === 'empty') return '';
  const value = answer!.value;
  const option = (v: string) => label(question.options?.find((o) => o.en === v), v, lang);
  switch (question.kind) {
    case 'choice':
      return option(value);
    case 'multi':
      return listOf(value).map(option).join(', ');
    case 'switch':
      return value === 'yes' ? (fr ? 'Oui' : 'Yes') : value === 'no' ? (fr ? 'Non' : 'No') : value;
    case 'slider': {
      const unit = question.range?.unit?.[lang];
      return `${value}${unit ? ` ${unit}` : ''}`;
    }
    case 'matrix': {
      const n = Object.keys(matrixOf(value)).length;
      return fr ? `${n} lignes` : `${n} rows`;
    }
    case 'table':
    case 'raci':
    case 'requirements':
    case 'comparison': {
      const n = (rowsOf(value) ?? []).filter((r) => r.some((c) => c.trim())).length;
      return fr ? `${n} ${n === 1 ? 'ligne' : 'lignes'}` : `${n} ${n === 1 ? 'row' : 'rows'}`;
    }
    default:
      return clip(value.replace(/\s+/g, ' ').trim(), 220);
  }
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The assistant's lines, in both languages. Short by design: the controls do the talking. */
export function interviewCopy(lang: Language) {
  const fr = lang === 'fr';
  const acks = fr ? ['Compris.', 'Noté.', 'Merci.', 'Parfait.', 'Très bien.'] : ['Got it.', 'Noted.', 'Thanks.', 'Perfect.', 'Great.'];
  return {
    next: fr ? 'Question suivante' : 'Next question',
    greeting: (ai: boolean) =>
      fr
        ? `Bonjour ! Je vous guide dans votre document de conception, une question à la fois. Répondez avec les contrôles, passez ce dont vous n’êtes pas sûr${ai ? ', ou demandez une suggestion à l’IA' : ''}. Tout ce que vous répondez apparaît dans le document à droite.`
        : `Hi! I’ll guide you through your design document one question at a time. Use the controls to answer, skip what you’re unsure about${ai ? ', or ask the AI for a suggestion' : ''}. Everything you answer appears in the document on the right.`,
    welcomeBack: fr ? 'Content de vous revoir — reprenons où nous en étions.' : 'Welcome back — let’s pick up where we left off.',
    sectionIntro: (m: Module, required: number, done: number) =>
      fr
        ? `Passons à **${m.title.fr}**. ${m.description.fr} ${required ? `(${done} sur ${required} réponses obligatoires déjà données.)` : ''}`.trim()
        : `Let’s work on **${m.title.en}**. ${m.description.en} ${required ? `(${done} of ${required} required answers so far.)` : ''}`.trim(),
    sectionDone: (m: Module) => (fr ? `**${m.title.fr}** est terminée.` : `**${m.title.en}** is complete.`),
    ack: (turn: number) => acks[turn % acks.length],
    skipped: fr ? 'Pas de souci — j’y reviendrai plus tard.' : 'No problem — I’ll come back to it later.',
    unknown: fr ? 'Marqué comme inconnu pour l’instant. Cela reste sur votre liste jusqu’à ce que vous puissiez répondre.' : 'Marked as unknown for now. It stays on your list until you can answer it.',
    notApplicable: fr ? 'Marqué comme ne s’appliquant pas.' : 'Marked as not applicable.',
    aiAsked: fr ? 'J’ai demandé une suggestion à l’IA — elle apparaîtra comme proposition à réviser.' : 'I asked the AI for a suggestion — it will appear as a proposal for you to review.',
    jump: fr ? 'Bien sûr — voici cette question.' : 'Sure — here’s that question.',
    wrapUp: (kind: WrapUp, n: number) => {
      if (kind === 'skipped') return fr ? `Vous avez passé ${n} ${plural(n, 'question', 'questions')}. Voulez-vous y revenir maintenant ?` : `You skipped ${n} ${plural(n, 'question', 'questions')}. Want to go back to ${plural(n, 'it', 'them')} now?`;
      if (kind === 'unknown') return fr ? `${n} ${plural(n, 'réponse est marquée inconnue', 'réponses sont marquées inconnues')}. Elles bloquent la référence tant qu’elles ne sont pas remplies — les passer en revue maintenant ?` : `${n} ${plural(n, 'answer is', 'answers are')} marked unknown. They block the baseline until answered — go through ${plural(n, 'it', 'them')} now?`;
      if (kind === 'optional') return fr ? `Toutes les questions obligatoires ont une réponse. Il reste ${n} ${plural(n, 'question facultative', 'questions facultatives')} qui enrichissent le document — continuer avec elles ?` : `All required questions are answered. There ${plural(n, 'is', 'are')} ${n} optional ${plural(n, 'question', 'questions')} that make the document richer — continue with ${plural(n, 'it', 'them')}?`;
      return fr ? 'La spécification a toutes ses réponses. Consultez la préparation pour lever les blocages et approuver une référence.' : 'The specification has all its answers. Check readiness to review blockers and approve a baseline.';
    },
    choices: {
      'go-skipped': fr ? 'Y revenir' : 'Go back to them',
      later: fr ? 'Pas maintenant' : 'Not now',
      'go-unknown': fr ? 'Les revoir' : 'Go through them',
      'go-optional': fr ? 'Répondre aux questions facultatives' : 'Answer the optional questions',
      stop: fr ? 'J’ai terminé pour l’instant' : 'I’m done for now',
      'open-readiness': fr ? 'Ouvrir la préparation' : 'Open readiness',
      stay: fr ? 'Rester ici' : 'Stay here',
    } satisfies Record<InterviewChoiceKey, string>,
    opening: fr ? 'J’ouvre la préparation.' : 'Opening readiness.',
    pause: fr ? 'Très bien. Dites « Question suivante » quand vous voulez continuer.' : 'Sounds good. Say “Next question” whenever you want to continue.',
    offline: fr
      ? 'L’IA n’est pas disponible ici (aucun modèle configuré, ou projet local sans modèle local), mais je peux continuer à vous guider. Dites « Question suivante » pour continuer.'
      : 'The AI isn’t available here (no model is configured, or the project is local-only without a local model), but I can keep guiding you. Say “Next question” to continue.',
    askAiPrompt: (q: Question) =>
      fr
        ? `Proposez une réponse concrète à « ${q.prompt.fr} » (${q.id}) à partir de ce que la spécification dit déjà, puis enregistrez-la avec propose_changes.`
        : `Suggest a concrete answer to “${q.prompt.en}” (${q.id}) using what the specification already says, then record it with propose_changes.`,
  };
}

const nextPhrases = ['next question', 'next', 'continue', 'question suivante', 'suivante', 'suivant', 'continuer'];
/** Whether typed text is a request to carry on with the interview rather than a message for the AI. */
export const isNextCommand = (text: string) => nextPhrases.includes(text.trim().toLowerCase().replace(/[.!]+$/, ''));
