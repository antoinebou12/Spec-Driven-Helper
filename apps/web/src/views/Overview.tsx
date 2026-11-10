import { lazy, Suspense, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Download, FileInput, GitBranch, History, Layers3, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api';
import { draftNotice, type Draft } from '../draft';
import { Badge, Button, Modal } from '../components/ui';
import { ProgressBar, ProgressRing } from '../components/Progress';
import { SddWorkflow } from '../components/SddWorkflow';
import { ProjectVisualizer } from '../components/ProjectVisualizer';
import { formatDate, useL, useLang, useLocalized } from '../i18n';
import { moduleIcons } from '../icons';
import { completeness } from '../../../../packages/shared/src/completeness';
import { modules } from '../../../../packages/shared/src/templates';
import type { ProjectState } from '../state';
import { can, isComplete } from '../../../../packages/shared/src/domain';
import { essentialIdsFor } from '../../../../packages/shared/src/essentials';
import { useFeatures } from '../features';

const ImportView = lazy(() => import('./ImportView'));

type Go = (view: string, target?: { sectionId?: string; questionId?: string }) => void;

export default function Overview({ project, go, notify = () => {}, importOpen = false }: { project: ProjectState; go: Go; notify?: (message: string) => void; importOpen?: boolean }) {
  const l = useL();
  const lang = useLang();
  const loc = useLocalized();
  const spec = project.spec!;
  const features = useFeatures();
  const mayImport = features.on('import') && can(project.role, 'edit');
  // The sentence written when the project was created can be sent to the AI again, until the essentials are answered.
  const [drafting, setDrafting] = useState(false);
  const essentialsOpen = essentialIdsFor(spec.projectType).some((id) => !isComplete(spec.sections.find((s) => s.id === id.split('.')[0])?.answers[id]));
  const mayDraft = features.on('ai') && can(project.role, 'edit') && spec.description.trim().length >= 3 && essentialsOpen;
  const draft = async () => {
    setDrafting(true);
    try {
      notify(draftNotice(await api<Draft>(`/projects/${spec.id}/draft`, 'POST'), l));
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setDrafting(false);
    }
  };
  const c = completeness(spec);
  const ready = project.readiness!.ready;
  const next = [
    !spec.stack.length && { label: l('Choose your technology stack', 'Choisissez votre pile technologique'), view: 'stack' },
    c.requiredDone < c.requiredTotal && {
      label: l(`Answer ${c.requiredTotal - c.requiredDone} remaining required questions`, `Répondez aux ${c.requiredTotal - c.requiredDone} questions obligatoires restantes`),
      view: 'specification',
      target: { sectionId: c.perModule.find((m) => m.requiredDone < m.requiredTotal)?.id },
    },
    c.perModule.some((m) => m.unknown) && { label: l('Resolve questions marked unknown', 'Résolvez les questions marquées inconnues'), view: 'specification', target: { sectionId: c.perModule.find((m) => m.unknown)?.id } },
    project.pendingProposals > 0 && { label: l(`Review ${project.pendingProposals} pending proposals`, `Révisez ${project.pendingProposals} propositions en attente`), view: 'proposals' },
    c.requirements === 0 && { label: l('Add requirements with acceptance criteria', 'Ajoutez des exigences avec critères d’acceptation'), view: 'traceability' },
    c.reviewed < c.reviewNeeded && c.requiredDone === c.requiredTotal && { label: l('Review the completed sections', 'Révisez les sections complétées'), view: 'readiness' },
    ready && { label: l('Approve a baseline, then create the delivery board', 'Approuvez une référence, puis créez le tableau de livraison'), view: 'readiness' },
  ].filter((step) => step && !features.hidden.has(step.view)) as { label: string; view: string; target?: { sectionId?: string } }[];
  return (
    <div className="view-body overview">
      {(mayImport || mayDraft) && (
        <div className="inline-actions overview-actions">
          {mayImport && <Button onClick={() => go('import')}><FileInput size={16} aria-hidden /> {l('Import existing work', 'Importer l’existant')}</Button>}
          {mayDraft && <Button onClick={draft} disabled={drafting}><Sparkles size={16} aria-hidden /> {l('Draft the essentials with AI', 'Rédiger l’essentiel avec l’IA')}</Button>}
        </div>
      )}
      <section className="overview-section overview-hero" aria-labelledby="completeness-title">
        <ProgressRing value={c.percent} size={88} stroke={7} label={l('Document completeness', 'Complétude du document')} tone={c.percent >= 90 ? 'green' : 'accent'} />
        <div>
          <h2 id="completeness-title">{l('Document completeness', 'Complétude du document')}</h2>
          <details className="compact-details"><summary>{l('Score details', 'Détails du score')}</summary><p className="muted small">
            {l(
              'Completeness combines required answers (50%), optional answers (15%), section reviews (20%) and requirements verified by tests (15%). Readiness for approval is stricter and is shown separately.',
              'La complétude combine les réponses obligatoires (50 %), facultatives (15 %), les révisions de sections (20 %) et les exigences vérifiées par des tests (15 %). La préparation à l’approbation est plus stricte et affichée à part.',
            )}
          </p></details>
          <dl className="stat-grid">
            <div>
              <dt>{l('Required answers', 'Réponses obligatoires')}</dt>
              <dd>
                {c.requiredDone}/{c.requiredTotal}
              </dd>
              <dd className="stat-bar"><ProgressBar value={c.parts.required} label={l('Required answers', 'Réponses obligatoires')} /></dd>
            </div>
            <div>
              <dt>{l('Optional answers', 'Réponses facultatives')}</dt>
              <dd>
                {c.optionalDone}/{c.optionalTotal}
              </dd>
              <dd className="stat-bar"><ProgressBar value={c.parts.optional} label={l('Optional answers', 'Réponses facultatives')} /></dd>
            </div>
            <div>
              <dt>{l('Sections reviewed', 'Sections révisées')}</dt>
              <dd>{c.reviewed}/{c.reviewNeeded}</dd>
              <dd className="stat-bar"><ProgressBar value={c.parts.reviewed} label={l('Sections reviewed', 'Sections révisées')} /></dd>
            </div>
            <div>
              <dt>{l('Requirements with tests', 'Exigences testées')}</dt>
              <dd>
                {c.tested}/{c.requirements}
              </dd>
              <dd className="stat-bar"><ProgressBar value={c.parts.coverage} label={l('Requirements with tests', 'Exigences testées')} /></dd>
            </div>
          </dl>
          <p>
            {ready ? (
              <Badge tone="green">
                <CheckCircle2 size={12} aria-hidden /> {l('Ready for baseline approval', 'Prête pour l’approbation')}
              </Badge>
            ) : (
              <Badge>{l(`${project.readiness!.blockers.length} readiness blockers`, `${project.readiness!.blockers.length} blocages de préparation`)}</Badge>
            )}{' '}
            <Badge tone="blue">
              <Layers3 size={12} aria-hidden /> {l(`${spec.stack.length} stack choices in ${c.stackLayers} layers`, `${spec.stack.length} choix sur ${c.stackLayers} couches`)}
            </Badge>
          </p>
        </div>
      </section>
      <details className="compact-details overview-section"><summary>{l('Workflow', 'Parcours')}</summary><SddWorkflow spec={spec} go={go} /></details>
      <ProjectVisualizer spec={spec} onSection={(sectionId) => go('specification', { sectionId })} />
      <div className="overview-grid">
        <details open className="overview-section compact-details">
          <summary id="modules-title">{l('Sections', 'Sections')}</summary>
          <ul className="module-bars">
            {c.perModule.map((m) => {
              const module = modules.find((x) => x.id === m.id)!;
              const Icon = moduleIcons[m.id];
              const pct = m.requiredTotal ? (m.requiredDone / m.requiredTotal) * 100 : 100;
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => go('specification', { sectionId: m.id })}>
                    <Icon size={16} aria-hidden />
                    <span className="module-name">{loc(module.title)}</span>
                    <ProgressBar value={pct} label={l(`${loc(module.title)}: required answers`, `${loc(module.title)} : réponses obligatoires`)} />
                    <span className="small muted">
                      {m.requiredDone}/{m.requiredTotal}
                    </span>
                    {m.status === 'reviewed' ? (
                      <Badge tone="green">{l('Reviewed', 'Révisée')}</Badge>
                    ) : m.status === 'needs-review' ? (
                      <Badge tone="amber">{l('Needs review', 'À réviser')}</Badge>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
        <div className="overview-side">
          <section className="overview-section" aria-labelledby="next-title">
            <h3 id="next-title">{l('Next steps', 'Prochaines étapes')}</h3>
            <ol className="next-steps">
              {next.slice(0, 4).map((n) => (
                <li key={n.label}>
                  <Button variant="ghost" onClick={() => go(n.view, n.target)}>
                    {n.label} <ArrowRight size={14} />
                  </Button>
                </li>
              ))}
              {!next.length && <li className="muted">{l('Nothing left to do. Well done.', 'Rien à faire. Bravo.')}</li>}
            </ol>
          </section>
          <section className="overview-section save-explainer" aria-labelledby="save-title">
            <h3 id="save-title">
              <Save size={17} aria-hidden /> {l('Revision', 'Révision')} {spec.revision}
            </h3>
            <p className="small muted">{formatDate(spec.updatedAt, lang)}</p>
            <details className="compact-details"><summary>{l('History and saving', 'Historique et enregistrement')}</summary>
            <ul className="plain-list">
              <li>
                <Clock size={15} aria-hidden />
                <span>
                  {l('Every change saves automatically on the server as a new revision.', 'Chaque changement est enregistré automatiquement sur le serveur dans une nouvelle révision.')}{' '}
                  <strong>
                    {l('Revision', 'Révision')} {spec.revision}
                  </strong>{' '}
                  · {formatDate(spec.updatedAt, lang)}
                </span>
              </li>
              <li>
                <History size={15} aria-hidden />
                <span>{l('Each revision records who changed what and why; compare any two in a section’s History tab.', 'Chaque révision indique qui a changé quoi et pourquoi ; comparez-les dans l’onglet Historique d’une section.')}</span>
              </li>
              <li>
                <ShieldCheck size={15} aria-hidden />
                <span>{l('Approving a baseline freezes an immutable snapshot for delivery.', 'Approuver une référence fige un instantané immuable pour la livraison.')}</span>
              </li>
              <li>
                <GitBranch size={15} aria-hidden />
                <span>{l('Publishing writes the documents to a Git branch for your repository.', 'La publication écrit les documents sur une branche Git de votre dépôt.')}</span>
              </li>
            </ul>
            </details>
            <div className="inline-actions">
              {[
                ['json', 'JSON'],
                ['markdown', 'Markdown'],
                ['zip', l('Agent bundle', 'Paquet agents')],
              ].map(([f, label]) => (
                <a key={f} className="button small" href={`/api/v1/projects/${spec.id}/export/${f}`} download>
                  <Download size={13} aria-hidden /> {label}
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
      {importOpen && mayImport && <Modal open wide onOpenChange={() => go('overview')} title={l('Import existing work', 'Importer l’existant')}>
        <Suspense fallback={<p role="status">{l('Loading…', 'Chargement…')}</p>}><ImportView key={spec.id} project={project} go={go} /></Suspense>
      </Modal>}
    </div>
  );
}
