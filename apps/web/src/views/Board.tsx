import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileUp,
  GitPullRequest,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wand2,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { Badge, Button, EmptyState, Modal } from '../components/ui';
import { formatDate, useL, useLang } from '../i18n';
import { useFeatures } from '../features';
import { can } from '../../../../packages/shared/src/domain';
import {
  boardColumns,
  cardSchema,
  columnLabels,
  moveCard,
  pullRequestPattern,
  suggestedColumn,
  type Board as BoardData,
  type BoardColumn,
  type Card,
  type PullRequestStatus,
} from '../../../../packages/shared/src/board';
import { readyCards } from '../../../../packages/shared/src/task-plan';
import type { ProjectState } from '../state';

type Loaded = {
  board: BoardData;
  latestBaseline: { id: string; revision: number; approvedAt: string } | null;
};
type PlanPreview = { added: string[]; updated: string[]; skipped: string[] };

const stateTone: Record<PullRequestStatus['state'], string> = {
  open: 'blue',
  draft: 'neutral',
  merged: 'violet',
  closed: 'red',
  unknown: 'amber',
};
const checkTone: Record<PullRequestStatus['checks'], string> = {
  passing: 'green',
  failing: 'red',
  pending: 'amber',
  none: 'neutral',
  unknown: 'neutral',
};

