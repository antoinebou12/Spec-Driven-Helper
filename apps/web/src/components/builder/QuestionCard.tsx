import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Ban, Check, CircleHelp, Lightbulb, Send, SkipForward, Sparkles, Table2 } from 'lucide-react';
import { AnswerControl } from '../AnswerControl';
import { ProgressBar } from '../Progress';
import { Button, Modal } from '../ui';
import { CardShell } from './BuilderCards';
import { AnswerRecord } from './AnswerRecord';
import { useL, useLang, useLocalized } from '../../i18n';
import { isBlankValue } from '../../../../../packages/shared/src/domain';
import { answerSummary, sectionProgress, type InterviewResult } from '../../../../../packages/shared/src/interview';
import { tableKinds, type Question } from '../../../../../packages/shared/src/templates';
import type { Answer, Spec } from '../../../../../packages/shared/src/schema';
import '../../builder.css';

/**
 * One question of the guided interview as a conversation card: the prompt, why it is asked, and the
 * control that fits the question (chips, yes/no, slider, grid, text, or a table in a dialog), with
 * quick replies to skip, park it as unknown, mark it not applicable, or ask the AI. Answering saves
 * the person's own answer; the card then folds into the question and an answer bubble.
 */
type Save = { state: Answer['state']; value: string; reason: string };
export type QuestionCardProps = {
  question: Question | undefined;
  spec: Pick<Spec, 'sections'>;
  editable: boolean;
  aiAvailable: boolean;
  /** The tool result once the card was answered (also after a reload). */
  result?: InterviewResult | null;
  /** Saves the answer; false when it could not be saved (the person sees the conflict or error elsewhere). */
  onSave: (save: Save) => Promise<boolean>;
  onRespond: (result: InterviewResult) => void;
  onOpenEditor: () => void;
};

const sectionOf = (q: Question) => q.id.split('.')[0];

