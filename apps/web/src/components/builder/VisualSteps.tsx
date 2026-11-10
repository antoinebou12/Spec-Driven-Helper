import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play, Send } from 'lucide-react';
import { Badge, Button } from '../ui';
import { useL } from '../../i18n';
import type { StepsVisual } from '../../../../../packages/shared/src/visual-answers';
import { enterFrom, spring } from '../../motion';

/** A walkthrough to step through or play (reduced motion: no slide, same steps). */
export function StepsView({
  v,
  onFollowUp,
}: {
  v: StepsVisual;
  onFollowUp?: (message: string) => void;
}) {
  const l = useL();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = v.steps.length - 1;
  useEffect(() => {
    if (!playing) return;
    if (index >= last) return setPlaying(false);
    const timer = setTimeout(() => setIndex((i) => Math.min(last, i + 1)), 2200);
    return () => clearTimeout(timer);
  }, [playing, index, last]);
  const step = v.steps[index];
  // Moving forward, the next step comes from the right; going back, from the left (the way it went).
  const previous = useRef(index);
  const direction = index >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = index;
  }, [index]);
  return (
    <div className="visual-body">
      <ol className="visual-steps">
        {v.steps.map((s, i) => (
          <li key={`${i}-${s.title}`}>
            <button
              type="button"
              className={i === index ? 'current' : i < index ? 'done' : undefined}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
            >
              <span className="visual-step-number" aria-hidden>
                {i + 1}
              </span>
              <span>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="visual-progress" aria-hidden>
        <span style={{ width: `${(index / Math.max(1, last)) * 100}%` }} />
      </div>
      <motion.div
        key={index}
        className="visual-step-detail"
        aria-live="polite"
        initial={enterFrom(reduce, { opacity: 0, x: 16 * direction })}
        animate={{ opacity: 1, x: 0 }}
        transition={spring.snappy}
      >
        <strong>
          {l(`Step ${index + 1} of ${v.steps.length}`, `Étape ${index + 1} sur ${v.steps.length}`)}{' '}
          · {step.title}
        </strong>
        {step.actor && <Badge tone="neutral">{step.actor}</Badge>}
        {step.detail && <p>{step.detail}</p>}
      </motion.div>
      <div className="inline-actions visual-controls">
        <Button
          size="sm"
          variant="ghost"
          disabled={index === 0}
          onClick={() => (setPlaying(false), setIndex((i) => Math.max(0, i - 1)))}
        >
          <ChevronLeft size={14} aria-hidden /> {l('Previous', 'Précédent')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (index >= last ? (setIndex(0), setPlaying(true)) : setPlaying((p) => !p))}
        >
          {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}{' '}
          {playing
            ? l('Pause', 'Pause')
            : index >= last
              ? l('Replay', 'Rejouer')
              : l('Play', 'Lecture')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={index === last}
          onClick={() => (setPlaying(false), setIndex((i) => Math.min(last, i + 1)))}
        >
          {l('Next', 'Suivant')} <ChevronRight size={14} aria-hidden />
        </Button>
      </div>
      {onFollowUp && (
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            onFollowUp(
              l(
                `Use these steps for “${v.title}”: ${v.steps.map((s, i) => `${i + 1}. ${s.title}`).join(' ')}`,
                `Utilisez ces étapes pour « ${v.title} » : ${v.steps.map((s, i) => `${i + 1}. ${s.title}`).join(' ')}`,
              ),
            )
          }
        >
          <Send size={13} aria-hidden />{' '}
          {l('Use these steps in the document', 'Utiliser ces étapes dans le document')}
        </Button>
      )}
    </div>
  );
}
