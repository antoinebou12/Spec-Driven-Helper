import { MessageCircleQuestion, Sparkles } from 'lucide-react';
import { CardShell } from './BuilderCards';
import { useL, useLang, useLocalized } from '../../i18n';
import { answerSummary, type InterviewChoiceKey, type InterviewResult } from '../../../../../packages/shared/src/interview';
import type { Question } from '../../../../../packages/shared/src/templates';
import '../../builder.css';

/** What is left of a card once it was answered: the question and the person's answer as two bubbles. */
export function AnswerRecord({ question, result }: { question: Question | undefined; result: InterviewResult }) {
  const l = useL();
  const lang = useLang();
  const loc = useLocalized();
  if (result.action === 'navigated') return null;
  const said =
    result.action === 'answered'
      ? (result.summary ?? (question && result.value !== undefined ? answerSummary(question, { state: 'answered', value: result.value }, lang) : ''))
      : result.action === 'skipped'
        ? l('Skipped for now', 'Passée pour l’instant')
        : result.action === 'unknown'
          ? l('Unknown for now', 'Inconnu pour l’instant')
          : result.action === 'ask-ai'
            ? l('Asked the AI for a suggestion', 'Suggestion demandée à l’IA')
            : `${l('Does not apply', 'Ne s’applique pas')}${result.reason ? `: ${result.reason}` : ''}`;
  return (
    <div className="qa-record">
      <p className="qa-question">
        <MessageCircleQuestion size={13} aria-hidden /> {question ? loc(question.prompt) : result.questionId}
      </p>
      <p className="qa-answer" data-action={result.action}>
        {said}
      </p>
    </div>
  );
}

/** The wrap-up question of the interview (go back to skipped questions, open readiness, …) as buttons. */
export function InterviewChoiceCard({
  options,
  result,
  onPick,
}: {
  options: { key: InterviewChoiceKey; label: string }[];
  result?: { key: InterviewChoiceKey; label?: string } | null;
  onPick: (key: InterviewChoiceKey, label: string) => void;
}) {
  const l = useL();
  if (result) {
    const picked = options.find((o) => o.key === result.key)?.label ?? result.label ?? '';
    return (
      <div className="qa-record">
        <p className="qa-answer" data-action="choice">
          {picked}
        </p>
      </div>
    );
  }
  return (
    <CardShell icon={<Sparkles size={15} aria-hidden />} title={l('What next?', 'Et maintenant ?')}>
      <div className="choice-chips" role="group" aria-label={l('What next?', 'Et maintenant ?')}>
        {options.map((o) => (
          <button key={o.key} type="button" className="chip" onClick={() => onPick(o.key, o.label)}>
            {o.label}
          </button>
        ))}
      </div>
    </CardShell>
  );
}