export function QuestionCard({ question, spec, editable, aiAvailable, result, onSave, onRespond, onOpenEditor }: QuestionCardProps) {
  const l = useL();
  const lang = useLang();
  const loc = useLocalized();
  const reduce = useReducedMotion();
  const current = question ? spec.sections.find((s) => s.id === sectionOf(question))?.answers[question.id] : undefined;
  const [value, setValue] = useState(current?.state === 'answered' ? current.value : '');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'answer' | 'not-applicable'>('answer');
  const [tableOpen, setTableOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const progress = useMemo(() => (question ? sectionProgress(spec as Spec, sectionOf(question)) : null), [spec, question]);
  useEffect(() => {
    if (!result) field.current?.focus({ preventScroll: true });
  }, [result]);

  if (result) return <AnswerRecord question={question} result={result} />;
  if (!question)
    return (
      <CardShell icon={<CircleHelp size={15} aria-hidden />} title={l('This question is no longer in the specification', 'Cette question ne fait plus partie de la spécification')}>
        <Button size="sm" variant="ghost" onClick={() => onRespond({ action: 'skipped', questionId: '' })}>
          {l('Continue', 'Continuer')}
        </Button>
      </CardShell>
    );

  const id = `q-${question.id}`;
  const respond = (action: InterviewResult['action'], extra: Partial<InterviewResult> = {}) => onRespond({ action, questionId: question.id, ...extra });
  const commit = async (save: Save, action: InterviewResult['action'], extra: Partial<InterviewResult> = {}) => {
    setBusy(true);
    setFailed(false);
    const ok = await onSave(save).catch(() => false);
    setBusy(false);
    if (ok) respond(action, extra);
    else setFailed(true);
  };
  const send = (next = value) => {
    if (busy || isBlankValue(next)) return;
    void commit({ state: 'answered', value: next, reason: '' }, 'answered', { value: next, summary: answerSummary(question, { state: 'answered', value: next }, lang) });
  };
  const structured = tableKinds.includes(question.kind);
  const canSend = !isBlankValue(value) && !busy;
  const options = question.options ?? [];

  return (
    <CardShell icon={<Sparkles size={15} aria-hidden />} title={loc(question.prompt)}>
      {progress && progress.total > 0 && (
        <div className="qcard-progress">
          <ProgressBar value={Math.round((progress.done / progress.total) * 100)} label={l(`Section progress: ${progress.done} of ${progress.total} required answers`, `Progression de la section : ${progress.done} sur ${progress.total} réponses obligatoires`)} />
          <small className="muted">
            {loc(question.label)} · {progress.done}/{progress.total}
            {question.required ? '' : ` · ${l('optional', 'facultative')}`}
          </small>
        </div>
      )}
      <details className="qcard-why">
        <summary>{l('Why we ask', 'Pourquoi cette question')}</summary>
        <p>{loc(question.explain)}</p>
        {question.example.en && (
          <p className="qcard-example">
            <Lightbulb size={13} aria-hidden /> <em>{loc(question.example)}</em>
            {question.kind === 'text' && editable && (
              <Button size="sm" variant="ghost" onClick={() => setValue(loc(question.example))}>
                {l('Use as a starting point', 'Utiliser comme point de départ')}
              </Button>
            )}
          </p>
        )}
      </details>

      {mode === 'not-applicable' ? (
        <form
          className="text-card-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) void commit({ state: 'not-applicable', value: '', reason: reason.trim() }, 'not-applicable', { reason: reason.trim() });
          }}
        >
          <label className="sr-only" htmlFor={`${id}-reason`}>
            {l('Why does this not apply?', 'Pourquoi cela ne s’applique-t-il pas ?')}
          </label>
          <input id={`${id}-reason`} value={reason} autoFocus onChange={(e) => setReason(e.target.value)} placeholder={l('Why does this not apply?', 'Pourquoi cela ne s’applique-t-il pas ?')} maxLength={500} />
          <div className="inline-actions">
            <Button size="sm" variant="primary" type="submit" disabled={!reason.trim() || busy}>
              <Check size={13} aria-hidden /> {l('Confirm', 'Confirmer')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('answer')}>
              {l('Back', 'Retour')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span id={`${id}-label`} className="sr-only">
            {loc(question.prompt)}
          </span>
          {question.kind === 'choice' && options.length > 0 && (
            <div className="choice-chips" role="group" aria-labelledby={`${id}-label`}>
              {options.map((o) => (
                <button key={o.en} type="button" className={`chip${value === o.en ? ' on' : ''}`} disabled={!editable || busy} aria-pressed={value === o.en} onClick={() => send(o.en)}>
                  {loc(o)}
                </button>
              ))}
            </div>
          )}
          {question.kind === 'switch' && (
            <div className="choice-chips" role="group" aria-labelledby={`${id}-label`}>
              {[
                ['yes', l('Yes', 'Oui')],
                ['no', l('No', 'Non')],
              ].map(([v, text]) => (
                <button key={v} type="button" className={`chip${value === v ? ' on' : ''}`} disabled={!editable || busy} aria-pressed={value === v} onClick={() => send(v)}>
                  {text}
                </button>
              ))}
            </div>
          )}
          {question.kind === 'text' && (
            <form
              className="text-card-form"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                ref={field}
                id={id}
                rows={3}
                value={value}
                disabled={!editable || busy}
                aria-labelledby={`${id}-label`}
                placeholder={l('Write your answer… (Enter to send, Shift+Enter for a new line)', 'Écrivez votre réponse… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)')}
                maxLength={30000}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button size="sm" variant="primary" type="submit" disabled={!canSend || !editable}>
                <Send size={13} aria-hidden /> {l('Send', 'Envoyer')}
              </Button>
            </form>
          )}
          {(question.kind === 'multi' || question.kind === 'slider' || question.kind === 'matrix') && (
            <>
              <AnswerControl id={id} question={question} value={value} disabled={!editable || busy} onChange={setValue} />
              <Button size="sm" variant="primary" disabled={!canSend || !editable} onClick={() => send()}>
                <Send size={13} aria-hidden /> {l('Send', 'Envoyer')}
              </Button>
            </>
          )}
          {structured && (
            <div className="inline-actions">
              <Button size="sm" variant="primary" disabled={!editable} onClick={() => setTableOpen(true)}>
                <Table2 size={13} aria-hidden /> {l('Fill in the table', 'Remplir le tableau')}
              </Button>
              {question.kind === 'requirements' && (
                <Button size="sm" variant="ghost" onClick={onOpenEditor}>
                  {l('Turn rows into traceable requirements', 'Transformer en exigences traçables')}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {failed && (
        <p className="error-text small" role="alert">
          {l('Your answer could not be saved. Check the message at the top of the page and try again.', 'Votre réponse n’a pas pu être enregistrée. Consultez le message en haut de la page et réessayez.')}
        </p>
      )}
      {mode === 'answer' && (
        <motion.div className="qcard-quick" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} role="group" aria-label={l('Other ways to answer', 'Autres façons de répondre')}>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => respond('skipped')}>
            <SkipForward size={13} aria-hidden /> {l('Skip for now', 'Passer pour l’instant')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy || !editable} onClick={() => void commit({ state: 'unknown', value: '', reason: '' }, 'unknown')}>
            <CircleHelp size={13} aria-hidden /> {l('Not sure yet', 'Pas encore sûr')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy || !editable} onClick={() => setMode('not-applicable')}>
            <Ban size={13} aria-hidden /> {l('Doesn’t apply', 'Ne s’applique pas')}
          </Button>
          {aiAvailable && editable && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => respond('ask-ai')}>
              <Sparkles size={13} aria-hidden /> {l('Suggest with AI', 'Suggérer avec l’IA')}
            </Button>
          )}
        </motion.div>
      )}

      {structured && (
        <Modal open={tableOpen} onOpenChange={setTableOpen} wide title={loc(question.prompt)}>
          <span id={`${id}-dialog-label`} className="sr-only">
            {loc(question.prompt)}
          </span>
          <AnswerControl id={`${id}-dialog`} question={question} value={value} disabled={busy} onChange={setValue} />
          <div className="inline-actions">
            <Button
              variant="primary"
              disabled={!canSend}
              onClick={() => {
                setTableOpen(false);
                send();
              }}
            >
              <Send size={14} aria-hidden /> {l('Send', 'Envoyer')}
            </Button>
            <Button variant="ghost" onClick={() => setTableOpen(false)}>
              {l('Cancel', 'Annuler')}
            </Button>
          </div>
        </Modal>
      )}
    </CardShell>
  );
}
