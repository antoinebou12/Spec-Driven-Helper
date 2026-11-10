import { useEffect, useState } from 'react';
import { FileInput, FileText, FolderGit2, ListChecks, Play, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, Segmented, Tabs } from '../components/ui';
import { ProviderPicker, type ProviderChoice } from '../components/ProviderPicker';
import { useL, useLocalized } from '../i18n';
import { useFeatures } from '../features';
import { describePath } from '../paths';
import { can } from '../../../../packages/shared/src/domain';
import type { Localized } from '../../../../packages/shared/src/templates';
import type { StackLayer } from '../../../../packages/shared/src/schema';
import { layerInfo } from '../../../../packages/shared/src/stack';
import { layerIcons } from '../icons';
import type { ProjectState } from '../state';
import { OpenSpecImport } from '../components/OpenSpecExchange';

function FindingLayerIcon({ layer }: { layer: string }) {
  const Icon = layerIcons[layer as StackLayer];
  return Icon ? <Icon size={12} aria-hidden /> : null;
}

type Finding = { rule: string; evidence: string; stack?: { slug: string; layer: string; version?: string }; answers?: Record<string, unknown>; description?: string };
type Method = 'rules' | 'ai' | 'both';
const toBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/**
 * Import existing work: a repository (zip, Git URL or the configured remote) or a document.
 * Rules are listed so authors can see why something was detected; every import is a proposal.
 */
