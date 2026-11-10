import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from './ui';
import { useL } from '../i18n';

export type TourStep = { target?: string; title: string; body: string };

/**
 * First-run guided tour. Each step highlights a region marked with `data-tour="…"` and explains
 * it; steps without a target are centred. Keyboard: ←/→ to move, Esc to close.
 */
export function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const l = useL();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[index];
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !step) return;
    const find = () => (step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null);
    // Scroll once per step; measuring must never scroll, or scroll events would loop.
    find()?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const measure = () => {
      const next = find()?.getBoundingClientRect() ?? null;
      setRect((prev) =>
        prev && next && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('scroll', measure, true);
    return () => {
      removeEventListener('resize', measure);
      removeEventListener('scroll', measure, true);
    };
  }, [open, step]);
  useEffect(() => {
    if (open) card.current?.focus();
  }, [open, index]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(steps.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, steps.length, onClose]);
  if (!open || !step) return null;
  const pad = 6;
  const below = rect ? rect.bottom + 180 < innerHeight : false;
  const cardStyle = rect
    ? {
        top: below ? rect.bottom + pad + 10 : Math.max(12, rect.top - pad - 10),
        left: Math.min(Math.max(12, rect.left), innerWidth - 372),
        transform: below ? undefined : 'translateY(-100%)',
      }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const last = index === steps.length - 1;
  return (
    <div className="tour" role="presentation">
      {rect ? (
        <div className="tour-highlight" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-backdrop" />
      )}
      <div ref={card} className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1} style={cardStyle}>
        <div className="tour-heading">
          <span className="muted small" aria-live="polite">
            {l(`Step ${index + 1} of ${steps.length}`, `Étape ${index + 1} sur ${steps.length}`)}
          </span>
          <Button variant="ghost" size="icon" aria-label={l('Close the tour', 'Fermer la visite')} onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-dots" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={i === index ? 'on' : ''} />
          ))}
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            {l('Skip tour', 'Passer la visite')}
          </Button>
          {index > 0 && (
            <Button onClick={() => setIndex(index - 1)}>
              <ArrowLeft size={14} /> {l('Back', 'Retour')}
            </Button>
          )}
          <Button variant="primary" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? l('Start working', 'Commencer') : l('Next', 'Suivant')} {!last && <ArrowRight size={14} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
