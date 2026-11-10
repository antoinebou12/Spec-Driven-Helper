import { lazy, Suspense, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { Button, Modal } from './ui';
import { useL, useLang } from '../i18n';
import { describePath, displayValue } from '../paths';
import type { PendingConflict } from '../state';

const DiffView = lazy(() => import('./Editors').then((m) => ({ default: m.DiffView })));

/**
 * Shown when a save was based on an older revision. Nothing is overwritten until the author
 * explicitly chooses: keep the latest version, or re-apply their change on top of it.
 */
export function ConflictDialog({
  conflict,
  onResolve,
}: {
  conflict: PendingConflict | null;
  onResolve: (choice: 'discard' | 'reapply') => void;
}) {
  const l = useL();
  const lang = useLang();
  const [diff, setDiff] = useState<string | null>(null);
  if (!conflict) return null;
  const { info } = conflict;
  return (
    <Modal
      open
      wide
      onOpenChange={() => {}}
      title={l('This specification changed while you were editing', 'Cette spécification a changé pendant votre modification')}
      description={l(
        `Your change was based on revision ${info.baseRevision}; revision ${info.currentRevision} is now current. Nothing has been overwritten.`,
        `Votre modification partait de la révision ${info.baseRevision} ; la révision ${info.currentRevision} est maintenant courante. Rien n’a été écrasé.`,
      )}
    >
      {info.overlapping && info.conflicts.length ? (
        <div className="conflict-list">
          <p>
            {l(
              'Someone else changed the same fields. Compare both versions before deciding.',
              'Quelqu’un d’autre a modifié les mêmes champs. Comparez les deux versions avant de décider.',
            )}
          </p>
          {info.conflicts.map((c) => {
            const current = displayValue(c.path, c.current, lang);
            const yours = displayValue(c.path, c.yours, lang);
            return (
              <section key={c.path} className="conflict">
                <h3>{describePath(c.path, lang)}</h3>
                <div className="compare">
                  <div>
                    <strong>{l('Latest saved version', 'Dernière version enregistrée')}</strong>
                    <pre>{current || l('(empty)', '(vide)')}</pre>
                  </div>
                  <div>
                    <strong>{l('Your change', 'Votre modification')}</strong>
                    <pre>{yours || l('(empty)', '(vide)')}</pre>
                  </div>
                </div>
                {diff === c.path ? (
                  <Suspense fallback={<p className="muted">{l('Loading comparison…', 'Chargement de la comparaison…')}</p>}>
                    <DiffView original={current} modified={yours} label={describePath(c.path, lang)} />
                  </Suspense>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setDiff(c.path)}>
                    <GitCompare size={14} /> {l('Show line differences', 'Afficher les différences')}
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <p>
          {l(
            'The newer edits touch different fields than yours. You can safely re-apply your change on the latest revision.',
            'Les modifications récentes portent sur d’autres champs que les vôtres. Vous pouvez réappliquer votre modification sur la dernière révision.',
          )}
        </p>
      )}
      <div className="modal-actions">
        <Button onClick={() => onResolve('discard')}>{l('Keep the latest version', 'Garder la dernière version')}</Button>
        <Button variant={info.overlapping ? 'danger' : 'primary'} onClick={() => onResolve('reapply')}>
          {info.overlapping
            ? l('Replace with my version', 'Remplacer par ma version')
            : l('Re-apply my change', 'Réappliquer ma modification')}
        </Button>
      </div>
    </Modal>
  );
}
