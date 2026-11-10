import { useState } from 'react';
import type { SpecVisual } from '../../../../packages/shared/src/spec-visualizer';
import { Button } from './ui';
import { useL } from '../i18n';
import './spec-visualizer.css';

export function SpecVisualizer({
  data,
  onSection,
  onPage,
  onImprove,
  busy = false,
}: {
  data: SpecVisual;
  onSection?: (id: string) => void;
  onPage?: (offset: number) => void;
  onImprove?: (id: string) => void;
  busy?: boolean;
}) {
  const l = useL();
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const section = data.sections.find((entry) => entry.id === selected);
  const items = data.items.filter((item) =>
    `${item.id} ${item.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const itemLabel = (id: string) => data.items.find((item) => item.id === id)?.title ?? id;
  return (
    <section
      className="spec-visualizer"
      aria-label={l('Specification visualizer', 'Visualiseur de spécification')}
    >
      <header>
        <h3>{data.name}</h3>
        <p>
          {l('Revision', 'Révision')} {data.revision} · {data.completeness}%{' '}
          {l('complete', 'complété')} ·{' '}
          {data.ready
            ? l('Ready for review', 'Prêt pour révision')
            : l('Work remaining', 'Travail restant')}
        </p>
      </header>
      <div className="spec-section-grid">
        {data.sections.map((entry) => (
          <Button
            key={entry.id}
            aria-pressed={entry.id === selected}
            onClick={() => setSelected(entry.id)}
          >
            <span>{entry.title}</span>
            <span>
              {entry.done}/{entry.total} {l('required', 'obligatoires')}
            </span>
            <progress
              aria-label={entry.title}
              value={entry.total ? entry.done / entry.total : 1}
              max={1}
            />
          </Button>
        ))}
      </div>
      {section && (
        <div className="spec-selection">
          <h4>{section.title}</h4>
          <p>
            {section.status === 'reviewed'
              ? l('Reviewed', 'Révisée')
              : l('Review pending', 'Révision en attente')}
          </p>
          <p>
            {section.missing.length
              ? `${l('Missing required answers', 'Réponses obligatoires manquantes')}: ${section.missing.join(', ')}`
              : l('Required answers recorded.', 'Réponses obligatoires consignées.')}
          </p>
          <div className="spec-actions">
            {onSection && (
              <Button disabled={busy} onClick={() => onSection(section.id)}>
                {l('Open section', 'Ouvrir la section')}
              </Button>
            )}
            {onImprove && (
              <Button disabled={busy} onClick={() => onImprove(section.id)}>
                {l('Improve with AI', 'Améliorer avec l’IA')}
              </Button>
            )}
          </div>
        </div>
      )}
      <details>
        <summary>
          {l('Readiness findings', 'Constats de préparation')} ({data.issueTotal})
        </summary>
        {data.issues.length ? (
          <ul>
            {data.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p>{l('No readiness findings.', 'Aucun constat de préparation.')}</p>
        )}
        {data.issueTotal > data.issues.length && (
          <p>
            {l(
              'Showing the first 24 findings. Open Readiness for the full list.',
              'Les 24 premiers constats sont affichés. Ouvrez Préparation pour la liste complète.',
            )}
          </p>
        )}
      </details>
      <h4>{l('Recorded relationships', 'Relations consignées')}</h4>
      <label>
        {l('Filter this page', 'Filtrer cette page')}
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="spec-item-grid">
        {items.map((item) => (
          <article key={item.id}>
            <strong>{item.id}</strong>
            <p>{item.title}</p>
          </article>
        ))}
      </div>
      {!items.length && (
        <p>
          {l(
            'No items on this page match the filter.',
            'Aucun élément de cette page ne correspond au filtre.',
          )}
        </p>
      )}
      <ul className="spec-relationships">
        {data.links
          .filter((link) => items.some((item) => item.id === link.from || item.id === link.to))
          .map((link, i) => (
            <li key={i}>
              <span>{itemLabel(link.from)}</span>
              <span aria-hidden="true"> → </span>
              <code>{link.kind}</code>
              <span aria-hidden="true"> → </span>
              <span>{itemLabel(link.to)}</span>
            </li>
          ))}
      </ul>
      <p>
        {l(
          'Only recorded links between items on this page are shown.',
          'Seuls les liens consignés entre les éléments de cette page sont affichés.',
        )}{' '}
        {data.links.length}/{data.linkTotal}
      </p>
      <div className="spec-actions">
        {onPage && (
          <>
            <Button
              disabled={busy || data.offset === 0}
              onClick={() => onPage(Math.max(0, data.offset - 24))}
            >
              {l('Previous', 'Précédent')}
            </Button>
            <Button
              disabled={busy || data.nextOffset === null}
              onClick={() => onPage(data.nextOffset!)}
            >
              {l('Next', 'Suivant')}
            </Button>
          </>
        )}
        <span>
          {data.total ? data.offset + 1 : 0}–{Math.min(data.offset + 24, data.total)} / {data.total}
        </span>
      </div>
    </section>
  );
}
