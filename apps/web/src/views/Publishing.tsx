import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, FileText, GitBranch, GitPullRequest, Image, Package, Upload } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, Segmented } from '../components/ui';
import { formatDate, useL, useLang } from '../i18n';
import { useFeatures } from '../features';
import { OverviewImage } from '../components/OverviewImage';
import { ExportPicker } from '../components/ExportPicker';
import { can } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';

const PlanFolder = lazy(() => import('../components/PlanFolder'));
type GitConfig = {
  provider: 'github' | 'git';
  repository?: string;
  remoteUrl?: string;
  branch: string;
  lastPublished?: { branch: string; commit: string; url?: string; revision: number; source: string; at: string };
} | null;

function GitCard({ project, notify, go }: { project: ProjectState; notify: (m: string) => void; go: (v: string) => void }) {
  const l = useL();
  const lang = useLang();
  const spec = project.spec!;
  const admin = can(project.role, 'admin');
  const editable = can(project.role, 'edit');
  const [config, setConfig] = useState<GitConfig>(null);
  const [editingConfig, setEditingConfig] = useState(false);
  const [provider, setProvider] = useState<'github' | 'git'>('github');
  const [source, setSource] = useState<'baseline' | 'current'>('baseline');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(() => api<GitConfig>(`/projects/${spec.id}/git`).then(setConfig), [spec.id]);
  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card span-two" aria-labelledby="git-title">
      <h3 id="git-title">
        <GitBranch size={18} aria-hidden /> {l('Git and GitHub', 'Git et GitHub')}
      </h3>
      <p className="muted">
        {l(
          'Publishing writes the implementation bundle (.plan/, AGENTS.md, CLAUDE.md, Copilot instructions, the maintenance skill) to a new branch — with a pull request on GitHub. Nothing is ever force-pushed. Importing compares Git with the published revision and creates a proposal for review.',
          'La publication écrit le paquet d’implémentation (.plan/, AGENTS.md, CLAUDE.md, instructions Copilot, compétence de maintenance) sur une nouvelle branche — avec une demande de fusion sur GitHub. Rien n’est jamais forcé. L’import compare Git à la révision publiée et crée une proposition à réviser.',
        )}
      </p>
      {config && !editingConfig ? (
        <dl className="facts">
          <dt>{l('Remote', 'Dépôt distant')}</dt>
          <dd>{config.provider === 'github' ? `github.com/${config.repository}` : config.remoteUrl}</dd>
          <dt>{l('Base branch', 'Branche de base')}</dt>
          <dd>{config.branch}</dd>
          {config.lastPublished && (
            <>
              <dt>{l('Last published', 'Dernière publication')}</dt>
              <dd>
                {l('Revision', 'Révision')} {config.lastPublished.revision} ({config.lastPublished.source}) → <code>{config.lastPublished.branch}</code> · {formatDate(config.lastPublished.at, lang)}{' '}
                {config.lastPublished.url && (
                  <a href={config.lastPublished.url} target="_blank" rel="noreferrer noopener">
                    {l('Pull request', 'Demande de fusion')}
                  </a>
                )}
              </dd>
            </>
          )}
        </dl>
      ) : admin ? (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              await api(`/projects/${spec.id}/git`, 'PUT', {
                provider,
                branch: f.get('branch'),
                ...(provider === 'github' ? { repository: f.get('repository'), token: f.get('token') } : { remoteUrl: f.get('remoteUrl'), username: f.get('username'), token: f.get('token') }),
              });
              setEditingConfig(false);
              await reload();
              notify(l('Git remote saved. The token is stored encrypted.', 'Dépôt enregistré. Le jeton est chiffré.'));
            });
          }}
        >
          <Segmented
            label={l('Remote type', 'Type de dépôt')}
            value={provider}
            onChange={setProvider}
            items={[
              { id: 'github', label: 'GitHub' },
              { id: 'git', label: l('Other Git remote (HTTPS)', 'Autre dépôt Git (HTTPS)') },
            ]}
          />
          <div className="form-grid">
            {provider === 'github' ? (
              <label>
                {l('Repository (owner/name)', 'Dépôt (propriétaire/nom)')}
                <input name="repository" required pattern="[\w.\-]+/[\w.\-]+" placeholder="acme/customer-portal" />
              </label>
            ) : (
              <>
                <label>
                  {l('Remote URL', 'Adresse du dépôt')}
                  <input name="remoteUrl" type="url" required placeholder="https://git.example.com/team/repo.git" />
                </label>
                <label>
                  {l('Username (optional)', 'Utilisateur (facultatif)')}
                  <input name="username" autoComplete="off" />
                </label>
              </>
            )}
            <label>
              {l('Base branch', 'Branche de base')}
              <input name="branch" defaultValue="main" required />
            </label>
            <label>
              {provider === 'github' ? l('Fine-grained token (contents, pull requests)', 'Jeton à portée limitée (contenu, demandes de fusion)') : l('Access token', 'Jeton d’accès')}
              <input name="token" type="password" autoComplete="new-password" required={provider === 'github'} />
            </label>
          </div>
          <div className="inline-actions">
            <Button type="submit" variant="primary" disabled={busy}>
              {l('Save remote', 'Enregistrer le dépôt')}
            </Button>
            {config && (
              <Button variant="ghost" onClick={() => setEditingConfig(false)}>
                {l('Cancel', 'Annuler')}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <p className="muted">{l('An administrator must configure a Git remote.', 'Un administrateur doit configurer un dépôt Git.')}</p>
      )}
      {config && !editingConfig && (
        <>
          {admin && (
            <Button size="sm" variant="ghost" onClick={() => setEditingConfig(true)}>
              {l('Change remote', 'Changer de dépôt')}
            </Button>
          )}
          {editable && (
            <div className="publish-box">
              <Segmented
                label={l('What to publish', 'Quoi publier')}
                value={source}
                onChange={setSource}
                items={[
                  { id: 'baseline', label: l('Latest approved baseline', 'Dernière référence approuvée') },
                  { id: 'current', label: l(`Current draft (revision ${spec.revision})`, `Brouillon actuel (révision ${spec.revision})`) },
                ]}
              />
              <label className="check-label">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                {l(`Create a new branch on ${config.provider === 'github' ? config.repository : config.remoteUrl}`, `Créer une nouvelle branche sur ${config.provider === 'github' ? config.repository : config.remoteUrl}`)}
              </label>
              <div className="inline-actions">
                <Button
                  variant="primary"
                  disabled={!confirmed || busy}
                  onClick={() =>
                    run(async () => {
                      const result = await api(`/projects/${spec.id}/git/publish`, 'POST', { source, expectedRevision: spec.revision, confirm: true });
                      setConfirmed(false);
                      await reload();
                      notify(result.url ? l('Pull request opened.', 'Demande de fusion ouverte.') : l(`Pushed branch ${result.branch}.`, `Branche ${result.branch} publiée.`));
                    })
                  }
                >
                  <GitPullRequest size={15} /> {l('Publish', 'Publier')}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await api(`/projects/${spec.id}/git/import`, 'POST', {});
                      if (result.unchanged) notify(l('Git has no changes since the published revision.', 'Aucun changement dans Git depuis la révision publiée.'));
                      else {
                        await project.reload();
                        go('proposals');
                      }
                    })
                  }
                >
                  <Download size={15} /> {l('Import changes from Git', 'Importer les changements de Git')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default function Publishing({ project, notify, go }: { project: ProjectState; notify: (m: string) => void; go: (v: string) => void }) {
  const l = useL();
  const features = useFeatures();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const file = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<{ assets: any[]; pdfConfigured: boolean }>({ assets: [], pdfConfigured: false });
  const reports = features.on('reports');
  useEffect(() => {
    if (reports) api(`/projects/${spec.id}/publishing`).then(setAssets).catch(() => {});
  }, [spec.id, spec.revision, reports]);
  const formats: { id: string; title: string; note: string }[] = [
    { id: 'json', title: 'JSON', note: l('Canonical and lossless — re-import it here or into another workspace.', 'Canonique et sans perte — réimportable ici ou ailleurs.') },
    { id: 'zip', title: l('Implementation bundle', 'Paquet d’implémentation'), note: l('.plan/, AGENTS.md, CLAUDE.md, Copilot instructions and the maintenance skill.', '.plan/, AGENTS.md, CLAUDE.md, instructions Copilot et compétence de maintenance.') },
    { id: 'markdown', title: 'Markdown', note: l('Single readable document. Export only.', 'Document lisible unique. Export seulement.') },
    { id: 'xml', title: 'XML', note: l('Structured export. Export only.', 'Export structuré. Export seulement.') },
    { id: 'toon', title: 'TOON', note: l('Compact, lossless notation for language models — re-import it like JSON.', 'Notation compacte et sans perte pour modèles de langage — réimportable comme JSON.') },
    { id: 'latex', title: 'LaTeX', note: l('Report source with tables and a table of contents. Compile with XeLaTeX.', 'Source de rapport avec tableaux et sommaire. Compiler avec XeLaTeX.') },
    { id: 'html', title: l('Printable HTML', 'HTML imprimable'), note: l('Styled standalone document. Open it and print to PDF.', 'Document autonome mis en forme. Ouvrez-le et imprimez en PDF.') },
    { id: 'skill', title: l('Claude skill', 'Compétence Claude'), note: l('A standalone skill that knows this design: SKILL.md plus product, design, items, security and section references. Unzip into .claude/skills/.', 'Une compétence autonome qui connaît cette conception : SKILL.md et les références produit, conception, éléments, sécurité et sections. À décompresser dans .claude/skills/.') },
    { id: 'agents', title: l('Agent files', 'Fichiers d’agents'), note: l('AGENTS.md, CLAUDE.md, GEMINI.md, Copilot and Cursor rules, PRODUCT.md and DESIGN.md for your repository root.', 'AGENTS.md, CLAUDE.md, GEMINI.md, règles Copilot et Cursor, PRODUCT.md et DESIGN.md pour la racine du dépôt.') },
    { id: 'speckit', title: 'Spec Kit', note: l('Constitution, spec, plan, research, tasks and checklist in the Spec Kit layout.', 'Constitution, spécification, plan, recherche, tâches et liste de contrôle au format Spec Kit.') },
    ...(features.on('openspec') ? [{ id: 'openspec', title: 'OpenSpec', note: l('Capabilities, scenarios and project context.', 'Capacités, scénarios et contexte du projet.') }] : []),
    ...(reports && assets.pdfConfigured
      ? [{ id: 'pdf', title: 'PDF', note: l('Rendered now by the isolated publisher. Not stored.', 'Rendu immédiat par le service isolé. Non conservé.') }]
      : []),
  ];
  const exportGroups = [
    { id: 'agents', ids: ['zip', 'agents', 'skill', 'speckit', 'openspec'], title: l('For coding agents', 'Pour les agents de code'), note: l('Hand the design to your coding tools.', 'Transmettre la conception à vos outils de code.') },
    { id: 'document', ids: ['html', 'pdf', 'markdown', 'latex'], title: l('Documents to read and share', 'Documents à lire et partager'), note: l('For reviewers and stakeholders. Export only.', 'Pour les réviseurs et parties prenantes. Export seulement.') },
    { id: 'data', ids: ['json', 'toon', 'xml'], title: l('Data and backups', 'Données et sauvegardes'), note: l('JSON and TOON can be imported again as a proposal.', 'JSON et TOON peuvent être réimportés comme proposition.') },
  ];
  return (
    <div className="view-body publishing">
      <section className="card span-two" aria-labelledby="export-title">
        <h3 id="export-title">
          <Download size={18} aria-hidden /> {l(`Export revision ${spec.revision}`, `Exporter la révision ${spec.revision}`)}
        </h3>
        <ExportPicker projectId={spec.id} formats={formats} groups={exportGroups} />
        <p className="muted small">{l('Approved baselines can be exported from Readiness & baselines.', 'Les références approuvées s’exportent depuis Préparation et références.')}</p>
        {editable && (
          <>
            <Button onClick={() => file.current?.click()}>
              <Upload size={15} /> {l('Import a JSON or TOON bundle as a proposal', 'Importer un paquet JSON ou TOON comme proposition')}
            </Button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json,.toon,text/plain"
              className="sr-only"
              aria-label={l('JSON or TOON bundle file', 'Fichier de paquet JSON ou TOON')}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const text = await f.text();
                  // TOON files are sent as text; the server decodes and validates them like JSON.
                  await api(`/projects/${spec.id}/import`, 'POST', /^\s*\{/.test(text) ? JSON.parse(text) : { toon: text });
                  await project.reload();
                  go('proposals');
                } catch (err) {
                  notify((err as Error).message);
                }
              }}
            />
          </>
        )}
      </section>
      <OverviewImage src={`/api/v1/projects/${spec.id}/export/svg`} name={`${spec.name}-r${spec.revision}`} />
      {features.on('gitPublishing') && <GitCard project={project} notify={notify} go={go} />}
      {features.on('reports') && (
      <>
      <section className="card" aria-labelledby="report-title">
        <h3 id="report-title">
          <FileText size={18} aria-hidden /> {l('Professional report (PDF)', 'Rapport professionnel (PDF)')} <Badge tone="violet">{l('Milestone 3 preview', 'Aperçu jalon 3')}</Badge>
        </h3>
        <p className="muted">{l('Compiled in an isolated publisher service with contents, numbered sections, diagrams and appendices.', 'Compilé dans un service isolé avec sommaire, sections numérotées, diagrammes et annexes.')}</p>
        <Badge tone={assets.pdfConfigured ? 'green' : 'amber'}>{assets.pdfConfigured ? l('Publisher configured', 'Service configuré') : l('Publisher not configured', 'Service non configuré')}</Badge>
        <div className="inline-actions">
          <Button disabled={!assets.pdfConfigured || !editable} onClick={() => api(`/projects/${spec.id}/publishing`, 'POST', { kind: 'pdf' }).then(() => notify(l('PDF queued.', 'PDF en file d’attente.')), (e) => notify(e.message))}>
            {l('Generate PDF', 'Générer le PDF')}
          </Button>
        </div>
      </section>
      <section className="card" aria-labelledby="concept-title">
        <h3 id="concept-title">
          <Image size={18} aria-hidden /> {l('UX concept images', 'Images de concept UX')} <Badge tone="violet">{l('Milestone 3 preview', 'Aperçu jalon 3')}</Badge>
        </h3>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            api(`/projects/${spec.id}/publishing`, 'POST', { kind: 'image', prompt: f.get('prompt'), model: f.get('model') }).then(
              () => notify(l('Image generation queued; it stays unapproved until reviewed.', 'Génération lancée ; l’image reste non approuvée jusqu’à révision.')),
              (err) => notify(err.message),
            );
          }}
        >
          <label>
            {l('Image model', 'Modèle d’image')}
            <input name="model" defaultValue="gpt-image-1" required />
          </label>
          <label>
            {l('Concept brief', 'Brief du concept')}
            <textarea name="prompt" rows={2} required />
          </label>
          <Button type="submit" disabled={!editable || spec.localOnly}>
            {l('Generate concept', 'Générer un concept')}
          </Button>
        </form>
        <ul className="asset-list">
          {assets.assets.map((a) => (
            <li key={String(a._id)}>
              <a href={`/api/v1/projects/${spec.id}/assets/${a._id}`}>{a.filename}</a>{' '}
              {a.metadata?.approved ? <Badge tone="green">{l('approved', 'approuvée')}</Badge> : <Badge tone="amber">{l('awaiting review', 'à réviser')}</Badge>}
              {!a.metadata?.approved && can(project.role, 'review') && (
                <Button size="sm" variant="ghost" onClick={() => api(`/projects/${spec.id}/assets/${a._id}/approve`, 'POST').then(() => api(`/projects/${spec.id}/publishing`).then(setAssets))}>
                  <Check size={13} /> {l('Approve', 'Approuver')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      </>
      )}
      {features.on('starter') && (
      <section className="card" aria-labelledby="starter-title">
        <h3 id="starter-title">
          <Package size={18} aria-hidden /> {l('Starter repository', 'Dépôt de départ')} <Badge tone="violet">{l('Milestone 3 preview', 'Aperçu jalon 3')}</Badge>
        </h3>
        <p className="muted">{l('Generated from the latest approved baseline.', 'Généré depuis la dernière référence approuvée.')}</p>
        <a className="button secondary" href={`/api/v1/projects/${spec.id}/scaffold`} download>
          <Download size={14} aria-hidden /> {l('Download starter', 'Télécharger le départ')}
        </a>
      </section>
      )}
      <section className="card span-two" aria-labelledby="plan-folder-title">
        <h3 id="plan-folder-title">{l('.plan folder', 'Dossier .plan')}</h3>
        <Suspense fallback={null}>
          <PlanFolder projectId={spec.id} editable={editable} notify={notify} />
        </Suspense>
      </section>
    </div>
  );
}