export default function ImportView({ project, go }: { project: ProjectState; go: (view: string) => void }) {
  const l = useL();
  const loc = useLocalized();
  const features = useFeatures();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const [tab, setTab] = useState<'repository' | 'document' | 'openspec'>('repository');
  const [source, setSource] = useState<'zip' | 'git' | 'configured'>('zip');
  const [chosenMethod, setMethod] = useState<Method>('rules');
  const method: Method = features.on('ai') ? chosenMethod : 'rules';
  const [choice, setChoice] = useState<ProviderChoice | null>(null);
  const [rules, setRules] = useState<{ id: string; title: Localized }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ findings?: Finding[]; matched?: { heading: string; target: string }[]; unmatched?: string[]; proposalId?: string; jobId?: string; files?: number } | null>(null);
  useEffect(() => {
    api('/import/rules').then(setRules).catch(() => {});
  }, []);
  const ai = method !== 'rules' ? { provider: choice?.provider, model: choice?.model } : {};
  const run = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (tab === 'repository') {
        const body =
          source === 'zip'
            ? { source, name: file!.name, data: toBase64(await file!.arrayBuffer()) }
            : source === 'git'
              ? { source, url, branch }
              : { source };
        setResult(await api(`/projects/${spec.id}/import/repository`, 'POST', { ...body, method, ...ai }));
      } else {
        const name = file?.name ?? 'pasted-notes.md';
        const format = /\.html?$/i.test(name) ? 'html' : /\.txt$/i.test(name) ? 'text' : 'markdown';
        const content = file ? await file.text() : text;
        setResult(await api(`/projects/${spec.id}/import/document`, 'POST', { name, format, content, method, ...ai }));
      }
      await project.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ready =
    editable &&
    (method === 'rules' || !!choice) &&
    (tab === 'repository' ? (source === 'zip' ? !!file : source === 'git' ? /^https:\/\//.test(url) : true) : !!file || !!text.trim());
  return (
    <div className="view-body import-view">
      <p className="muted">
        {l(
          'Imports create proposals for review. Secret files are excluded.',
          'Les imports créent des propositions à réviser. Les fichiers secrets sont exclus.',
        )}
      </p>
      <Tabs
        label={l('What to import', 'Quoi importer')}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setFile(null);
          setResult(null);
        }}
        items={[
          { id: 'repository', label: l('Existing repository', 'Dépôt existant') },
          { id: 'document', label: l('Existing document', 'Document existant') },
          ...(features.on('openspec') ? [{ id: 'openspec' as const, label: 'OpenSpec' }] : []),
        ]}
      />
      {tab === 'openspec' ? (features.on('openspec') && features.on('import') && <OpenSpecImport key={spec.id} projectId={spec.id} revision={spec.revision} editable={editable} reload={project.reload} go={go} />) : <section className="form-stack" aria-label={l('Import settings', 'Paramètres d’import')}>
        {tab === 'repository' ? (
          <>
            <Segmented
              label={l('Repository source', 'Source du dépôt')}
              value={source}
              onChange={setSource}
              items={[
                { id: 'zip', label: l('Upload a .zip', 'Téléverser un .zip') },
                { id: 'git', label: l('Git URL (HTTPS)', 'URL Git (HTTPS)') },
                { id: 'configured', label: l('Project Git remote', 'Dépôt Git du projet') },
              ]}
            />
            {source === 'zip' && (
              <label>
                <span>
                  <FolderGit2 size={15} aria-hidden /> {l('Repository archive (.zip, up to 25 MB)', 'Archive du dépôt (.zip, 25 Mo max)')}
                </span>
                <input type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
            {source === 'git' && (
              <div className="form-grid">
                <label>
                  {l('Clone URL', 'URL de clonage')}
                  <input type="url" value={url} placeholder="https://github.com/org/repo.git" onChange={(e) => setUrl(e.target.value)} />
                </label>
                <label>
                  {l('Branch', 'Branche')}
                  <input value={branch} onChange={(e) => setBranch(e.target.value)} />
                </label>
              </div>
            )}
            {source === 'configured' && <p className="muted small">{l('Uses the remote and credentials configured in Publish & handoff.', 'Utilise le dépôt et les identifiants configurés dans Publication et transmission.')}</p>}
          </>
        ) : (
          <>
            <label>
              <span>
                <FileText size={15} aria-hidden /> {l('Document (.md, .txt, .html)', 'Document (.md, .txt, .html)')}
              </span>
              <input type="file" accept=".md,.markdown,.txt,.html,.htm,text/markdown,text/plain,text/html" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {!file && (
              <label>
                {l('…or paste text', '…ou collez du texte')}
                <textarea rows={8} value={text} placeholder={l('## Problem to solve\n…', '## Problème à résoudre\n…')} onChange={(e) => setText(e.target.value)} />
              </label>
            )}
          </>
        )}
        <Segmented
          label={l('Import method', 'Méthode d’import')}
          value={method}
          onChange={setMethod}
          items={[
            { id: 'rules', label: l('Rules (instant, explainable)', 'Règles (instantané, explicable)') },
            ...(features.on('ai')
              ? [
                  { id: 'ai' as const, label: l('AI', 'IA') },
                  { id: 'both' as const, label: l('Rules + AI', 'Règles + IA') },
                ]
              : []),
          ]}
        />
        {method !== 'rules' && (
          <>
            <ProviderPicker localOnly={spec.localOnly} exclude={features.on('agentRunner') ? [] : ['claude-agent']} onChange={setChoice} />
            <p className="muted small">
              {l('A bounded excerpt (manifests, pipelines, contracts, documentation) is sent to the model as untrusted data.', 'Un extrait limité (manifestes, pipelines, contrats, documentation) est envoyé au modèle comme donnée non fiable.')}
            </p>
          </>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button variant="primary" disabled={!ready || busy} onClick={run}>
          <Play size={15} /> {busy ? l('Importing…', 'Import…') : l('Analyse and propose changes', 'Analyser et proposer')}
        </Button>
      </section>}
      {result && (
        <section className="card" aria-live="polite" aria-labelledby="import-result">
          <h3 id="import-result">
            <FileInput size={17} aria-hidden /> {l('Import result', 'Résultat de l’import')}
          </h3>
          {result.files !== undefined && <p className="muted small">{l(`${result.files} files analysed.`, `${result.files} fichiers analysés.`)}</p>}
          {result.findings && result.findings.length > 0 && (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th scope="col">{l('Rule', 'Règle')}</th>
                  <th scope="col">{l('Evidence', 'Preuve')}</th>
                  <th scope="col">{l('Finding', 'Constat')}</th>
                </tr>
              </thead>
              <tbody>
                {result.findings.map((f, i) => (
                  <tr key={i}>
                    <td className="mono small">{f.rule}</td>
                    <td className="small">{f.evidence}</td>
                    <td className="small">
                      {f.stack && (
                        <Badge tone="blue" title={f.stack.layer in layerInfo ? loc(layerInfo[f.stack.layer as StackLayer].label) : f.stack.layer}>
                          <FindingLayerIcon layer={f.stack.layer} /> {f.stack.slug}
                          {f.stack.version ? ` ${f.stack.version}` : ''}
                        </Badge>
                      )}{' '}
                      {Object.keys(f.answers ?? {}).map((id) => (
                        <Badge key={id}>{describePath(`sections.${id.split('.')[0]}.answers.${id}`, spec.language)}</Badge>
                      ))}
                      {f.description && <Badge>{l('description', 'description')}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.matched && (
            <ul className="small">
              {result.matched.map((m) => (
                <li key={m.heading}>
                  “{m.heading}” → {describePath(`sections.${m.target.split('.')[0]}.answers.${m.target}`, spec.language)}
                </li>
              ))}
              {result.unmatched?.map((h) => (
                <li key={h} className="muted">
                  “{h}” → {l('kept as notes', 'conservé en notes')}
                </li>
              ))}
            </ul>
          )}
          <div className="inline-actions">
            {result.proposalId ? (
              <Button variant="primary" onClick={() => go('proposals')}>
                <ListChecks size={15} /> {l('Review the proposal', 'Réviser la proposition')}
              </Button>
            ) : (
              result.jobId === undefined && <p className="muted">{l('Nothing new was found to propose.', 'Rien de nouveau à proposer.')}</p>
            )}
            {result.jobId && (
              <Button onClick={() => go('proposals')}>
                <Sparkles size={15} /> {l('Follow the AI run', 'Suivre l’exécution IA')}
              </Button>
            )}
          </div>
        </section>
      )}
      {tab !== 'openspec' && <details className="card">
        <summary>{l('Import rules', 'Règles d’import')}</summary>
        <ul>
          {rules.map((r) => (
            <li key={r.id}>
              <code>{r.id}</code> — {loc(r.title)}
            </li>
          ))}
        </ul>
        <p className="muted small">{l('Existing answers are never overwritten; list answers only gain options.', 'Les réponses existantes ne sont jamais écrasées ; les listes ne font que gagner des options.')}</p>
      </details>}
    </div>
  );
}
