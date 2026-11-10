import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import type { OpenSpecDiagnostic } from '../../../../packages/shared/src/openspec-format';
import { api } from '../api';
import { useL } from '../i18n';
import { Button } from './ui';
import { OpenSpecDiagnostics } from './OpenSpecExchange';

export function OpenSpecExport({ projectId }: { projectId: string }) {
  const l = useL();
  const [report, setReport] = useState<{
    revision: number;
    draft: boolean;
    diagnostics: OpenSpecDiagnostic[];
  } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api(`/projects/${projectId}/openspec`)
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [projectId]);
  return (
    <div className="form-stack" aria-live="polite">
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {report ? (
        <>
          <p className="muted small">
            {report.draft
              ? l(
                  'Draft. Resolve diagnostics before CLI validation.',
                  'Brouillon. Résolvez les diagnostics avant validation CLI.',
                )
              : l(
                  'Snapshot. CLI validation has not been run.',
                  'Instantané. La validation CLI n’a pas été exécutée.',
                )}
          </p>
          <OpenSpecDiagnostics diagnostics={report.diagnostics} />
          <Button asChild>
            <a
              href={`/api/v1/projects/${projectId}/export/openspec?expectedRevision=${report.revision}`}
              download
            >
              <Download size={16} aria-hidden /> {l('Download', 'Télécharger')}
            </a>
          </Button>
        </>
      ) : (
        !error && <p role="status">{l('Checking…', 'Vérification…')}</p>
      )}
    </div>
  );
}
