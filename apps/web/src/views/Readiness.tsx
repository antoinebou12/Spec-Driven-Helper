import { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Download, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import { Badge, Button } from '../components/ui';
import { SecurityChecklist } from '../components/SecurityChecklist';
import { formatDate, useL, useLang, useLocalized } from '../i18n';
import { answerStatus, can, describeIssue, isComplete, readiness as readinessOf, sectionNeedsReview } from '../../../../packages/shared/src/domain';
import { moduleQuestions, modules } from '../../../../packages/shared/src/templates';
import type { ProjectState } from '../state';

type Baseline = { id: string; revision: number; note: string; approvedAt: string; approvedBy: string };

export default function Readiness({
  project,
  notify,
  go,
}: {
  project: ProjectState;
  notify: (m: string) => void;
  /** Opens a question in the interview (from the security checklist). */
  go?: (view: string, target?: { sectionId?: string; questionId?: string }) => void;
}) {
  const l = useL();
  const lang = useLang();
  const loc = useLocalized();
  const spec = project.spec!;
  const r = project.readiness!;
  const reviewer = can(project.role, 'review');
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api<Baseline[]>(`/projects/${spec.id}/baselines`).then(setBaselines).catch(() => {});
  }, [spec.id, spec.revision]);
  const review = async (sectionId: string) => {
    setError('');
    try {
      project.accept(await api(`/projects/${spec.id}/review/${sectionId}`, 'POST', { expectedRevision: spec.revision }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const approve = async (reviewAll = false) => {
    setError('');
    try {
      const approved = await api<{ tasks: { added: number; gaps: string[] } | null }>(`/projects/${spec.id}/baselines`, 'POST', { expectedRevision: spec.revision, note, ...(reviewAll ? { reviewAll: true } : {}) });
      setNote('');
      setBaselines(await api(`/projects/${spec.id}/baselines`));
      // Reviewing every section changed the specification itself.
      if (reviewAll) await project.reload();
      const added = approved.tasks?.added ?? 0;
      const gaps = approved.tasks?.gaps.length ?? 0;
      notify(
        l(
          `Baseline approved. It can no longer change. ${added} tasks were created on the board${gaps ? `, with ${gaps} gaps to look at` : ''}.`,
          `Référence approuvée. Elle ne peut plus changer. ${added} tâches ont été créées sur le tableau${gaps ? `, avec ${gaps} lacunes à examiner` : ''}.`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  // Only sections that need a review count (at the essentials level, those that hold a required question).
  const needReview = spec.sections.filter((s) => sectionNeedsReview(spec, s.id));
  const hasRequiredDone = (id: string) => moduleQuestions(modules.find((m) => m.id === id)!, spec).filter((q) => q.required).every((q) => isComplete(spec.sections.find((s) => s.id === id)!.answers[q.id]));
  const reviewable = needReview.filter((s) => s.status !== 'reviewed' && hasRequiredDone(s.id));
  // One action when reviews are all that stands in the way: review them and approve (the server checks again).
  const oneClick =
    reviewer && !r.ready && reviewable.length > 0 && readinessOf({ ...spec, sections: spec.sections.map((s) => (reviewable.includes(s) ? { ...s, status: 'reviewed' as const } : s)) }).ready;
  const blockers = r.issues.filter((i) => i.severity === 'blocker');
  const warnings = r.issues.filter((i) => i.severity === 'warning');
  const blockerGroups = [...Map.groupBy(blockers, (i) => i.code)];
  const issueGroupTitle = (code: string) =>
    ({
      'required-missing': l('Required answers', 'Réponses obligatoires'),
      'unknown-answer': l('Answers marked unknown', 'Réponses marquées inconnues'),
      'section-unreviewed': l('Sections not reviewed', 'Sections non révisées'),
      'decision-pending': l('Decisions still in draft', 'Décisions encore en brouillon'),
      'requirement-untested': l('Requirements without a test', 'Exigences sans test'),
      'no-requirements': l('No requirement yet', 'Aucune exigence'),
      'item-needs-review': l('Items to review', 'Éléments à réviser'),
      contradiction: l('Contradictions', 'Contradictions'),
      'open-conflict': l('Open conflicts', 'Conflits ouverts'),
    })[code] ?? code;
  /** Where a blocker gets fixed: the question, the traceability items, or the proposals. */
  const fixTarget = (i: (typeof blockers)[number]) => {
    if (!go) return null;
    if (i.code === 'unknown-answer' && i.target) return () => go('specification', { sectionId: i.target!.split('.')[0], questionId: i.target });
    if (i.code === 'required-missing') return () => go('specification');
    if (['decision-pending', 'requirement-untested', 'no-requirements', 'item-needs-review', 'contradiction'].includes(i.code)) return () => go('traceability');
    if (i.code === 'open-conflict') return () => go('proposals');
    return null;
  };
  return (
    <div className="view-body readiness-layout">
      <section className="card readiness-summary" aria-labelledby="readiness-title">
        <h3 id="readiness-title">
          {r.ready ? <CheckCircle2 size={18} className="ok" aria-hidden /> : <ShieldCheck size={18} aria-hidden />}{' '}
          {r.ready ? l('Ready for baseline approval', 'Prête pour l’approbation') : l('Not ready yet', 'Pas encore prête')}
        </h3>
        <div className="stat-row">
          <div>
            <strong>{r.percent}%</strong>
            <small>
              {l('required answers', 'réponses obligatoires')} ({r.complete}/{r.total})
            </small>
          </div>
          <div>
            <strong>{needReview.filter((s) => s.status === 'reviewed').length}/{needReview.length}</strong>
            <small>{l('sections reviewed', 'sections révisées')}</small>
          </div>
          <div>
            <strong>{blockers.length}</strong>
            <small>{l('blockers', 'blocages')}</small>
          </div>
        </div>
        {blockers.length > 0 && (
          <p className="readiness-next" role="note">
            <strong>{l('Next step:', 'Prochaine étape :')}</strong> {describeIssue(blockers[0], lang)}
          </p>
        )}
        {blockerGroups.length > 0 && (
          <>
            <h4>{l(`Blockers by kind (${blockers.length})`, `Blocages par type (${blockers.length})`)}</h4>
            {blockerGroups.map(([code, items], n) => (
              <details key={code} className="issue-group" open={n === 0 && code !== 'section-unreviewed'}>
                <summary>
                  {issueGroupTitle(code)} <Badge tone="amber">{items.length}</Badge>
                </summary>
                <ul className="issue-list">
                  {items.map((i, k) => (
                    <li key={k}>
                      {describeIssue(i, lang)}
                      {i.code === 'section-unreviewed' && i.target && (
                        <a className="button small ghost" aria-label={l(`Review ${i.target}`, `Réviser ${i.target}`)} href={`#section-review-${i.target}`} onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(`section-review-${i.target}`)?.focus();
                        }}>{l('Review', 'Réviser')}<span className="sr-only"> {i.target}</span></a>
                      )}
                      {go && fixTarget(i) && (
                        <Button size="sm" variant="ghost" onClick={() => fixTarget(i)!()}>
                          {l('Fix', 'Corriger')}
                          <span className="sr-only"> {describeIssue(i, lang)}</span>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </>
        )}
        {warnings.length > 0 && (
          <details className="issue-group">
            <summary>
              <TriangleAlert size={14} aria-hidden /> {l('Warnings (do not block approval)', 'Avertissements (ne bloquent pas l’approbation)')} <Badge>{warnings.length}</Badge>
            </summary>
            <ul className="issue-list warning">
              {warnings.map((i, n) => (
                <li key={n}>{describeIssue(i, lang)}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section className="card" aria-labelledby="sections-title">
        <h3 id="sections-title">{l('Section reviews', 'Révision des sections')}</h3>
        {!reviewer && <p className="muted small">{l('Reviewers, administrators and owners can mark sections reviewed.', 'Les réviseurs, administrateurs et propriétaires peuvent réviser les sections.')}</p>}
        <div className="table-scroll" tabIndex={0} role="region" aria-label={l('Section reviews table', 'Tableau des révisions de sections')}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{l('Section', 'Section')}</th>
              <th scope="col">{l('Required answered', 'Obligatoires répondues')}</th>
              <th scope="col">{l('Status', 'Statut')}</th>
              <th scope="col">
                <span className="sr-only">{l('Actions', 'Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const section = spec.sections.find((s) => s.id === m.id)!;
              const required = moduleQuestions(m, spec).filter((q) => q.required);
              const done = required.filter((q) => ['answered', 'na'].includes(answerStatus(section.answers[q.id]))).length;
              return (
                <tr key={m.id} id={`section-review-${m.id}`} tabIndex={-1}>
                  <th scope="row">{loc(m.title)}</th>
                  <td>
                    {done}/{required.length}
                  </td>
                  <td>
                    <Badge tone={section.status === 'reviewed' ? 'green' : section.status === 'needs-review' ? 'amber' : 'neutral'}>
                      {section.status !== 'reviewed' && !sectionNeedsReview(spec, m.id)
                        ? l('Not required', 'Non requise')
                        : { reviewed: l('Reviewed', 'Révisée'), 'needs-review': l('Needs review', 'À réviser'), draft: l('Draft', 'Brouillon') }[section.status]}
                    </Badge>
                  </td>
                  <td>
                    {reviewer && section.status !== 'reviewed' && sectionNeedsReview(spec, m.id) && (
                      <Button size="sm" disabled={done < required.length} onClick={() => review(m.id)}>
                        <BadgeCheck size={14} /> {l('Mark reviewed', 'Marquer révisée')}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>
      <section className="card" aria-labelledby="baseline-title">
        <h3 id="baseline-title">{l('Baselines', 'Références')}</h3>
        <p className="muted small">
          {l('An approved baseline is an immutable snapshot of the specification. Publishing and scaffolding use the latest baseline.', 'Une référence approuvée est un instantané immuable de la spécification. La publication et l’échafaudage utilisent la dernière référence.')}
        </p>
        {reviewer && (
          <div className="form-stack">
            <label>
              {l('Approval note', 'Note d’approbation')}
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </label>
            {/* One prominent action: when "Review all and approve" is offered, this one cannot be used yet. */}
            <Button variant={oneClick ? 'secondary' : 'primary'} disabled={!r.ready} onClick={() => approve()}>
              <ShieldCheck size={15} /> {l(`Approve revision ${spec.revision} as baseline`, `Approuver la révision ${spec.revision} comme référence`)}
            </Button>
            {oneClick && (
              <>
                <Button variant="primary" onClick={() => approve(true)}>
                  <BadgeCheck size={15} /> {l('Review all and approve', 'Tout réviser et approuver')}
                </Button>
                <p className="muted small">
                  {l(
                    `Marks the ${reviewable.length} sections that are complete as reviewed, approves revision ${spec.revision} as the baseline and creates the tasks. Nothing is changed if it cannot be approved.`,
                    `Marque ${reviewable.length} sections complètes comme révisées, approuve la révision ${spec.revision} comme référence et crée les tâches. Rien n’est modifié si l’approbation est impossible.`,
                  )}
                </p>
              </>
            )}
          </div>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <ul className="baseline-list">
          {baselines.map((b) => (
            <li key={b.id}>
              <div>
                <strong>
                  {l('Revision', 'Révision')} {b.revision}
                </strong>
                <small className="muted">{formatDate(b.approvedAt, lang)}</small>
                {b.note && <p>{b.note}</p>}
              </div>
              <div className="inline-actions">
                {(['json', 'markdown', 'zip'] as const).map((f) => (
                  <a key={f} className="button small ghost" href={`/api/v1/projects/${spec.id}/baselines/${b.id}/export/${f}`} download>
                    <Download size={13} aria-hidden /> {f === 'zip' ? l('Agent bundle', 'Paquet agents') : f.toUpperCase()}
                  </a>
                ))}
              </div>
            </li>
          ))}
          {!baselines.length && <li className="muted">{l('No approved baseline yet.', 'Aucune référence approuvée.')}</li>}
        </ul>
      </section>
      <SecurityChecklist spec={spec} onOpenQuestion={go ? (id) => go('specification', { sectionId: id.split('.')[0], questionId: id }) : undefined} />
    </div>
  );
}
