import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { Button, Modal } from './ui';
import { formatDate, useL, useLang } from '../i18n';

export type ExampleProject = { id: string; name: string; revision: number; updatedAt: string };

/** Administration: remove the projects created from the built-in example, after a confirmation. */
export function ExampleDataPanel({
  projects,
  onRemove,
}: {
  projects: ExampleProject[] | null;
  onRemove: () => Promise<{ removed: number }>;
}) {
  const l = useL();
  const lang = useLang();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const { removed } = await onRemove();
      setMessage(l(`${removed} example project${removed === 1 ? '' : 's'} removed.`, `${removed} projet${removed === 1 ? '' : 's'} d’exemple supprimé${removed === 1 ? '' : 's'}.`));
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" aria-labelledby="example-data-title">
      <h3 id="example-data-title">{l('Example data', 'Données d’exemple')}</h3>
      <p className="muted small">{l('Projects created from the built-in example. Removing them also removes their revisions, proposals, baselines, board, runs and files. The audit log is kept.', 'Projets créés à partir de l’exemple intégré. Les supprimer supprime aussi leurs révisions, propositions, références, tableau, exécutions et fichiers. Le journal d’audit est conservé.')}</p>
      {projects === null ? (
        <p className="muted">{l('Loading…', 'Chargement…')}</p>
      ) : projects.length ? (
        <ul className="plain-list">
          {projects.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>{' '}
              <span className="muted small">
                {l('revision', 'révision')} {p.revision} · {formatDate(p.updatedAt, lang)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{l('No example projects.', 'Aucun projet d’exemple.')}</p>
      )}
      {!!projects?.length && (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <Trash2 size={15} aria-hidden /> {l('Remove example projects', 'Supprimer les projets d’exemple')}
        </Button>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <Modal open={confirming} onOpenChange={setConfirming} title={l('Remove example projects?', 'Supprimer les projets d’exemple ?')}>
        <p>
          {l(`This permanently removes ${projects?.length ?? 0} project(s) and their data for everyone. It cannot be undone.`, `Cette action supprime définitivement ${projects?.length ?? 0} projet(s) et leurs données pour tout le monde. Elle est irréversible.`)}
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="inline-actions">
          <Button variant="danger" disabled={busy} onClick={remove}>
            {l('Remove', 'Supprimer')}
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            {l('Cancel', 'Annuler')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}

export default function ExampleData() {
  const [projects, setProjects] = useState<ExampleProject[] | null>(null);
  const reload = useCallback(() => api<ExampleProject[]>('/admin/example-projects').then(setProjects, () => setProjects([])), []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return (
    <ExampleDataPanel
      projects={projects}
      onRemove={async () => {
        const result = await api<{ removed: number }>('/admin/example-projects', 'DELETE', { confirm: true });
        await reload();
        return result;
      }}
    />
  );
}
