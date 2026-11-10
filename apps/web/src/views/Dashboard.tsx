import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Eye, FileQuestion, KanbanSquare, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, EmptyState } from '../components/ui';
import { ProgressBar } from '../components/Progress';
import { formatDate, useL, useLang } from '../i18n';

export type DashboardProject = {
  id: string;
  name: string;
  projectType: string;
  role: string;
  canEdit: boolean;
  canReview: boolean;
  revision: number;
  updatedAt: string;
  completeness: number;
  readiness: { ready: boolean; percent: number; blockers: number };
  security: number;
  pendingProposals: number;
  unknownAnswers: number;
  sectionsToReview: number;
  board: Record<'backlog' | 'todo' | 'doing' | 'review' | 'done', number> | null;
  latestBaseline: { revision: number; approvedAt: string } | null;
};
export type DashboardData = {
  user: { name: string; role: string };
  totals: { projects: number; ready: number; withBaseline: number; averageCompleteness: number };
  waiting: { proposalsToReview: number; sectionsToReview: number; openQuestions: number; blockers: number };
  readOnly: boolean;
  projects: DashboardProject[];
};

/** A labelled percentage with its bar (the bar's accessible name repeats the label and value). */
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span>{label}</span>
        <strong>{value} %</strong>
      </div>
      <ProgressBar value={value} label={`${label} ${value} %`} />
    </div>
  );
}

