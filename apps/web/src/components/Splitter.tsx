import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { rubberband, spring } from '../motion';

/**
 * Accessible panel divider: drag with a pointer, or focus it and use the arrow keys
 * (Shift for larger steps, Home/End for limits). Past a limit the handle gives a little, with growing
 * resistance, and springs back on release with the speed it was let go at: a soft edge, not a dead stop.
 */
export function Splitter({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  const start = useRef<{ x: number; value: number } | null>(null);
  const trail = useRef<{ x: number; t: number }[]>([]);
  const give = useMotionValue(0);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, value };
    trail.current = [{ x: e.clientX, t: e.timeStamp }];
    give.stop();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured; the drag still follows its moves.
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const wanted = start.current.value + e.clientX - start.current.x;
    const next = clamp(wanted);
    onChange(next);
    trail.current = [...trail.current.slice(-4), { x: e.clientX, t: e.timeStamp }];
    if (!reduce) give.set(rubberband(wanted - next, 120));
  };
  const release = () => {
    if (!start.current) return;
    start.current = null;
    const [first, last] = [trail.current[0], trail.current.at(-1)];
    const velocity =
      first && last && last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
    if (give.get() !== 0) animate(give, 0, { ...spring.momentum, velocity });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const next =
      e.key === 'ArrowLeft'
        ? value - step
        : e.key === 'ArrowRight'
          ? value + step
          : e.key === 'Home'
            ? min
            : e.key === 'End'
              ? max
              : null;
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next));
  };
  return (
    <motion.div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      style={{ x: give }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={onKeyDown}
    />
  );
}
