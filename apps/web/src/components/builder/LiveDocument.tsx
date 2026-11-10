import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { ChevronDown, ExternalLink, MessageCircle, Pencil } from 'lucide-react';
import { AnswerControl } from '../AnswerControl';
import { ProgressRing } from '../Progress';
import { Badge, Button } from '../ui';
import { useL, useLang, useLocalized } from '../../i18n';
import { answerStatus } from '../../../../../packages/shared/src/domain';
import { answerSummary } from '../../../../../packages/shared/src/interview';
import { moduleQuestions, modules, type Question } from '../../../../../packages/shared/src/templates';
import type { Answer, Spec, SpecPatch } from '../../../../../packages/shared/src/schema';
import { enterFrom, spring } from '../../motion';
import '../../builder.css';

/**
 * The document as it grows: one card per module with its progress, opening in place to show and
 * edit answers. Answers that change (from the user, an accepted proposal or another author) glow
 * briefly so the effect of the conversation is visible. Motion follows "reduce motion".
 */
const inlineKinds = new Set(['text', 'choice', 'multi', 'switch', 'slider']);

/** Keys (`questionId`) whose answer changed since the previous revision. */
function useChangedAnswers(spec: Spec) {
  const previous = useRef<Map<string, string> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    const now = new Map(spec.sections.flatMap((s) => Object.entries(s.answers).map(([id, a]) => [id, `${a.state}:${a.value}`] as const)));
    const before = previous.current;
    previous.current = now;
    if (!before) return;
    const diff = new Set([...now].filter(([id, v]) => before.get(id) !== v).map(([id]) => id));
    if (!diff.size) return;
    setChanged(diff);
    const timer = setTimeout(() => setChanged(new Set()), 2600);
    return () => clearTimeout(timer);
  }, [spec]);
  return changed;
}

/** A card that leans towards the pointer (a light 3D effect), flat when motion is reduced. */
function TiltCard({ children, className, highlight }: { children: React.ReactNode; className: string; highlight: boolean }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0),
    y = useMotionValue(0);
  // Follows the pointer and settles without wobbling: the pointer carries no momentum to release.
  const follow = { bounce: spring.snappy.bounce, duration: spring.snappy.duration };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [3, -3]), follow);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-4, 4]), follow);
  const move = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const box = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - box.left) / box.width - 0.5);
    y.set((e.clientY - box.top) / box.height - 0.5);
  };
  return (
    <motion.li
      layout={!reduce}
      className={`${className}${highlight ? ' glow' : ''}`}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={move}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      initial={enterFrom(reduce, { opacity: 0, y: 12 })}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.ui}
    >
      {children}
    </motion.li>
  );
}

