import { useMemo, useState } from 'react';
import { Send, Trophy } from 'lucide-react';
import { Button, Segmented } from '../ui';
import { useL } from '../../i18n';
import {
  rankOptions,
  type ComparisonVisual,
} from '../../../../../packages/shared/src/visual-answers';
import { Bar } from './VisualChart';

/** A weighted comparison: the person changes what matters and the ranking follows. */
const weightLabels = (l: (en: string, fr: string) => string) => [
  l('Ignore', 'Ignorer'),
  l('Low', 'Faible'),
  l('Medium', 'Moyen'),
  l('Critical', 'Critique'),
];

export function ComparisonView({
  v,
  onFollowUp,
}: {
  v: ComparisonVisual;
  onFollowUp?: (message: string) => void;
}) {
  const l = useL();
  const [weights, setWeights] = useState(() => v.criteria.map((c) => c.weight));
  const [view, setView] = useState<'ranking' | 'table'>('ranking');
  const ranking = useMemo(() => rankOptions(v, weights), [v, weights]);
  const leader = ranking[0];
  const tied = ranking.length > 1 && ranking[1].score === leader.score;
  const names = weightLabels(l);
  return (
    <div className="visual-body">
      <fieldset className="visual-weights">
        <legend>{l('What matters', 'Ce qui compte')}</legend>
        {v.criteria.map((c, i) => (
          <label key={c.name} className="visual-weight">
            <span>{c.name}</span>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={weights[i]}
              aria-valuetext={names[weights[i]]}
              style={{ ['--pct' as string]: `${(weights[i] / 3) * 100}%` }}
              onChange={(e) =>
                setWeights((w) => w.map((x, j) => (j === i ? Number(e.target.value) : x)))
              }
            />
            <output className="visual-weight-value">{names[weights[i]]}</output>
          </label>
        ))}
      </fieldset>
      <Segmented
        label={l('Show', 'Afficher')}
        value={view}
        onChange={(next) => setView(next as 'ranking' | 'table')}
        items={[
          { id: 'ranking', label: l('Ranking', 'Classement') },
          { id: 'table', label: l('Scores', 'Notes') },
        ]}
      />
      {view === 'ranking' ? (
        <ol className="visual-bars" aria-label={l('Weighted ranking', 'Classement pondéré')}>
          {ranking.map((r, i) => (
            <Bar
              key={r.option}
              label={r.option}
              value={r.score}
              max={100}
              display={`${r.score}/100`}
              lead={i === 0 && !tied}
            />
          ))}
        </ol>
      ) : (
        <div className="visual-table-wrap">
          <table className="visual-table">
            <caption className="sr-only">{v.title}</caption>
            <thead>
              <tr>
                <th scope="col">{l('Criterion', 'Critère')}</th>
                {v.options.map((o) => (
                  <th key={o} scope="col">
                    {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.criteria.map((c, ci) => (
                <tr key={c.name} className={weights[ci] === 0 ? 'ignored' : undefined}>
                  <th scope="row">
                    {c.name} <span className="muted small">· {names[weights[ci]]}</span>
                  </th>
                  {v.options.map((o, oi) => {
                    const cell = v.cells[ci][oi];
                    return (
                      <td key={o}>
                        <span
                          className="visual-score"
                          aria-label={l(`${cell.score} out of 5`, `${cell.score} sur 5`)}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <i key={n} className={n <= cell.score ? 'on' : undefined} aria-hidden />
                          ))}
                        </span>
                        {cell.note && <span className="visual-note small">{cell.note}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="visual-leader" aria-live="polite">
        <Trophy size={14} aria-hidden />{' '}
        {tied
          ? l(
              `Tied at ${leader.score}/100 — change a weight to separate them.`,
              `Égalité à ${leader.score}/100 — changez un poids pour les départager.`,
            )
          : l(
              `Best fit with these weights: ${leader.option} (${leader.score}/100).`,
              `Meilleur choix avec ces poids : ${leader.option} (${leader.score}/100).`,
            )}
      </p>
      {onFollowUp && !tied && (
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            onFollowUp(
              l(
                `Record ${leader.option} as our choice for “${v.title}”. What mattered: ${v.criteria.map((c, i) => `${c.name} (${names[weights[i]]})`).join(', ')}.`,
                `Notez ${leader.option} comme notre choix pour « ${v.title} ». Ce qui comptait : ${v.criteria.map((c, i) => `${c.name} (${names[weights[i]]})`).join(', ')}.`,
              ),
            )
          }
        >
          <Send size={13} aria-hidden />{' '}
          {l(`Record ${leader.option} as the decision`, `Retenir ${leader.option} comme décision`)}
        </Button>
      )}
    </div>
  );
}
