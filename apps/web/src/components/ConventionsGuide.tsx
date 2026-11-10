import { useId, useState } from 'react';
import { BookMarked, ExternalLink, FolderTree } from 'lucide-react';
import { Badge } from './ui';
import { useL, useLocalized } from '../i18n';
import {
  caseStyles,
  conventionElements,
  detectCase,
  elementLabels,
  toCase,
  type LanguageConventions,
} from '../../../../packages/shared/src/conventions';

/** Naming and folder conventions for the languages in the stack, with a name converter. */
export function ConventionsGuide({ languages }: { languages: LanguageConventions[] }) {
  const l = useL();
  const loc = useLocalized();
  const id = useId();
  const [selected, setSelected] = useState(languages[0]?.id);
  const [name, setName] = useState('order history item');
  const language = languages.find((x) => x.id === selected) ?? languages[0];
  if (!language) return null;
  const detected = detectCase(name.trim());
  return (
    <section className="card conventions-guide" aria-labelledby={`${id}-title`}>
      <header className="license-check-header">
        <h3 id={`${id}-title`}>
          <BookMarked size={18} aria-hidden /> {l('Naming and folder conventions', 'Conventions de nommage et de dossiers')}
        </h3>
        <div className="filter-chips" role="group" aria-label={l('Language', 'Langage')}>
          {languages.map((x) => (
            <button key={x.id} type="button" aria-pressed={x.id === language.id} className={x.id === language.id ? 'active' : ''} onClick={() => setSelected(x.id)}>
              {x.name}
            </button>
          ))}
        </div>
      </header>
      <p className="muted small">
        {l(
          'Suggested from the stack and each community’s reference guide. “Fill empty answers” above copies them into the naming and repository-structure questions when those are empty.',
          'Suggérées d’après la pile et le guide de référence de chaque communauté. « Remplir les réponses vides » ci-dessus les copie dans les questions de nommage et de structure lorsqu’elles sont vides.',
        )}
      </p>
      <div className="conventions-body">
        <div className="table-scroll" tabIndex={0} role="region" aria-label={l('Naming conventions table', 'Tableau des conventions de nommage')}>
          <table className="data-table">
            <caption className="sr-only">{l(`${language.name} naming`, `Nommage ${language.name}`)}</caption>
            <thead>
              <tr>
                <th scope="col">{l('Element', 'Élément')}</th>
                <th scope="col">{l('Convention', 'Convention')}</th>
                <th scope="col">{l('Example', 'Exemple')}</th>
              </tr>
            </thead>
            <tbody>
              {conventionElements.map((element) => (
                <tr key={element}>
                  <th scope="row">{loc(elementLabels[element])}</th>
                  <td>{language.rules[element].style}</td>
                  <td>
                    <code>{language.rules[element].example}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="conventions-side">
          <h4>
            <FolderTree size={16} aria-hidden /> {l('Folder structure', 'Structure des dossiers')}
          </h4>
          <pre className="folder-tree">{language.layout}</pre>
          <p className="small">
            {language.tools.map((t) => (
              <Badge key={t} tone="neutral">
                {t}
              </Badge>
            ))}
          </p>
          <p className="muted small">{loc(language.notes)}</p>
          <a href={language.reference.url} target="_blank" rel="noreferrer" className="small">
            {language.reference.title} <ExternalLink size={12} aria-hidden />
            <span className="sr-only"> {l('(opens in a new tab)', '(s’ouvre dans un nouvel onglet)')}</span>
          </a>
        </div>
      </div>
      <div className="case-converter">
        <label htmlFor={`${id}-name`}>{l('Try a name', 'Essayez un nom')}</label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} />
        <span className="muted small" aria-live="polite">
          {detected ? l(`Written in ${detected}`, `Écrit en ${detected}`) : l('Mixed or plain words', 'Mots simples ou styles mélangés')}
        </span>
        <ul className="case-list">
          {caseStyles.map((style) => (
            <li key={style}>
              <span className="muted small">{style}</span>
              <code>{toCase(name, style) || '—'}</code>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