function QuestionRow({
  question,
  answer,
  sectionId,
  editable,
  glow,
  onSave,
  onAnswer,
  onOpen,
}: {
  question: Question;
  answer?: Answer;
  sectionId: string;
  editable: boolean;
  glow: boolean;
  onSave: (patch: SpecPatch, label: string) => Promise<unknown>;
  onAnswer: (question: Question) => void;
  onOpen: (sectionId: string, questionId: string) => void;
}) {
  const l = useL();
  const lang = useLang();
  const loc = useLocalized();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  // Opening the editor moves focus into it, so typing starts right away.
  useEffect(() => {
    if (editing) requestAnimationFrame(() => (document.getElementById(`live-${question.id}`) as HTMLElement | null)?.focus());
  }, [editing, question.id]);
  const status = answerStatus(answer);
  const preview = answerSummary(question, answer, lang);
  const inputId = `live-${question.id}`;
  return (
    <li className={`live-question ${status}${glow ? ' glow' : ''}`}>
      <div className="live-question-head">
        <span className={`dot ${status}`} aria-hidden />
        <span className="live-question-label">
          {loc(question.label)}
          {question.required && <span className="sr-only"> ({l('required', 'obligatoire')})</span>}
          {question.required && status !== 'answered' && status !== 'na' && (
            <Badge tone="amber">{l('required', 'obligatoire')}</Badge>
          )}
        </span>
        <span className="live-question-actions">
          <Button size="sm" variant="ghost" aria-label={`${l('Answer in chat', 'Répondre dans le chat')}: ${loc(question.label)}`} onClick={() => onAnswer(question)}>
            <MessageCircle size={13} aria-hidden /> {l('Answer in chat', 'Répondre dans le chat')}
          </Button>
          {editable &&
            (inlineKinds.has(question.kind) ? (
              <Button size="sm" variant="ghost" aria-label={`${l('Edit', 'Modifier')} ${loc(question.label)}`} aria-expanded={draft !== null} onClick={() => setDraft(draft === null ? (status === 'answered' ? answer!.value : '') : null)}>
                <Pencil size={13} aria-hidden /> {l('Edit', 'Modifier')}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" aria-label={`${l('Open', 'Ouvrir')} ${loc(question.label)}`} onClick={() => onOpen(sectionId, question.id)}>
                <ExternalLink size={13} aria-hidden /> {l('Open', 'Ouvrir')}
              </Button>
            ))}
        </span>
      </div>
      {preview && draft === null && <p className="live-answer">{preview}</p>}
      <AnimatePresence initial={false}>
        {draft !== null && (
          <motion.form
            className="live-edit"
            // Height only: fading the field would drop its text contrast while it opens and closes.
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const saved = await onSave({ sections: [{ id: sectionId, answers: { [question.id]: { value: draft, state: 'answered', reason: '' } } }] }, loc(question.label));
              if (saved) setDraft(null);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              {loc(question.label)}
            </label>
            <AnswerControl id={inputId} question={question} value={draft} onChange={setDraft} />
            <div className="inline-actions">
              <Button size="sm" variant="primary" type="submit">
                {l('Save', 'Enregistrer')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                {l('Cancel', 'Annuler')}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </li>
  );
}

export function LiveDocument({
  spec,
  editable,
  focus,
  onFocus,
  onSave,
  onAnswer,
  onOpen,
}: {
  spec: Spec;
  editable: boolean;
  focus: string | null;
  onFocus: (sectionId: string | null) => void;
  onSave: (patch: SpecPatch, label: string) => Promise<unknown>;
  /** Asks the question in the conversation, as a card. */
  onAnswer: (question: Question, sectionId: string) => void;
  onOpen: (sectionId: string, questionId: string) => void;
}) {
  const l = useL();
  const loc = useLocalized();
  const reduce = useReducedMotion();
  const changed = useChangedAnswers(spec);
  return (
    <ul className="live-document" aria-label={l('Document sections', 'Sections du document')}>
      {modules.map((m) => {
        const section = spec.sections.find((s) => s.id === m.id)!;
        const questions = moduleQuestions(m, spec);
        const required = questions.filter((q) => q.required);
        const done = required.filter((q) => ['answered', 'na'].includes(answerStatus(section.answers[q.id]))).length;
        const percent = required.length ? Math.round((done / required.length) * 100) : 100;
        const open = focus === m.id;
        const glowing = questions.some((q) => changed.has(q.id));
        const panelId = `live-panel-${m.id}`;
        return (
          <TiltCard key={m.id} className={`live-section${open ? ' open' : ''}`} highlight={glowing}>
            <button type="button" className="live-section-head" aria-expanded={open} aria-controls={panelId} onClick={() => onFocus(open ? null : m.id)}>
              <span aria-hidden>
                <ProgressRing value={percent} size={44} stroke={4} label={l(`${loc(m.title)}: ${percent}% of required answers`, `${loc(m.title)} : ${percent} % des réponses obligatoires`)} />
              </span>
              <span className="live-section-title">
                <strong>{loc(m.title)}</strong>
                <small className="muted">
                  {l(`${done} of ${required.length} required`, `${done} sur ${required.length} obligatoires`)}
                  {section.status === 'reviewed' && ` · ${l('reviewed', 'révisée')}`}
                </small>
              </span>
              <ChevronDown size={16} aria-hidden className="chevron" />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div id={panelId} className="live-section-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : spring.snappy}>
                  <ul className="live-questions">
                    {questions.map((q) => (
                      <QuestionRow key={q.id} question={q} answer={section.answers[q.id]} sectionId={m.id} editable={editable} glow={changed.has(q.id)} onSave={onSave} onAnswer={(question) => onAnswer(question, m.id)} onOpen={onOpen} />
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </TiltCard>
        );
      })}
    </ul>
  );
}