export default function Board({
  project,
  notify,
  go,
}: {
  project: ProjectState;
  notify: (m: string) => void;
  /** Opens another view, used by the empty state's next step. */
  go?: (view: string) => void;
}) {
  const l = useL();
  const lang = useLang();
  const prStatus = useFeatures().on('pullRequests');
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState<BoardColumn | null>(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Card | null>(null);
  const [importing, setImporting] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, PullRequestStatus>>({});
  const [checkedAt, setCheckedAt] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api<Loaded>(`/projects/${spec.id}/board`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [spec.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const board = data?.board;
  const run = async (action: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.details?.currentRevision !== undefined) {
        notify(
          l(
            'The board changed elsewhere; showing the latest version.',
            'Le tableau a changé ailleurs; la dernière version est affichée.',
          ),
        );
        await load();
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = (cards: Card[]) =>
    run(async () => {
      if (!board) return;
      // Optimistic: show the move at once, then confirm with the server's revision.
      setData((d) => (d ? { ...d, board: { ...d.board, cards } } : d));
      const result = await api<{ board: BoardData }>(`/projects/${spec.id}/board`, 'PUT', {
        expectedRevision: board.revision,
        cards,
      });
      setData((d) => (d ? { ...d, board: result.board } : d));
    });
  const move = (id: string, column: BoardColumn, index?: number) =>
    board && save(moveCard(board.cards, id, column, index));

  const generate = () =>
    run(async () => {
      const result = await api<{ board: BoardData; added: string[]; obsolete: string[] }>(
        `/projects/${spec.id}/board/generate`,
        'POST',
        { expectedRevision: board!.revision },
      );
      setData((d) => (d ? { ...d, board: result.board } : d));
      notify(
        l(
          `${result.added.length} cards added${result.obsolete.length ? `, ${result.obsolete.length} marked obsolete` : ''}.`,
          `${result.added.length} cartes ajoutées${result.obsolete.length ? `, ${result.obsolete.length} marquées obsolètes` : ''}.`,
        ),
      );
    });

  const checkPullRequests = () =>
    run(async () => {
      const result = await api<{ statuses: PullRequestStatus[]; checkedAt: string }>(
        `/projects/${spec.id}/board/pull-requests`,
        'POST',
        {},
      );
      setStatuses(Object.fromEntries(result.statuses.map((s) => [s.url, s])));
      setCheckedAt(result.checkedAt);
    });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (board?.cards ?? []).filter(
      (c) =>
        !q ||
        `${c.id} ${c.title} ${c.group} ${c.assignee} ${c.sourceIds.join(' ')}`
          .toLowerCase()
          .includes(q),
    );
  }, [board, filter]);
  const hasPullRequests = board?.cards.some((c) => c.pullRequests.length);
  // A card in "to do" that still waits for cards that are not done.
  const waitingFor = useMemo(() => new Map(readyCards(board?.cards ?? []).blocked.map((b) => [b.card.id, b.blockedBy])), [board]);

  if (!data || !board)
    return (
      <div className="view-body">
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : (
          <p className="muted">{l('Loading board…', 'Chargement du tableau…')}</p>
        )}
      </div>
    );

  return (
    <div className="view-body board-view">
      <section className="card board-toolbar" aria-label={l('Board actions', 'Actions du tableau')}>
        <div>
          <p className="muted small">
            {data.latestBaseline
              ? l(
                  `Tasks come from baseline r${data.latestBaseline.revision} (${formatDate(data.latestBaseline.approvedAt, lang)}) and are created when a baseline is approved. Moving cards never changes the specification.`,
                  `Les tâches viennent de la référence r${data.latestBaseline.revision} (${formatDate(data.latestBaseline.approvedAt, lang)}) et sont créées quand une référence est approuvée. Déplacer une carte ne modifie jamais la spécification.`,
                )
              : l(
                  'Approve a baseline in Readiness and the project is split into tasks automatically, or import a .plan task list.',
                  'Approuvez une référence dans Préparation : le projet est découpé en tâches automatiquement. Vous pouvez aussi importer une liste .plan.',
                )}
          </p>
        </div>
        <div className="inline-actions">
          <label className="board-filter">
            <Search size={15} aria-hidden />
            <span className="sr-only">{l('Filter cards', 'Filtrer les cartes')}</span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={l('Filter cards', 'Filtrer les cartes')}
            />
          </label>
          {editable && (
            <Button variant="primary" onClick={generate} disabled={busy || !data.latestBaseline}>
              <Wand2 size={15} aria-hidden />{' '}
              {board.cards.length
                ? l('Refresh from baseline', 'Actualiser depuis la référence')
                : l('Create from baseline', 'Créer depuis la référence')}
            </Button>
          )}
          {editable && (
            <Button onClick={() => setImporting(true)} disabled={busy}>
              <FileUp size={15} aria-hidden /> {l('Import .plan', 'Importer .plan')}
            </Button>
          )}
          <Button asChild>
            <a href={`/api/v1/projects/${spec.id}/board/export-plan`} download="tasks.md">
              <Download size={15} aria-hidden /> {l('Export .plan', 'Exporter .plan')}
            </a>
          </Button>
          {prStatus && (
            <Button
              onClick={checkPullRequests}
              disabled={busy || !hasPullRequests}
              title={
                hasPullRequests
                  ? undefined
                  : l(
                      'Add pull-request links to cards first',
                      'Ajoutez d’abord des liens de demandes de fusion',
                    )
              }
            >
              <RefreshCw size={15} aria-hidden />{' '}
              {l('Check pull requests', 'Vérifier les demandes de fusion')}
            </Button>
          )}
          {editable && (
            <Button
              onClick={() =>
                setEditing(
                  cardSchema.parse({
                    id: nextCardId(board.cards),
                    title: l('New task', 'Nouvelle tâche'),
                    column: 'todo',
                  }),
                )
              }
              disabled={busy}
            >
              <Plus size={15} aria-hidden /> {l('Add card', 'Ajouter une carte')}
            </Button>
          )}
        </div>
        {checkedAt && (
          <p className="muted small">
            {l(
              `Pull-request status checked ${formatDate(checkedAt, lang)}.`,
              `État des demandes de fusion vérifié le ${formatDate(checkedAt, lang)}.`,
            )}
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </section>

      {board.gaps.length > 0 && (
        <section className="card" aria-labelledby="plan-gaps">
          <h3 id="plan-gaps">{l('Gaps the task plan found in the specification', 'Lacunes relevées par le plan de tâches')}</h3>
          <ul className="small">
            {board.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      )}

      {!board.cards.length ? (
        <EmptyState
          icon={<GitPullRequest size={28} aria-hidden />}
          title={l('No cards yet', 'Aucune carte')}
        >
          <p className="muted">
            {data.latestBaseline
              ? l('Your baseline is ready: split the project into tasks.', 'Votre référence est prête : découpez le projet en tâches.')
              : l(
                  'Approving a baseline splits the project into ordered tasks: foundations, then one epic per component, with tests, use cases and dependencies. You can also import .plan/tasks.md.',
                  'Approuver une référence découpe le projet en tâches ordonnées : mise en place, puis une épopée par composant, avec tests, cas d’utilisation et dépendances. Vous pouvez aussi importer .plan/tasks.md.',
                )}
          </p>
          {!data.latestBaseline && go && (
            <Button variant="primary" onClick={() => go('readiness')}>
              {l('Go to Readiness & baselines', 'Aller à Préparation et références')}
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="kanban" data-tour="board">
          {boardColumns.map((column) => {
            const cards = visible.filter((c) => c.column === column);
            return (
              <section
                key={column}
                className={`kanban-column ${over === column ? 'drop-target' : ''}`}
                aria-labelledby={`column-${column}`}
                onDragOver={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  setOver(column);
                }}
                onDragLeave={() => setOver((o) => (o === column ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData('application/x-sdd-card');
                  if (id) void move(id, column);
                }}
              >
                <h3 id={`column-${column}`}>
                  {columnLabels[column][lang]} <span className="count">{cards.length}</span>
                </h3>
                <ul>
                  {cards.map((card) => {
                    const prs = card.pullRequests.map((u) => statuses[u]).filter(Boolean);
                    const suggestion = suggestedColumn(prs);
                    return (
                      <li
                        key={card.id}
                        className={`kanban-card ${card.obsolete ? 'obsolete' : ''}`}
                        draggable={editable}
                        onDragStart={(e) =>
                          e.dataTransfer.setData('application/x-sdd-card', card.id)
                        }
                      >
                        <div className="kanban-card-head">
                          <code>{card.id}</code>
                          {card.group && <Badge>{card.group}</Badge>}
                          {card.obsolete && (
                            <Badge
                              tone="amber"
                              title={l(
                                'Its specification items are no longer in the latest baseline',
                                'Ses éléments ne sont plus dans la dernière référence',
                              )}
                            >
                              {l('Obsolete', 'Obsolète')}
                            </Badge>
                          )}
                        </div>
                        <strong className="kanban-title">{card.title}</strong>
                        {card.assignee && <span className="muted small">{card.assignee}</span>}
                        {card.sourceIds.filter((s) => s !== card.id).length > 0 && (
                          <span className="muted small">
                            {l('Traces to', 'Trace vers')}{' '}
                            {card.sourceIds.filter((s) => s !== card.id).join(', ')}
                          </span>
                        )}
                        {waitingFor.has(card.id) && (
                          <span className="muted small">
                            {l('Waits for', 'Attend')} {waitingFor.get(card.id)!.join(', ')}
                          </span>
                        )}
                        {card.pullRequests.map((url) => {
                          const s = statuses[url];
                          return (
                            <a
                              key={url}
                              className="kanban-pr"
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              <GitPullRequest size={13} aria-hidden />
                              <span>{s?.title || prLabel(url)}</span>
                              {s && !s.error && <Badge tone={stateTone[s.state]}>{s.state}</Badge>}
                              {s && !s.error && s.checks !== 'none' && (
                                <Badge tone={checkTone[s.checks]}>
                                  {l(`checks ${s.checks}`, `vérifications ${s.checks}`)}
                                </Badge>
                              )}
                              {s && !s.error && s.reviews !== 'unknown' && (
                                <Badge
                                  tone={
                                    s.reviews === 'approved'
                                      ? 'green'
                                      : s.reviews === 'changes-requested'
                                        ? 'red'
                                        : 'neutral'
                                  }
                                >
                                  {s.reviews}
                                </Badge>
                              )}
                              {s?.error && (
                                <Badge tone="amber" title={s.error}>
                                  {l('status unavailable', 'état indisponible')}
                                </Badge>
                              )}
                              <ExternalLink size={12} aria-hidden />
                              <span className="sr-only">
                                {l('(opens in a new tab)', '(ouvre un nouvel onglet)')}
                              </span>
                            </a>
                          );
                        })}
                        {editable && suggestion && suggestion !== card.column && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void move(card.id, suggestion)}
                          >
                            {l(
                              `Pull requests suggest “${columnLabels[suggestion].en}” — move`,
                              `Les demandes suggèrent « ${columnLabels[suggestion].fr} » — déplacer`,
                            )}
                          </Button>
                        )}
                        {editable && (
                          <div className="kanban-card-actions">
                            <label className="add-to">
                              <span className="sr-only">
                                {l(
                                  `Move ${card.id} to another column`,
                                  `Déplacer ${card.id} vers une autre colonne`,
                                )}
                              </span>
                              <select
                                value=""
                                onChange={(e) =>
                                  e.target.value &&
                                  void move(card.id, e.target.value as BoardColumn)
                                }
                                disabled={busy}
                              >
                                <option value="">{l('Move…', 'Déplacer…')}</option>
                                {boardColumns
                                  .filter((c) => c !== column)
                                  .map((c) => (
                                    <option key={c} value={c}>
                                      {columnLabels[c][lang]}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={l(`Edit ${card.id}`, `Modifier ${card.id}`)}
                              onClick={() => setEditing(card)}
                            >
                              <Pencil size={14} />
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <CardEditor
          card={editing}
          isNew={!board.cards.some((c) => c.id === editing.id)}
          existingIds={board.cards.map((c) => c.id)}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            const exists = board.cards.some((c) => c.id === editing.id);
            await save(
              exists
                ? board.cards.map((c) => (c.id === editing.id ? next : c))
                : [...board.cards, next],
            );
            setEditing(null);
          }}
          onRemove={async () => {
            await save(board.cards.filter((c) => c.id !== editing.id));
            setEditing(null);
          }}
        />
      )}
      {importing && (
        <PlanImport
          projectId={spec.id}
          revision={board.revision}
          onClose={() => setImporting(false)}
          onImported={(next, summary) => {
            setData((d) => (d ? { ...d, board: next } : d));
            setImporting(false);
            notify(
              l(
                `${summary.added.length} added, ${summary.updated.length} updated.`,
                `${summary.added.length} ajoutées, ${summary.updated.length} mises à jour.`,
              ),
            );
          }}
        />
      )}
    </div>
  );
}

function nextCardId(cards: Card[]) {
  let n = cards.length + 1;
  const ids = new Set(cards.map((c) => c.id));
  while (ids.has(`TASK-${String(n).padStart(3, '0')}`)) n++;
  return `TASK-${String(n).padStart(3, '0')}`;
}

function prLabel(url: string) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return `${parts[1] ?? parts[0]} #${parts.at(-1)}`;
}

function CardEditor({
  card,
  isNew,
  existingIds,
  onClose,
  onSave,
  onRemove,
}: {
  card: Card;
  isNew: boolean;
  existingIds: string[];
  onClose: () => void;
  onSave: (card: Card) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const l = useL();
  const lang = useLang();
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onOpenChange={onClose}
      title={
        isNew ? l('Add card', 'Ajouter une carte') : l(`Edit ${card.id}`, `Modifier ${card.id}`)
      }
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const id = String(f.get('id') ?? card.id).trim();
          const pullRequests = String(f.get('pullRequests') ?? '')
            .split(/\s+/)
            .filter(Boolean);
          const bad = pullRequests.find((u) => !pullRequestPattern.test(u));
          if (bad)
            return setError(
              l(
                `Not a GitHub, GitLab or Azure DevOps pull request: ${bad}`,
                `Pas une demande de fusion GitHub, GitLab ou Azure DevOps : ${bad}`,
              ),
            );
          if (isNew && existingIds.includes(id))
            return setError(l(`${id} already exists`, `${id} existe déjà`));
          const parsed = cardSchema.safeParse({
            ...card,
            id,
            title: String(f.get('title') ?? '').trim(),
            body: String(f.get('body') ?? ''),
            assignee: String(f.get('assignee') ?? '').trim(),
            group: String(f.get('group') ?? '').trim(),
            column: f.get('column'),
            pullRequests,
          });
          if (!parsed.success)
            return setError(
              parsed.error.issues[0]?.message ?? l('Check the fields', 'Vérifiez les champs'),
            );
          await onSave(parsed.data);
        }}
      >
        <label>
          {l('Identifier', 'Identifiant')}
          <input name="id" defaultValue={card.id} readOnly={!isNew} required maxLength={60} />
        </label>
        <label>
          {l('Title', 'Titre')}
          <input name="title" defaultValue={card.title} required maxLength={500} />
        </label>
        <label>
          {l('Details or acceptance criteria', 'Détails ou critères d’acceptation')}
          <textarea name="body" defaultValue={card.body} rows={4} maxLength={5000} />
        </label>
        <div className="form-row">
          <label>
            {l('Column', 'Colonne')}
            <select name="column" defaultValue={card.column}>
              {boardColumns.map((c) => (
                <option key={c} value={c}>
                  {columnLabels[c][lang]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {l('Group', 'Groupe')}
            <input name="group" defaultValue={card.group} maxLength={200} />
          </label>
          <label>
            {l('Assignee', 'Responsable')}
            <input name="assignee" defaultValue={card.assignee} maxLength={200} />
          </label>
        </div>
        <label>
          {l('Pull requests (one URL per line)', 'Demandes de fusion (une URL par ligne)')}
          <textarea
            name="pullRequests"
            defaultValue={card.pullRequests.join('\n')}
            rows={2}
            placeholder="https://github.com/org/repo/pull/12"
          />
          <small className="muted">
            {l(
              'GitHub, GitLab or Azure DevOps. Status is read only when you select “Check pull requests”.',
              'GitHub, GitLab ou Azure DevOps. L’état est lu seulement quand vous choisissez « Vérifier ».',
            )}
          </small>
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {!isNew && (
            <Button type="button" variant="danger" onClick={() => void onRemove()}>
              <Trash2 size={15} aria-hidden /> {l('Remove card', 'Retirer la carte')}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            {l('Cancel', 'Annuler')}
          </Button>
          <Button type="submit" variant="primary">
            {l('Save card', 'Enregistrer la carte')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PlanImport({
  projectId,
  revision,
  onClose,
  onImported,
}: {
  projectId: string;
  revision: number;
  onClose: () => void;
  onImported: (board: BoardData, summary: PlanPreview) => void;
}) {
  const l = useL();
  const [markdown, setMarkdown] = useState('');
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [error, setError] = useState('');
  const send = async (dryRun: boolean) => {
    setError('');
    try {
      const result = await api<PlanPreview & { board: BoardData }>(
        `/projects/${projectId}/board/import-plan`,
        'POST',
        { expectedRevision: revision, markdown, preview: dryRun },
      );
      if (dryRun) setPreview(result);
      else onImported(result.board, result);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal open onOpenChange={onClose} title={l('Import .plan tasks', 'Importer les tâches .plan')}>
      <div className="form-stack">
        <p className="muted small">
          {l(
            'Checkbox lines become cards: [x] done, [/] in progress, [ ] to do, [-] backlog. Headings become groups. Cards are matched by identifier (TASK-001); cards missing from the file are kept.',
            'Les cases deviennent des cartes : [x] terminé, [/] en cours, [ ] à faire, [-] carnet. Les titres deviennent des groupes. Les cartes sont associées par identifiant (TASK-001); celles absentes du fichier sont conservées.',
          )}
        </p>
        <label>
          {l('tasks.md file', 'Fichier tasks.md')}
          <input
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 500_000)
                return setError(l('The file is larger than 500 KB.', 'Le fichier dépasse 500 Ko.'));
              setMarkdown(await file.text());
              setPreview(null);
            }}
          />
        </label>
        <label>
          {l('Or paste the Markdown', 'Ou collez le Markdown')}
          <textarea
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value);
              setPreview(null);
            }}
            rows={8}
            className="mono"
          />
        </label>
        {preview && (
          <div className="card" role="status">
            <p>
              {l(
                `${preview.added.length} new cards, ${preview.updated.length} updated.`,
                `${preview.added.length} nouvelles cartes, ${preview.updated.length} mises à jour.`,
              )}
            </p>
            {preview.skipped.length > 0 && (
              <ul className="small">
                {preview.skipped.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            {l('Cancel', 'Annuler')}
          </Button>
          <Button onClick={() => void send(true)} disabled={!markdown.trim()}>
            {l('Preview', 'Aperçu')}
          </Button>
          <Button variant="primary" onClick={() => void send(false)} disabled={!preview}>
            {l('Import', 'Importer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