/** Presentational dashboard, used by the view and by stories and tests. */
export function DashboardContent({ data, openProject }: { data: DashboardData; openProject: (id: string, view: string) => void }) {
  const l = useL();
  const lang = useLang();
  const waiting = [
    { key: 'proposals', icon: Sparkles, n: data.waiting.proposalsToReview, label: l('proposals to review', 'propositions à réviser'), action: (n: string) => l(`Review proposals in ${n}`, `Réviser les propositions de ${n}`), view: 'proposals', need: (p: DashboardProject) => p.canReview && p.pendingProposals > 0 },
    { key: 'sections', icon: ClipboardCheck, n: data.waiting.sectionsToReview, label: l('sections to review', 'sections à réviser'), action: (n: string) => l(`Review sections in ${n}`, `Réviser les sections de ${n}`), view: 'readiness', need: (p: DashboardProject) => p.canReview && p.sectionsToReview > 0 },
    { key: 'questions', icon: FileQuestion, n: data.waiting.openQuestions, label: l('unknown answers', 'réponses inconnues'), action: (n: string) => l(`Complete answers in ${n}`, `Compléter les réponses de ${n}`), view: 'specification', need: (p: DashboardProject) => p.canEdit && p.unknownAnswers > 0 },
    { key: 'blockers', icon: ShieldAlert, n: data.waiting.blockers, label: l('readiness blockers', 'blocages de préparation'), action: (n: string) => l(`Resolve blockers in ${n}`, `Lever les blocages de ${n}`), view: 'readiness', need: (p: DashboardProject) => p.canEdit && p.readiness.blockers > 0 },
  ].filter((w) => w.n > 0);
  return (
    <div className="view-body dashboard">
      <section className="card" aria-labelledby="dashboard-summary">
        <h2 id="dashboard-summary" className="sr-only">
          {l('Summary', 'Résumé')}
        </h2>
        <ul className="stat-tiles">
          <li className="stat-tile">
            <span className="stat-label">{l('Projects', 'Projets')}</span>
            <strong>{data.totals.projects}</strong>
            <small className="muted">{l(`${data.totals.withBaseline} with a baseline`, `${data.totals.withBaseline} avec une référence`)}</small>
          </li>
          <li className="stat-tile">
            <span className="stat-label">{l('Ready for baseline', 'Prêts pour une référence')}</span>
            <strong>{data.totals.ready}</strong>
            <small className="muted">{l('no blocker left', 'aucun blocage')}</small>
          </li>
          <li className="stat-tile">
            <span className="stat-label">{l('Average completeness', 'Complétude moyenne')}</span>
            <strong>{data.totals.averageCompleteness} %</strong>
            <small className="muted">{l('answers, reviews and tests', 'réponses, révisions et tests')}</small>
          </li>
        </ul>
        {data.readOnly && (
          <p className="notice" role="note">
            <Eye size={15} aria-hidden /> {l('You can follow these projects; editing and reviewing need another role.', 'Vous pouvez suivre ces projets ; modifier et réviser demandent un autre rôle.')}
          </p>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="card" aria-labelledby="dashboard-waiting">
          <h2 id="dashboard-waiting">{l('Waiting for you', 'En attente de vous')}</h2>
          <ul className="waiting-list">
            {waiting.map((w) => {
              const target = data.projects.find(w.need);
              return (
                <li key={w.key}>
                  <w.icon size={16} aria-hidden />
                  <span>
                    <strong>{w.n}</strong> {w.label}
                  </span>
                  {target && (
                    <Button size="sm" variant="ghost" onClick={() => openProject(target.id, w.view)}>
                      {w.action(target.name)}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {data.projects.length === 0 ? (
        <EmptyState title={l('No projects yet', 'Aucun projet')}>
          <p className="muted">{l('Projects you are invited to appear here.', 'Les projets auxquels vous êtes invité apparaissent ici.')}</p>
        </EmptyState>
      ) : (
        <ul className="project-cards" aria-label={l('Projects', 'Projets')}>
          {data.projects.map((p) => (
            <li key={p.id} className="card project-card">
              <div className="project-card-head">
                <h2>{p.name}</h2>
                <Badge tone={p.canEdit ? 'blue' : p.canReview ? 'violet' : 'neutral'}>{p.role}</Badge>
              </div>
              <p className="muted small">
                {p.projectType} · {l('revision', 'révision')} {p.revision} · {formatDate(p.updatedAt, lang)}
              </p>
              <Metric value={p.completeness} label={l('Completeness', 'Complétude')} />
              <Metric value={p.readiness.percent} label={l('Required answers', 'Réponses obligatoires')} />
              <Metric value={p.security} label={l('Security coverage', 'Couverture de sécurité')} />
              <div className="inline-actions small">
                {p.readiness.ready ? (
                  <Badge tone="green">
                    <CheckCircle2 size={12} aria-hidden /> {l('Ready', 'Prêt')}
                  </Badge>
                ) : (
                  <Badge tone="amber">{l(`${p.readiness.blockers} blockers`, `${p.readiness.blockers} blocages`)}</Badge>
                )}
                {p.latestBaseline && <Badge>{l(`Baseline r${p.latestBaseline.revision}`, `Référence r${p.latestBaseline.revision}`)}</Badge>}
                {p.pendingProposals > 0 && <Badge tone="violet">{l(`${p.pendingProposals} proposals`, `${p.pendingProposals} propositions`)}</Badge>}
              </div>
              {p.board && (
                <p className="small board-summary">
                  <KanbanSquare size={14} aria-hidden /> {l('Board', 'Tableau')}: {p.board.done} {l('done', 'terminées')} · {p.board.review + p.board.doing} {l('in progress', 'en cours')} · {p.board.todo + p.board.backlog} {l('to do', 'à faire')}
                </p>
              )}
              <div className="inline-actions">
                <Button size="sm" variant="primary" onClick={() => openProject(p.id, 'overview')}>
                  {l('Open', 'Ouvrir')} <span className="sr-only">{p.name}</span>
                </Button>
                {p.board && (
                  <Button size="sm" onClick={() => openProject(p.id, 'board')}>
                    {l('Board', 'Tableau')} <span className="sr-only">{p.name}</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Dashboard({ openProject }: { openProject: (id: string, view: string) => void }) {
  const l = useL();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<DashboardData>('/dashboard').then(setData, (e) => setError((e as Error).message));
  }, []);
  if (error)
    return (
      <p className="error-text" role="alert">
        {error}
      </p>
    );
  if (!data) return <p className="muted">{l('Loading…', 'Chargement…')}</p>;
  return <DashboardContent data={data} openProject={openProject} />;
}
