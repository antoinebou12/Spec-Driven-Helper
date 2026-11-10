import { useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, EmptyState, Modal, Tabs } from '../components/ui';
import { useL } from '../i18n';
import { can, downstreamOf, nextItemId, nextLinkId, upstreamOf } from '../../../../packages/shared/src/domain';
import { UseCaseEditor } from '../components/UseCaseEditor';
import { itemTypes, linkKinds, type Item, type Link } from '../../../../packages/shared/src/schema';
import type { ProjectState } from '../state';

type Filter = 'all' | Item['type'] | 'review';

function ItemDialog({ item, project, onClose }: { item: Item | 'new'; project: ProjectState; onClose: () => void }) {
  const l = useL();
  const spec = project.spec!;
  const creating = item === 'new';
  const [draft, setDraft] = useState<Item>(
    creating
      ? { id: nextItemId(spec, 'requirement'), type: 'requirement', title: '', body: '', status: 'draft', acceptance: '', owner: '', needsReview: false }
      : item,
  );
  const [linkKind, setLinkKind] = useState<Link['kind']>('tests');
  const [linkTarget, setLinkTarget] = useState('');
  const [newLinks, setNewLinks] = useState<Link[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const links = [...spec.links.filter((x) => (x.from === draft.id || x.to === draft.id) && !removed.includes(x.id)), ...newLinks];
  const reviewer = can(project.role, 'review');
  const typeLabel = (t: Item['type']) =>
    ({ requirement: l('Requirement', 'Exigence'), 'use-case': l('Use case', 'Cas d’utilisation'), decision: l('Decision (ADR)', 'Décision (ADR)'), component: l('Component', 'Composant'), risk: l('Risk', 'Risque'), test: l('Test', 'Test') })[t];
  const kindLabel = (k: Link['kind']) =>
    ({
      satisfies: l('satisfies', 'satisfait'),
      implements: l('implements', 'implémente'),
      tests: l('tests', 'teste'),
      'depends-on': l('depends on', 'dépend de'),
      decides: l('decides', 'décide'),
      mitigates: l('mitigates', 'atténue'),
      refines: l('refines', 'précise'),
      contradicts: l('contradicts', 'contredit'),
    })[k];
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await project.save(
      { items: [draft], links: newLinks, removeLinks: removed },
      draft.id,
    );
    if (result) onClose();
  };
  return (
    <Modal open wide onOpenChange={onClose} title={creating ? l('New specification item', 'Nouvel élément') : `${draft.id} — ${draft.title}`}>
      <form className="form-stack" onSubmit={save}>
        <div className="form-grid">
          <label>
            {l('Type', 'Type')}
            <select
              value={draft.type}
              disabled={!creating}
              onChange={(e) => {
                const type = e.target.value as Item['type'];
                setDraft({ ...draft, type, id: nextItemId(spec, type) });
              }}
            >
              {itemTypes.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {l('Identifier', 'Identifiant')}
            <input value={draft.id} readOnly={!creating} pattern="[A-Za-z0-9][\w.\-]*" required onChange={(e) => setDraft({ ...draft, id: e.target.value.trim() })} />
          </label>
          {draft.type === 'requirement' && (
            <label>
              {l('Priority', 'Priorité')}
              <select value={draft.priority ?? ''} onChange={(e) => setDraft({ ...draft, priority: (e.target.value || undefined) as Item['priority'] })}>
                <option value="">—</option>
                <option value="must">{l('Must', 'Doit')}</option>
                <option value="should">{l('Should', 'Devrait')}</option>
                <option value="could">{l('Could', 'Pourrait')}</option>
                <option value="wont">{l('Won’t', 'Pas maintenant')}</option>
              </select>
            </label>
          )}
          <label>
            {l('Status', 'Statut')}
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Item['status'] })}>
              <option value="draft">{l('Draft', 'Brouillon')}</option>
              {reviewer && <option value="accepted">{l('Accepted', 'Accepté')}</option>}
              {!reviewer && draft.status === 'accepted' && <option value="accepted">{l('Accepted', 'Accepté')}</option>}
              <option value="superseded">{l('Superseded', 'Remplacé')}</option>
            </select>
          </label>
          <label>
            {l('Owner', 'Responsable')}
            <input value={draft.owner} maxLength={200} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
          </label>
        </div>
        <label>
          {l('Title', 'Titre')}
          <input value={draft.title} required maxLength={500} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        {draft.type === 'use-case' ? (
          <UseCaseEditor value={draft.body} onChange={(body) => setDraft({ ...draft, body })} />
        ) : (
          <label>
            {draft.type === 'decision' ? l('Context, decision and consequences', 'Contexte, décision et conséquences') : l('Description', 'Description')}
            <textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
        )}
        {(draft.type === 'requirement' || draft.type === 'test' || draft.type === 'use-case') && (
          <label>
            {l('Acceptance criteria', 'Critères d’acceptation')}
            <textarea
              rows={3}
              value={draft.acceptance}
              placeholder={l('Given … when … then … (with a measurable threshold)', 'Étant donné … quand … alors … (avec un seuil mesurable)')}
              onChange={(e) => setDraft({ ...draft, acceptance: e.target.value })}
            />
          </label>
        )}
        {!creating && !reviewer && draft.status === 'accepted' && (
          <p className="muted small">{l('Changing an accepted item returns it to draft until a reviewer accepts it again.', 'Modifier un élément accepté le remet en brouillon jusqu’à une nouvelle acceptation.')}</p>
        )}
        <fieldset className="link-editor">
          <legend>
            <Link2 size={14} aria-hidden /> {l('Links', 'Liens')}
          </legend>
          <ul>
            {links.map((x) => (
              <li key={x.id}>
                <span>
                  {x.from} <em>{kindLabel(x.kind)}</em> {x.to}
                </span>
                <Button size="icon" variant="ghost" aria-label={l(`Remove link ${x.id}`, `Retirer le lien ${x.id}`)} onClick={() => (newLinks.some((n) => n.id === x.id) ? setNewLinks(newLinks.filter((n) => n.id !== x.id)) : setRemoved([...removed, x.id]))}>
                  <Trash2 size={13} />
                </Button>
              </li>
            ))}
            {!links.length && <li className="muted">{l('No links yet.', 'Aucun lien.')}</li>}
          </ul>
          <div className="inline-actions">
            <span>{draft.id}</span>
            <select aria-label={l('Relationship', 'Relation')} value={linkKind} onChange={(e) => setLinkKind(e.target.value as Link['kind'])}>
              {linkKinds.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
                </option>
              ))}
            </select>
            <select aria-label={l('Linked item', 'Élément lié')} value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)}>
              <option value="">{l('Choose an item…', 'Choisir un élément…')}</option>
              {spec.items
                .filter((i) => i.id !== draft.id)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} — {i.title.slice(0, 60)}
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              disabled={!linkTarget}
              onClick={() => {
                const taken = { links: [...spec.links, ...newLinks] };
                setNewLinks([...newLinks, { id: nextLinkId(taken), from: draft.id, to: linkTarget, kind: linkKind }]);
                setLinkTarget('');
              }}
            >
              <Plus size={13} /> {l('Add link', 'Ajouter le lien')}
            </Button>
          </div>
          <p className="muted small">{l('Read as “this item [relationship] the chosen item”, e.g. TEST-001 tests REQ-001.', 'Lire « cet élément [relation] l’élément choisi », p. ex. TEST-001 teste REQ-001.')}</p>
        </fieldset>
        <div className="modal-actions">
          {!creating && (
            <Button
              variant="danger"
              onClick={async () => {
                if (window.confirm(l(`Delete ${draft.id} and its links? This is recorded in the revision history.`, `Supprimer ${draft.id} et ses liens ? Ceci est consigné dans l’historique.`))) {
                  if (await project.save({ removeItems: [draft.id] })) onClose();
                }
              }}
            >
              <Trash2 size={14} /> {l('Delete', 'Supprimer')}
            </Button>
          )}
          <Button type="submit" variant="primary">
            {l('Save item', 'Enregistrer l’élément')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Traceability({ project }: { project: ProjectState }) {
  const l = useL();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const reviewer = can(project.role, 'review');
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<'items' | 'matrix'>('items');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const items = useMemo(
    () =>
      spec.items.filter(
        (i) =>
          (filter === 'all' || (filter === 'review' ? i.needsReview : i.type === filter)) &&
          `${i.id} ${i.title} ${i.body}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [spec.items, filter, query],
  );
  const reviewItem = async (id: string, status?: Item['status']) =>
    project.accept(await api(`/projects/${spec.id}/items/${id}/review`, 'POST', { expectedRevision: spec.revision, status }));
  const requirements = spec.items.filter((i) => i.type === 'requirement' && i.status !== 'superseded');
  const tests = spec.items.filter((i) => i.type === 'test' && i.status !== 'superseded');
  const count = (f: Filter) => spec.items.filter((i) => (f === 'review' ? i.needsReview : f === 'all' || i.type === f)).length;
  return (
    <div className="view-body">
      <div className="view-toolbar">
        <Tabs
          label={l('Traceability views', 'Vues de traçabilité')}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'items', label: l('Items', 'Éléments') },
            { id: 'matrix', label: l('Coverage matrix', 'Matrice de couverture') },
          ]}
        />
        <label className="search-box">
          <Search size={14} aria-hidden />
          <span className="sr-only">{l('Search items', 'Rechercher des éléments')}</span>
          <input value={query} placeholder={l('Search items…', 'Rechercher…')} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {editable && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={15} /> {l('Add item', 'Ajouter un élément')}
          </Button>
        )}
      </div>
      {tab === 'items' ? (
        <>
          <div className="filter-chips" role="group" aria-label={l('Filter by type', 'Filtrer par type')}>
            {(['all', 'requirement', 'use-case', 'decision', 'component', 'risk', 'test', 'review'] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {{ all: l('All', 'Tous'), requirement: l('Requirements', 'Exigences'), 'use-case': l('Use cases', 'Cas d’utilisation'), decision: l('Decisions (ADRs)', 'Décisions (ADR)'), component: l('Components', 'Composants'), risk: l('Risks', 'Risques'), test: l('Tests', 'Tests'), review: l('Needs review', 'À réviser') }[f]}{' '}
                <span className="count">{count(f)}</span>
              </button>
            ))}
          </div>
          {items.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">{l('Item', 'Élément')}</th>
                    <th scope="col">{l('Status', 'Statut')}</th>
                    <th scope="col">{l('Traces to', 'Relié à')}</th>
                    <th scope="col">
                      <span className="sr-only">{l('Actions', 'Actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const up = spec.links.filter((x) => downstreamOf(x) === item.id);
                    const down = spec.links.filter((x) => upstreamOf(x) === item.id);
                    return (
                      <tr key={item.id} className={item.status === 'superseded' ? 'superseded' : ''}>
                        <td className="mono">{item.id}</td>
                        <td>
                          <strong>{item.title}</strong>
                          {item.acceptance && <small className="muted block">{item.acceptance}</small>}
                        </td>
                        <td>
                          <Badge tone={item.status === 'accepted' ? 'green' : item.status === 'superseded' ? 'neutral' : 'blue'}>
                            {{ draft: l('Draft', 'Brouillon'), accepted: l('Accepted', 'Accepté'), superseded: l('Superseded', 'Remplacé') }[item.status]}
                          </Badge>
                          {item.priority && <Badge>{item.priority}</Badge>}
                          {item.needsReview && (
                            <Badge tone="amber" title={l('An upstream item changed', 'Un élément amont a changé')}>
                              <AlertTriangle size={11} aria-hidden /> {l('Needs review', 'À réviser')}
                            </Badge>
                          )}
                        </td>
                        <td className="small">
                          {[...up.map((x) => `${x.kind} ${upstreamOf(x)}`), ...down.map((x) => `← ${downstreamOf(x)} (${x.kind})`)].join(', ') || '—'}
                        </td>
                        <td className="row-actions">
                          {reviewer && (item.needsReview || (item.status === 'draft' && ['decision', 'requirement'].includes(item.type))) && (
                            <Button size="sm" onClick={() => reviewItem(item.id, item.status === 'draft' ? 'accepted' : undefined)}>
                              <BadgeCheck size={13} /> {item.status === 'draft' ? l('Accept', 'Accepter') : l('Confirm', 'Confirmer')}
                            </Button>
                          )}
                          {editable && (
                            <Button size="icon" variant="ghost" aria-label={l(`Edit ${item.id}`, `Modifier ${item.id}`)} onClick={() => setEditing(item)}>
                              <Pencil size={14} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Link2 size={26} />} title={l('No items here yet', 'Aucun élément ici')}>
              <p className="muted">{l('Requirements, use cases, decisions, components, risks and tests get stable identifiers and can be linked together.', 'Exigences, cas d’utilisation, décisions, composants, risques et tests reçoivent des identifiants stables et peuvent être reliés.')}</p>
            </EmptyState>
          )}
        </>
      ) : (
        <div className="table-wrap">
          <table className="data-table matrix">
            <caption className="sr-only">{l('Requirements verified by tests', 'Exigences vérifiées par des tests')}</caption>
            <thead>
              <tr>
                <th scope="col">{l('Requirement', 'Exigence')}</th>
                {tests.map((t) => (
                  <th key={t.id} scope="col" title={t.title}>
                    {t.id}
                  </th>
                ))}
                <th scope="col">{l('Covered', 'Couverte')}</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((r) => {
                const covered = tests.filter((t) => spec.links.some((x) => x.kind === 'tests' && x.from === t.id && x.to === r.id));
                return (
                  <tr key={r.id}>
                    <th scope="row">
                      {r.id} <small className="muted">{r.title}</small>
                    </th>
                    {tests.map((t) => (
                      <td key={t.id} className="center">
                        {covered.includes(t) ? <span aria-label={l('verified', 'vérifiée')}>●</span> : <span className="muted" aria-label={l('not linked', 'non liée')}>·</span>}
                      </td>
                    ))}
                    <td>{covered.length ? <Badge tone="green">{l('Yes', 'Oui')}</Badge> : <Badge tone="red">{l('No', 'Non')}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ItemDialog item={editing} project={project} onClose={() => setEditing(null)} />}
    </div>
  );
}
