/** Circular progress indicator exposed to assistive technology as a progress bar. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  label,
  tone = 'accent',
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  tone?: 'accent' | 'green' | 'amber';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className={`progress-ring ${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-ring-value" style={{ fontSize: size / 4.2 }}>
        {clamped}%
      </span>
    </div>
  );
}

/** Thin horizontal bar with an accessible label. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}
