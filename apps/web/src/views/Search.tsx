import { useState } from 'react';
import { api } from '../api';
import { Button } from '../components/ui';
import { useL, useLocalized } from '../i18n';
import type { ProjectState } from '../state';
import { can } from '../../../../packages/shared/src/domain';
import { modules } from '../../../../packages/shared/src/templates';
import { ArrowRight, Search as SearchIcon } from 'lucide-react';

type SearchResult = { section_id: string; title: string; excerpt: string; revision: number };

export default function Search({
  project,
  go,
}: {
  project: ProjectState;
  go: (view: string, target: { sectionId: string }) => void;
}) {
  const l = useL();
  const loc = useLocalized();
  const [query, setQuery] = useState('');
  const [semantic, setSemantic] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="form-stack project-search">
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!query.trim() || busy) return;
          setBusy(true);
          setMessage('');
          setError('');
          setResults(null);
          try {
            const response = await api<{ results: SearchResult[] }>(
              `/projects/${project.spec!.id}/search?q=${encodeURIComponent(query.trim())}&semantic=${semantic}`,
            );
            setResults(response.results);
            setMessage(
              response.results.length
                ? l(
                    `${response.results.length} matching sections`,
                    `${response.results.length} sections trouvées`,
                  )
                : l('No matching sections.', 'Aucune section trouvée.'),
            );
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {l('Search all document sections', 'Rechercher dans toutes les sections')}
          <input
            type="search"
            value={query}
            required
            maxLength={500}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="inline-actions">
          <label className="check-label">
            <input
              type="checkbox"
              checked={semantic}
              disabled={busy}
              onChange={(e) => setSemantic(e.target.checked)}
            />
            {l('Search by meaning', 'Recherche par sens')}
          </label>
          <Button type="submit" variant="primary" disabled={busy || !query.trim()}>
            <SearchIcon size={16} aria-hidden />
            {busy ? l('Searching…', 'Recherche…') : l('Search', 'Rechercher')}
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <p role="status" className="muted small">
        {message}
      </p>
      {results && (
        <ul className="search-results" aria-label={l('Matching sections', 'Sections trouvées')}>
          {results.map((result) => {
            const module = modules.find((m) => m.id === result.section_id);
            return (
              <li key={result.section_id}>
                <Button
                  variant="ghost"
                  onClick={() => go('specification', { sectionId: result.section_id })}
                >
                  {module ? loc(module.title) : result.title}
                  <ArrowRight size={15} aria-hidden />
                </Button>
                <p>{result.excerpt}</p>
                <small className="muted">
                  {l('Revision', 'Révision')} {result.revision}
                </small>
              </li>
            );
          })}
        </ul>
      )}
      {can(project.role, 'edit') && (
        <details className="compact-details">
          <summary>{l('Semantic index', 'Index sémantique')}</summary>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              setMessage('');
              try {
                const response = await api<{ indexed: number }>(
                  `/projects/${project.spec!.id}/search/index`,
                  'POST',
                );
                setMessage(
                  l(
                    `Indexed ${response.indexed} sections.`,
                    `${response.indexed} sections indexées.`,
                  ),
                );
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {l('Rebuild index', 'Reconstruire l’index')}
          </Button>
        </details>
      )}
    </div>
  );
}
