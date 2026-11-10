import { useState } from 'react';
import { Download, FolderInput, FolderOpen } from 'lucide-react';
import { api } from '../api';
import { Badge, Button } from './ui';
import { useL } from '../i18n';

export type PlanImportSummary = {
  recognised: string[];
  skipped: string[];
  specification: { source: string | null; changes: number };
  board: { from: 'board.json' | 'markdown' | null; added: string[]; updated: string[]; revision: number };
  preview: boolean;
  proposalId?: string | null;
};

const textFile = /\.(md|json|mmd|txt)$/i;

/** Reads a chosen folder (`webkitdirectory`) or a zip into `{ path: content }`, keeping text files only. */
export async function readSelection(files: FileList | File[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const file of Array.from(files)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Zip archives start with "PK"; detect by content, not by the file name.
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(bytes);
      for (const entry of Object.values(zip.files)) if (!entry.dir && textFile.test(entry.name)) out[entry.name] = await entry.async('string');
    } else if (textFile.test(file.name)) {
      out[(file as File & { webkitRelativePath?: string }).webkitRelativePath || `.plan/${file.name}`] = await file.text();
    }
  }
  return out;
}

export function PlanImportPreview({ summary }: { summary: PlanImportSummary }) {
  const l = useL();
  return (
    <div className="plan-preview" role="status">
      <ul className="plain-list">
        <li>
          <Badge tone={summary.specification.changes ? 'violet' : 'neutral'}>{l('Specification', 'Spécification')}</Badge>{' '}
          {summary.specification.changes
            ? l(`${summary.specification.changes} changes from ${summary.specification.source}, as a proposal to review`, `${summary.specification.changes} changements depuis ${summary.specification.source}, en proposition à réviser`)
            : l('no changes', 'aucun changement')}
        </li>
        <li>
          <Badge tone={summary.board.added.length || summary.board.updated.length ? 'blue' : 'neutral'}>{l('Board', 'Tableau')}</Badge>{' '}
          {summary.board.from
            ? l(`${summary.board.added.length} new and ${summary.board.updated.length} updated cards from ${summary.board.from}`, `${summary.board.added.length} nouvelles et ${summary.board.updated.length} cartes mises à jour depuis ${summary.board.from}`)
            : l('no tasks or backlog found', 'aucune tâche ni carnet trouvé')}
        </li>
        <li className="muted small">{l(`${summary.recognised.length} files recognised`, `${summary.recognised.length} fichiers reconnus`)}</li>
      </ul>
      {summary.skipped.length > 0 && (
        <details>
          <summary>{l(`${summary.skipped.length} files or lines not imported`, `${summary.skipped.length} fichiers ou lignes non importés`)}</summary>
          <ul className="small">
            {summary.skipped.slice(0, 50).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Export and import the whole `.plan/` folder of a project. */
export default function PlanFolder({ projectId, editable, notify }: { projectId: string; editable: boolean; notify: (m: string) => void }) {
  const l = useL();
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [summary, setSummary] = useState<PlanImportSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (preview: boolean, selection = files) => {
    if (!selection) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<PlanImportSummary>(`/projects/${projectId}/plan-folder/import`, 'POST', { files: selection, preview, expectedBoardRevision: summary?.board.revision });
      if (preview) setSummary(result);
      else {
        setSummary(null);
        setFiles(null);
        notify(
          l(
            `.plan imported: ${result.proposalId ? 'a specification proposal is waiting for review, ' : ''}${result.board.added.length} cards added, ${result.board.updated.length} updated.`,
            `.plan importé : ${result.proposalId ? 'une proposition attend une révision, ' : ''}${result.board.added.length} cartes ajoutées, ${result.board.updated.length} mises à jour.`,
          ),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choose = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    try {
      const selection = await readSelection(list);
      if (!Object.keys(selection).length) return setError(l('No .plan files found in the selection.', 'Aucun fichier .plan dans la sélection.'));
      setFiles(selection);
      setSummary(null);
      await send(true, selection);
    } catch (e) {
      setError(l(`Could not read the selection: ${(e as Error).message}`, `Lecture impossible : ${(e as Error).message}`));
    }
  };

  return (
    <div className="form-stack">
      <p className="muted small">
        {l(
          'The .plan folder carries everything for people and coding agents: the specification (JSON and one Markdown file per section), tasks and backlog from the board, decisions, traceability and readiness. Import a folder or zip back: the specification becomes a proposal and tasks merge into the board.',
          'Le dossier .plan contient tout pour les personnes et les agents : la spécification (JSON et un Markdown par section), les tâches et le carnet du tableau, les décisions, la traçabilité et la préparation. Réimportez un dossier ou un zip : la spécification devient une proposition et les tâches rejoignent le tableau.',
        )}
      </p>
      <div className="inline-actions">
        <Button asChild>
          <a href={`/api/v1/projects/${projectId}/plan-folder`} download>
            <Download size={15} aria-hidden /> {l('Export .plan folder', 'Exporter le dossier .plan')}
          </a>
        </Button>
        {editable && (
          <>
            <label className="button secondary file-button">
              <FolderOpen size={15} aria-hidden /> {l('Import a .plan folder', 'Importer un dossier .plan')}
              <input
                type="file"
                className="sr-only"
                // Folder selection keeps relative paths such as `.plan/spec/01-discovery.md`.
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                onChange={(e) => void choose(e.target.files)}
                disabled={busy}
              />
            </label>
            <label className="button secondary file-button">
              <FolderInput size={15} aria-hidden /> {l('Import a .plan zip', 'Importer un zip .plan')}
              <input type="file" className="sr-only" accept=".zip,application/zip" onChange={(e) => void choose(e.target.files)} disabled={busy} />
            </label>
          </>
        )}
      </div>
      {summary && <PlanImportPreview summary={summary} />}
      {summary && (
        <div className="inline-actions">
          <Button variant="primary" disabled={busy || (!summary.specification.changes && !summary.board.added.length && !summary.board.updated.length)} onClick={() => void send(false)}>
            {l('Import', 'Importer')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSummary(null);
              setFiles(null);
            }}
          >
            {l('Cancel', 'Annuler')}
          </Button>
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
