import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Check, GitCompare, GitMerge, RefreshCw, Sparkles, X } from 'lucide-react';
import { api, ApiError } from '../api';
import { Badge, Button, EmptyState, Segmented } from '../components/ui';
import { formatDate, useL, useLang } from '../i18n';
import { useFeatures } from '../features';
import { describePath, displayValue } from '../paths';
import { can } from '../../../../packages/shared/src/domain';
import type { Change, Conflict, Proposal, Source } from '../../../../packages/shared/src/schema';
import type { ProjectState } from '../state';
import { SourceDocuments } from '../components/SourceDocuments';

const GeneratedUIForm = lazy(() => import('../components/GeneratedUI'));
const DiffView = lazy(() => import('../components/Editors').then((m) => ({ default: m.DiffView })));
type Full = Proposal & {
  openSpecSources?: Record<string, string>;
  changes?: Change[];
  conflicts?: Conflict[];
  resolvedConflicts?: (Conflict & { choice: string })[];
  uiRejected?: string;
  provider?: string;
  model?: string;
  reason?: string;
};

function ChangeList({ changes }: { changes: Change[] }) {
  const l = useL();
  const lang = useLang();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="change-list">
      {changes.map((c) => {
        const before = displayValue(c.path, c.before, lang);
        const after = displayValue(c.path, c.after, lang);
        const long =
          before.length + after.length > 240 || before.includes('\n') || after.includes('\n');
        return (
          <li key={c.path}>
            <div className="change-heading">
              <Badge tone={c.kind === 'added' ? 'green' : c.kind === 'removed' ? 'red' : 'blue'}>
                {c.kind === 'added'
                  ? l('added', 'ajout')
                  : c.kind === 'removed'
                    ? l('removed', 'retrait')
                    : l('changed', 'modifié')}
              </Badge>
              <strong>{describePath(c.path, lang)}</strong>
              {long && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={open === c.path}
                  onClick={() => setOpen(open === c.path ? null : c.path)}
                >
                  <GitCompare size={13} />{' '}
                  {open === c.path ? l('Hide', 'Masquer') : l('Compare', 'Comparer')}
                </Button>
              )}
            </div>
            {long ? (
              open === c.path && (
                <Suspense fallback={null}>
                  <DiffView
                    original={before}
                    modified={after}
                    label={describePath(c.path, lang)}
                    height="280px"
                  />
                </Suspense>
              )
            ) : (
              <p className="inline-diff">
                {before && <del>{before}</del>} {after && <ins>{after}</ins>}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ConflictChoices({
  proposal,
  projectId,
  onDone,
}: {
  proposal: Full;
  projectId: string;
  onDone: () => void;
}) {
  const l = useL();
  const lang = useLang();
  const [choices, setChoices] = useState<Record<string, 'local' | 'remote'>>({});
  const [error, setError] = useState('');
  return (
    <section className="conflicts" aria-label={l('Conflicts to resolve', 'Conflits à résoudre')}>
      <h4>
        <GitMerge size={15} aria-hidden />{' '}
        {l(
          'Changed both here and in Git — choose each version',
          'Modifié ici et dans Git — choisissez chaque version',
        )}
      </h4>
      {proposal.conflicts!.map((c) => (
        <div key={c.path} className="conflict">
          <strong>{describePath(c.path, lang)}</strong>
          <div className="compare">
            <div>
              <em>{l('In SDD Studio', 'Dans SDD Studio')}</em>
              <pre>{displayValue(c.path, c.current, lang) || l('(empty)', '(vide)')}</pre>
            </div>
            <div>
              <em>{l('In Git', 'Dans Git')}</em>
              <pre>{displayValue(c.path, c.yours, lang) || l('(removed)', '(supprimé)')}</pre>
            </div>
          </div>
          <Segmented
            label={l(
              `Version to keep for ${describePath(c.path, lang)}`,
              `Version à garder pour ${describePath(c.path, lang)}`,
            )}
            value={choices[c.path] ?? ('' as any)}
            onChange={(v) => setChoices({ ...choices, [c.path]: v })}
            items={[
              { id: 'local', label: l('Keep SDD Studio version', 'Garder la version SDD Studio') },
              { id: 'remote', label: l('Use Git version', 'Utiliser la version Git') },
            ]}
          />
        </div>
      ))}
      {error && <p className="error-text">{error}</p>}
      <Button
        disabled={proposal.conflicts!.some((c) => !choices[c.path])}
        onClick={() =>
          api(`/projects/${projectId}/proposals/${proposal.id}/resolve`, 'POST', { choices })
            .then(onDone)
            .catch((e) => setError(e.message))
        }
      >
        {l('Apply my choices', 'Appliquer mes choix')}
      </Button>
      <p className="muted small">
        {l(
          'Both versions stay recorded on this proposal after you choose.',
          'Les deux versions restent consignées dans cette proposition après votre choix.',
        )}
      </p>
    </section>
  );
}

function ProposalCard({
  proposal,
  project,
  reload,
}: {
  proposal: Full;
  project: ProjectState;
  reload: () => void;
}) {
  const l = useL();
  const features = useFeatures();
  const lang = useLang();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const stale = proposal.status === 'pending' && proposal.baseRevision !== spec.revision;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await Promise.all([project.reload(), reload()]);
    } catch (e) {
      const conflict = e instanceof ApiError ? e.conflict : undefined;
      setError(
        conflict?.conflicts.length
          ? `${e instanceof Error ? e.message : ''} ${conflict.conflicts.map((c) => describePath(c.path, lang)).join('; ')}`
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };
  const origin = {
    ai: l('AI', 'IA'),
    git: 'Git',
    import: l('Import', 'Import'),
    manual: l('Markdown edit', 'Modification Markdown'),
    agent: l('Coding agent (MCP)', 'Agent de code (MCP)'),
  }[proposal.origin];
  return (
    <article className={`proposal ${proposal.status}`} aria-labelledby={`p-${proposal.id}`}>
      <header>
        <h3 id={`p-${proposal.id}`}>{proposal.title}</h3>
        <div className="proposal-meta">
          <Badge
            tone={
              proposal.origin === 'ai'
                ? 'violet'
                : proposal.origin === 'git'
                  ? 'amber'
                  : proposal.origin === 'agent'
                    ? 'blue'
                    : 'neutral'
            }
          >
            {origin}
          </Badge>
          {proposal.model && (
            <span className="muted small">
              {proposal.provider === 'claude-agent' ? 'Claude Agent' : proposal.provider} ·{' '}
              {proposal.model}
            </span>
          )}
          <span className="muted small">
            {l('Based on revision', 'Basée sur la révision')} {proposal.baseRevision} ·{' '}
            {formatDate(proposal.createdAt, lang)}
          </span>
          <Badge
            tone={
              proposal.status === 'accepted'
                ? 'green'
                : proposal.status === 'rejected'
                  ? 'red'
                  : 'blue'
            }
          >
            {
              {
                pending: l('pending', 'en attente'),
                accepted: l('accepted', 'acceptée'),
                rejected: l('rejected', 'rejetée'),
              }[proposal.status]
            }
          </Badge>
        </div>
      </header>
      {stale && (
        <p className="notice warning">
          {l(
            `The specification is now at revision ${spec.revision}. Rebase this proposal to check it still applies without overwriting newer edits.`,
            `La spécification est à la révision ${spec.revision}. Rebasez cette proposition pour vérifier qu’elle s’applique sans écraser les modifications récentes.`,
          )}
        </p>
      )}
      <div className="proposal-grid">
        <section>
          <h4>{l('Affected fields and document changes', 'Champs et documents touchés')}</h4>
          {proposal.changes?.length ? (
            <ChangeList changes={proposal.changes} />
          ) : (
            <p className="muted">{l('No changes.', 'Aucun changement.')}</p>
          )}
        </section>
        <aside>
          <h4>{l('Assumptions', 'Hypothèses')}</h4>
          {proposal.assumptions.length ? (
            <ul>
              {proposal.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">{l('None stated.', 'Aucune indiquée.')}</p>
          )}
          <h4>{l('Sources', 'Sources')}</h4>
          {proposal.openSpecSources && <SourceDocuments files={proposal.openSpecSources} />}
          {proposal.sources.length ? (
            <ul>
              {proposal.sources.map((s: Source) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.title}
                  </a>{' '}
                  <Badge>{s.kind}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {l(
                'No sources cited. Treat claims as unverified.',
                'Aucune source citée. Considérez les affirmations comme non vérifiées.',
              )}
            </p>
          )}
          {proposal.uiRejected && (
            <p className="muted small">
              {l(
                'A generated form was rejected by validation; use the interview instead.',
                'Un formulaire généré a été rejeté par la validation ; utilisez l’entretien.',
              )}
            </p>
          )}
        </aside>
      </div>
      {proposal.ui?.length && features.on('generatedUi') ? (
        <section>
          <h4>
            <Sparkles size={14} aria-hidden /> {l('Follow-up questions', 'Questions de suivi')}
          </h4>
          <Suspense fallback={null}>
            <GeneratedUIForm
              ui={proposal.ui}
              disabled={!editable}
              onSubmit={async (index, value) => {
                const next = await api(
                  `/projects/${spec.id}/proposals/${proposal.id}/controls/${index}`,
                  'POST',
                  {
                    expectedRevision: project.spec!.revision,
                    value,
                  },
                );
                project.accept(next);
              }}
            />
          </Suspense>
        </section>
      ) : null}
      {proposal.conflicts?.length ? (
        <ConflictChoices proposal={proposal} projectId={spec.id} onDone={reload} />
      ) : null}
      {proposal.resolvedConflicts?.length ? (
        <details>
          <summary>
            {l(
              'Resolved conflicts (both versions kept)',
              'Conflits résolus (deux versions conservées)',
            )}
          </summary>
          <ul>
            {proposal.resolvedConflicts.map((c) => (
              <li key={c.path}>
                {describePath(c.path, lang)} —{' '}
                {c.choice === 'remote'
                  ? l('Git version chosen', 'version Git choisie')
                  : l('SDD Studio version kept', 'version SDD Studio gardée')}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {proposal.status === 'pending' && editable && (
        <div className="inline-actions">
          {stale ? (
            <Button
              disabled={busy}
              onClick={() =>
                act(() => api(`/projects/${spec.id}/proposals/${proposal.id}/rebase`, 'POST'))
              }
            >
              <RefreshCw size={14} /> {l('Rebase onto latest', 'Rebaser sur la dernière révision')}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={busy || !!proposal.conflicts?.length}
              onClick={() =>
                act(() => api(`/projects/${spec.id}/proposals/${proposal.id}/accept`, 'POST'))
              }
            >
              <Check size={14} /> {l('Accept changes', 'Accepter les changements')}
            </Button>
          )}
          {rejecting === null ? (
            <Button variant="ghost" disabled={busy} onClick={() => setRejecting('')}>
              <X size={14} /> {l('Reject', 'Rejeter')}
            </Button>
          ) : (
            <>
              <label className="grow">
                <span className="sr-only">
                  {l('Reason for rejecting (optional)', 'Raison du rejet (facultatif)')}
                </span>
                <input
                  autoFocus
                  value={rejecting}
                  maxLength={2000}
                  placeholder={l('Reason (optional)', 'Raison (facultatif)')}
                  onChange={(e) => setRejecting(e.target.value)}
                />
              </label>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  act(() =>
                    api(`/projects/${spec.id}/proposals/${proposal.id}/reject`, 'POST', {
                      reason: rejecting,
                    }),
                  )
                }
              >
                {l('Confirm rejection', 'Confirmer le rejet')}
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                {l('Cancel', 'Annuler')}
              </Button>
            </>
          )}
        </div>
      )}
      {proposal.status === 'rejected' && proposal.reason && (
        <p className="muted small">{proposal.reason}</p>
      )}
    </article>
  );
}

export default function Proposals({
  project,
  onAskAi,
}: {
  project: ProjectState;
  onAskAi: () => void;
}) {
  const l = useL();
  const aiEnabled = useFeatures().on('ai');
  const spec = project.spec!;
  const [proposals, setProposals] = useState<Full[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const reload = useCallback(
    () => api<Full[]>(`/projects/${spec.id}/proposals`).then(setProposals),
    [spec.id],
  );
  // Revision and pending count are refresh triggers: someone accepted or added a proposal.
  useEffect(() => {
    reload().catch(() => {});
  }, [reload, spec.revision, project.pendingProposals]);
  const shown = proposals.filter((p) => filter === 'all' || p.status === 'pending');
  return (
    <div className="view-body">
      <div>
        <div className="view-toolbar">
          <Segmented
            label={l('Proposals shown', 'Propositions affichées')}
            value={filter}
            onChange={setFilter}
            items={[
              {
                id: 'pending',
                label: l(
                  `Pending (${proposals.filter((p) => p.status === 'pending').length})`,
                  `En attente (${proposals.filter((p) => p.status === 'pending').length})`,
                ),
              },
              { id: 'all', label: l('All', 'Toutes') },
            ]}
          />
          {can(project.role, 'edit') && aiEnabled && (
            <Button variant="primary" onClick={onAskAi}>
              <Sparkles size={15} /> {l('Ask AI', 'Demander à l’IA')}
            </Button>
          )}
        </div>
        {shown.length ? (
          shown.map((p) => (
            <ProposalCard key={p.id} proposal={p} project={project} reload={reload} />
          ))
        ) : (
          <EmptyState
            icon={<Sparkles size={26} />}
            title={l('Nothing to review', 'Rien à réviser')}
          >
            <p className="muted">{l('No pending proposals.', 'Aucune proposition en attente.')}</p>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
