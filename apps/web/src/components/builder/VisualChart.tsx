import { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Segmented } from '../ui';
import { useL, useLang } from '../../i18n';
import type { ChartVisual } from '../../../../../packages/shared/src/visual-answers';
import { spring } from '../../motion';

/** A bar chart with values in text, an optional limit, and a table view. */
export function ChartView({ v }: { v: ChartVisual }) {
  const l = useL();
  const lang = useLang();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const format = useMemo(
    () => new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 2 }),
    [lang],
  );
  const unit = v.unit ? ` ${v.unit}` : '';
  const max = Math.max(...v.bars.map((b) => b.value), v.target ?? 0) * 1.08 || 1;
  return (
    <div className="visual-body">
      <Segmented
        label={l('Show', 'Afficher')}
        value={view}
        onChange={(next) => setView(next as 'chart' | 'table')}
        items={[
          { id: 'chart', label: l('Chart', 'Graphique') },
          { id: 'table', label: l('Table', 'Tableau') },
        ]}
      />
      {view === 'chart' ? (
        <div className="visual-chart">
          <ol className="visual-bars" aria-label={v.title}>
            {v.bars.map((b) => (
              <Bar
                key={b.label}
                label={b.label}
                value={b.value}
                max={max}
                display={`${format.format(b.value)}${unit}`}
                over={v.target !== undefined && b.value > v.target}
                overLabel={l('above the limit', 'au-dessus de la limite')}
                mark={v.target !== undefined ? (v.target / max) * 100 : undefined}
              />
            ))}
          </ol>
          {v.target !== undefined && (
            <p className="visual-target small">
              <span className="visual-target-swatch" aria-hidden />
              {v.targetLabel || l('Limit', 'Limite')}: {format.format(v.target)}
              {unit}
            </p>
          )}
        </div>
      ) : (
        <div className="visual-table-wrap">
          <table className="visual-table">
            <caption className="sr-only">{v.title}</caption>
            <thead>
              <tr>
                <th scope="col">{l('Item', 'Élément')}</th>
                <th scope="col">{v.unit || l('Value', 'Valeur')}</th>
              </tr>
            </thead>
            <tbody>
              {v.bars.map((b) => (
                <tr key={b.label}>
                  <th scope="row">{b.label}</th>
                  <td>{format.format(b.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** One labelled bar: name, a single-hue bar from the baseline, and its value in text (never colour alone). */
export function Bar({
  label,
  value,
  max,
  display,
  lead,
  over,
  overLabel,
  mark,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  lead?: boolean;
  over?: boolean;
  overLabel?: string;
  mark?: number;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <li
      className={`visual-bar${lead ? ' lead' : ''}`}
      tabIndex={0}
      aria-labelledby={id}
      title={`${label}: ${display}`}
    >
      <span id={id} className="visual-bar-label">
        {label}
        <span className="sr-only">
          : {display}
          {over && overLabel ? `, ${overLabel}` : ''}
        </span>
      </span>
      <span className="visual-bar-track" aria-hidden>
        <motion.span
          className="visual-bar-fill"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={spring.ui}
        />
        {mark !== undefined && <span className="visual-bar-mark" style={{ left: `${mark}%` }} />}
      </span>
      <span className="visual-bar-value" aria-hidden>
        {display}
        {over && <em> · {overLabel}</em>}
      </span>
    </li>
  );
}
