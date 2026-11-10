import { useState } from 'react';
import { Network } from 'lucide-react';
import { api } from '../api';
import { useL } from '../i18n';
import { Button } from './ui';
import type { ProjectState } from '../state';
import { sectionEvidenceDiagram } from '../../../../packages/shared/src/document-diagrams';

export function DiagramBatch({ project, sectionId }: { project: ProjectState; sectionId: string }) {
  const l = useL();
  const [scope, setScope] = useState('section');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ id: string; text: string; error: boolean }[]>([]);
  const spec = project.spec!;
  async function generate() {
    setBusy(true);
    setResults([]);
    const selected = spec.sections.filter(
      (s) => !s.diagram && (scope === 'all' || s.id === sectionId),
    );
    try {
      for (const section of selected) {
        try {
          if (!sectionEvidenceDiagram(spec, section.id)) {
            setResults((r) => [
              ...r,
              {
                id: section.id,
                text: l('No recorded answers', 'Aucune réponse consignée'),
                error: false,
              },
            ]);
            continue;
          }
          const result = await api<{ status: string }>(
            `/projects/${spec.id}/diagrams/evidence`,
            'POST',
            { sectionId: section.id, baseRevision: spec.revision, confirm: true },
          );
          const text =
            result.status === 'pending'
              ? l('Awaiting review', 'À réviser')
              : result.status === 'rejected'
                ? l('Previously rejected', 'Déjà rejeté')
                : result.status === 'empty'
                  ? l('No recorded answers', 'Aucune réponse consignée')
                  : l('Already generated', 'Déjà généré');
          setResults((r) => [...r, { id: section.id, text, error: false }]);
        } catch (error) {
          setResults((r) => [
            ...r,
            { id: section.id, text: (error as Error).message, error: true },
          ]);
          // Stop the batch on an unavailable service, permission or revision error.
          break;
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="diagram-batch">
      <summary>{l('Generate', 'Générer')}</summary>
      <div className="form-stack">
        <p className="muted small">
          {l(
            'Recorded answers are sent to your configured MCP renderer. Evidence maps await review in Proposals.',
            'Les réponses consignées sont envoyées au moteur MCP configuré. Les cartes attendent votre révision dans Propositions.',
          )}
        </p>
        <label>
          {l('Documents', 'Documents')}
          <select value={scope} disabled={busy} onChange={(e) => setScope(e.target.value)}>
            <option value="section">{sectionId}.md</option>
            <option value="all">
              {l('All missing diagrams', 'Tous les diagrammes manquants')}
            </option>
          </select>
        </label>
        <Button
          disabled={
            busy ||
            spec.localOnly ||
            (scope === 'section' && !!spec.sections.find((s) => s.id === sectionId)?.diagram)
          }
          onClick={generate}
        >
          <Network size={16} aria-hidden />
          {busy ? l('Rendering…', 'Rendu…') : l('Generate', 'Générer')}
        </Button>
        {spec.localOnly && (
          <p className="muted small">
            {l(
              'External rendering is disabled for local-only projects.',
              'Le rendu externe est désactivé pour les projets locaux.',
            )}
          </p>
        )}
        <ul className="diagram-results" aria-live="polite">
          {results.map((r) => (
            <li key={r.id} className={r.error ? 'error-text' : ''}>
              <strong>{r.id}.md</strong>: {r.text}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
