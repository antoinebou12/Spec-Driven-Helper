import { useState } from 'react';
import { Eye, FileInput, FolderOpen, ListChecks } from 'lucide-react';
import type { OpenSpecDiagnostic } from '../../../../packages/shared/src/openspec-format';
import { columnLabels, type Card } from '../../../../packages/shared/src/board';
import type { SpecPatch } from '../../../../packages/shared/src/schema';
import { readOpenSpecSelection } from '../openspec-files';
import { api } from '../api';
import { useL } from '../i18n';
import { Button } from './ui';
import { SourceDocuments } from './SourceDocuments';

export function OpenSpecDiagnostics({ diagnostics }: { diagnostics: OpenSpecDiagnostic[] }) {
  const l = useL();
  return diagnostics.length ? (
    <details open={diagnostics.some((d) => d.severity === 'error')}>
      <summary>
        {l('Diagnostics', 'Diagnostics')} ({diagnostics.length})
      </summary>
      <ul className="small">
        {diagnostics.map((d, i) => (
          <li key={i}>
            <code>{d.path}</code>: {l(d.en, d.fr)}
          </li>
        ))}
      </ul>
    </details>
  ) : null;
}

export type OpenSpecPreview = {
  revision: number;
  changes: string[];
  selectedChange?: string;
  diagnostics: OpenSpecDiagnostic[];
  sources: Record<string, string>;
  specification: { patch: SpecPatch; changes: { path: string; kind: string }[] };
  board: { enabled: boolean; revision: number; added: string[]; updated: string[]; cards: Card[] };
  proposalId?: string | null;
};

export function OpenSpecImport({
  projectId,
  revision,
  editable,
  reload,
  go,
}: {
  projectId: string;
  revision: number;
  editable: boolean;
  reload: () => Promise<unknown>;
  go: (view: string) => void;
}) {
  const l = useL();
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [change, setChange] = useState('');
  const [preview, setPreview] = useState<OpenSpecPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [boardImported, setBoardImported] = useState(false);
  const send = async (
    selection: Record<string, string>,
    selectedChange: string,
    action?: 'specification' | 'board',
  ) => {
    setBusy(true);
    setError('');
    try {
      const result = await api<OpenSpecPreview>(`/projects/${projectId}/openspec/import`, 'POST', {
        files: selection,
        selectedChange: selectedChange || undefined,
        baseRevision: action ? preview!.revision : revision,
        preview: !action,
        action,
        expectedBoardRevision: action === 'board' ? preview!.board.revision : undefined,
      });
      setPreview(result);
      if (!action) {
        setProposalId(null);
        setBoardImported(false);
      } else {
        if (action === 'specification') setProposalId(result.proposalId ?? null);
        if (action === 'board') setBoardImported(true);
        await reload();
      }
    } catch (e) {
      setError((e as Error).message);
      if (!action) setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  const choose = async (selection: FileList | null) => {
    if (!selection?.length) return;
    setBusy(true);
    setPreview(null);
    setFiles(null);
    setProposalId(null);
    setBoardImported(false);
    setError('');
    setChange('');
    try {
      const next = await readOpenSpecSelection(selection);
      setFiles(next);
      await send(next, '');
    } catch {
      setError(
        l(
          'Cannot read these files: check paths, UTF-8 encoding and size limits.',
          'Lecture impossible : vérifiez les chemins, l’encodage UTF-8 et les limites de taille.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const blocked =
    !editable || busy || !preview || preview.diagnostics.some((d) => d.severity === 'error');
  return (
    <section className="form-stack" aria-label={l('OpenSpec import', 'Import OpenSpec')}>
      <div className="inline-actions">
        <label className="button secondary file-button">
          <FolderOpen size={16} aria-hidden /> {l('Folder', 'Dossier')}
          <input
            className="sr-only"
            aria-label={l('OpenSpec folder', 'Dossier OpenSpec')}
            type="file"
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            disabled={busy || !editable}
            onChange={(e) => void choose(e.target.files)}
          />
        </label>
        <label className="button secondary file-button">
          <FileInput size={16} aria-hidden /> ZIP
          <input
            className="sr-only"
            aria-label="OpenSpec ZIP"
            type="file"
            accept=".zip,application/zip"
            disabled={busy || !editable}
            onChange={(e) => void choose(e.target.files)}
          />
        </label>
      </div>
      {busy && <p role="status">{l('Checking…', 'Vérification…')}</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {preview && (
        <>
          {preview.changes.length > 1 && (
            <label>
              {l('Change', 'Changement')}
              <select
                value={change}
                disabled={busy}
                onChange={(e) => {
                  setChange(e.target.value);
                  void send(files!, e.target.value);
                }}
              >
                <option value="">{l('Select', 'Sélectionner')}</option>
                {preview.changes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <OpenSpecDiagnostics diagnostics={preview.diagnostics} />
          <details open={preview.specification.changes.length > 0}>
            <summary>
              {l('Specification', 'Spécification')} ({preview.specification.changes.length})
            </summary>
            <ul className="small">
              {preview.specification.changes.map((c, i) => (
                <li key={i}>
                  <code>{c.path}</code> ({c.kind === 'added' ? l('Added', 'Ajout') : c.kind === 'removed' ? l('Removed', 'Retrait') : c.kind === 'changed' ? l('Changed', 'Modification') : c.kind})
                </li>
              ))}
            </ul>
            {preview.specification.patch.items?.map((item) => (
              <details key={item.id}>
                <summary>{item.title}</summary>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.body}</p>
                <pre className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.acceptance}</pre>
              </details>
            ))}
            <details>
              <summary>JSON</summary>
              <pre className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {JSON.stringify(preview.specification.patch, null, 2)}
              </pre>
            </details>
          </details>
          <SourceDocuments files={preview.sources} />
          {proposalId ? (
            <Button onClick={() => go('proposals')}>
              <ListChecks size={16} aria-hidden />
              {l('Review', 'Réviser')}
            </Button>
          ) : (
            <Button
              disabled={
                blocked ||
                (!preview.specification.changes.length && !Object.keys(preview.sources).length)
              }
              onClick={() => void send(files!, change, 'specification')}
            >
              <ListChecks size={16} aria-hidden />
              {l('Propose', 'Proposer')}
            </Button>
          )}
          {preview.board.cards.length > 0 && (
            <details>
              <summary>
                {l('Tasks', 'Tâches')} ({preview.board.cards.length})
              </summary>
              <ul className="small">
                {preview.board.cards.map((c) => (
                  <li key={c.id}>
                    <code>{c.id}</code> {c.title} (
                    {l(columnLabels[c.column].en, columnLabels[c.column].fr)})
                  </li>
                ))}
              </ul>
              <Button
                disabled={blocked || !preview.board.enabled || boardImported}
                onClick={() => void send(files!, change, 'board')}
              >
                <FileInput size={16} aria-hidden />
                {boardImported
                  ? l('Imported', 'Importées')
                  : l('Import tasks', 'Importer les tâches')}
              </Button>
            </details>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => void send(files!, change)}>
            <Eye size={16} aria-hidden />
            {l('Refresh', 'Actualiser')}
          </Button>
        </>
      )}
    </section>
  );
}
