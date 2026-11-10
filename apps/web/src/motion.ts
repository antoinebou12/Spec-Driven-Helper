/**
 * Motion that feels physical (Apple's "Designing Fluid Interfaces", via the apple-design skill).
 * Springs instead of fixed durations, so motion starts from where things are and can be interrupted.
 * Apple's damping ratio and response map onto Motion's `bounce` (0 = critically damped) and `duration`.
 *
 * - `ui`: the default. No overshoot: things that appear or open just settle.
 * - `snappy`: small controls and quick state changes.
 * - `momentum`: only after a gesture that carried velocity (a release, a flick); a little bounce reads right there.
 */
export const spring = {
  ui: { type: 'spring', bounce: 0, duration: 0.4 },
  snappy: { type: 'spring', bounce: 0, duration: 0.3 },
  momentum: { type: 'spring', bounce: 0.2, duration: 0.4 },
} as const;

/**
 * Soft resistance past a boundary: the further past it, the less the element follows, and it never travels
 * more than `dimension`. Apple's rubber-band function (constant 0.55, as in UIScrollView).
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  if (!overshoot || dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Where a flick would come to rest, like scroll deceleration: pick the snap point nearest this, then hand the
 * release velocity to the spring. `velocity` in px/s; 0.998 feels like normal scrolling, 0.99 snappier.
 */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Initial state of an entrance: none under reduced motion (it simply appears), otherwise `from`. */
export const enterFrom = <T extends object>(reduce: boolean | null, from: T) =>
  reduce ? false : from;
