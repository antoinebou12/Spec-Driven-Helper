import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLatest } from '../hooks';
import { Clock, FileText, Link2, Plus, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, Tabs } from '../components/ui';
import { Diagram, Markdown } from '../components/Markdown';
import { DiagramServices } from '../components/DiagramServices';
import { DiagramBatch } from '../components/DiagramBatch';
import { formatDate, useL, useLang, useLocalized } from '../i18n';
import { useFeatures } from '../features';
import { useDebouncedSave, type ProjectState } from '../state';
import { describePath } from '../paths';
import { refreshSectionMarkdown } from '../../../../packages/shared/src/markdown';
import type { Module } from '../../../../packages/shared/src/templates';
import type { Section, Spec } from '../../../../packages/shared/src/schema';

const MarkdownEditor = lazy(() => import('../components/Editors').then((m) => ({ default: m.MarkdownEditor })));
const DiffView = lazy(() => import('../components/Editors').then((m) => ({ default: m.DiffView })));

type Tab = 'preview' | 'edit' | 'diagram' | 'history';
type Revision = {
  revision: number;
  at: string;
  authorName: string;
  provenance?: { origin: string; proposalId?: string; note?: string };
  changes?: { path: string; kind: string }[];
};
const statusTone: Record<string, string> = { reviewed: 'green', 'needs-review': 'amber', draft: 'neutral' };

function MarkdownTab({ section, project, editable }: { section: Section; project: ProjectState; editable: boolean }) {
  const l = useL();
  const [draft, setDraft] = useState(section.markdown);
  const saved = useRef(section.markdown);
  const epoch = useRef(project.epoch);
  // Bumped when the document changes from outside (teammate, accepted proposal, discarded
  // conflict) while the author has no unsaved edits; it remounts the uncontrolled editor.
  const [external, setExternal] = useState(0);
  const latestDraft = useLatest(draft);
  useEffect(() => {
    const draft = latestDraft.current;
    if ((draft === saved.current && draft !== section.markdown) || epoch.current !== project.epoch) {
      setDraft(section.markdown);
      setExternal((n) => n + 1);
    }
    epoch.current = project.epoch;
    saved.current = section.markdown;
  }, [section.markdown, project.epoch, latestDraft]);
  const dirty = draft !== saved.current;
  const flush = useDebouncedSave(draft, dirty && editable, async (markdown) => {
    const result = await project.save({ sections: [{ id: section.id, markdown }] }, l('Document', 'Document'));
    if (result) saved.current = markdown;
  }, 1500);
  return (
    <div className="editor-tab">
      <p className="editor-notice">
        <span title={l('Answer blocks require proposal review; other text saves directly.', 'Les blocs de réponse exigent une révision ; le reste est enregistré directement.')}>{l('Autosave', 'Auto-enregistrement')}</span>
        <span className={`save-dot ${dirty ? 'unsaved' : 'saved'}`} role="status">
          {dirty ? l('Unsaved', 'Non enregistré') : l('Saved', 'Enregistré')}
        </span>
      </p>
      <Suspense fallback={<p className="muted">{l('Loading editor…', 'Chargement de l’éditeur…')}</p>}>
        <MarkdownEditor key={`${section.id}-${external}`} value={draft} onChange={setDraft} onBlur={flush} readOnly={!editable} label={l('Markdown document', 'Document Markdown')} height="560px" />
      </Suspense>
    </div>
  );
}

function DiagramTab({ module, section, project, editable }: { module: Module; section: Section; project: ProjectState; editable: boolean }) {
  const l = useL();
  const loc = useLocalized();
  const diagrams = useFeatures().on('diagrams');
  const [code, setCode] = useState(section.diagram);
  useEffect(() => setCode(section.diagram), [section.diagram]);
  return (
    <div className="form-stack">
      {editable && diagrams && <DiagramBatch key={section.id} project={project} sectionId={section.id} />}
      <label>
        {l('Start from a template', 'Partir d’un modèle')}
        <select
          value=""
          disabled={!editable}
          onChange={(e) => {
            const template = module.diagrams.find((d) => d.id === e.target.value);
            if (template) setCode(template.code);
          }}
        >
          <option value="">{l('Choose a diagram template…', 'Choisir un modèle de diagramme…')}</option>
          {module.diagrams.map((d) => (
            <option key={d.id} value={d.id}>
              {loc(d.title)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {l('Mermaid source', 'Source Mermaid')}
        <textarea className="code" rows={10} value={code} disabled={!editable} spellCheck={false} onChange={(e) => setCode(e.target.value)} />
      </label>
      <div className="inline-actions">
        <Button variant="primary" disabled={!editable || code === section.diagram} onClick={() => project.save({ sections: [{ id: section.id, diagram: code }] }, l('Diagram', 'Diagramme'))}>
          {l('Save diagram', 'Enregistrer le diagramme')}
        </Button>
        {section.diagram && (
          <Button variant="ghost" disabled={!editable} onClick={() => project.save({ sections: [{ id: section.id, diagram: '' }] })}>
            <Trash2 size={14} /> {l('Remove diagram', 'Retirer le diagramme')}
          </Button>
        )}
      </div>
      {code ? <Diagram code={code} label={l('Diagram preview', 'Aperçu du diagramme')} /> : null}
      {editable && diagrams && <DiagramServices projectId={project.spec!.id} source={code} />}
    </div>
  );
}

function HistoryTab({ spec, section }: { spec: Spec; section: Section }) {
  const l = useL();
  const lang = useLang();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [onlySection, setOnlySection] = useState(true);
  const [selected, setSelected] = useState<{ revision: number; before: string; after: string } | null>(null);
  useEffect(() => {
    api<Revision[]>(`/projects/${spec.id}/history`).then(setRevisions).catch(() => {});
  }, [spec.id, spec.revision]);
  const prefix = `sections.${section.id}.`;
  const shown = onlySection ? revisions.filter((r) => r.changes?.some((c) => c.path.startsWith(prefix))) : revisions;
  const open = async (revision: number) => {
    const [after, before] = await Promise.all([
      api(`/projects/${spec.id}/revisions/${revision}`),
      revision > 0 ? api(`/projects/${spec.id}/revisions/${revision - 1}`).catch(() => null) : null,
    ]);
    const md = (s: Spec | undefined) => s?.sections.find((x) => x.id === section.id)?.markdown ?? '';
    setSelected({ revision, before: md(before?.spec), after: md(after.spec) });
  };
  const origin: Record<string, string> = {
    manual: l('Edit', 'Modification'),
    ai: l('AI proposal', 'Proposition IA'),
    git: 'Git',
    import: l('Import', 'Import'),
    review: l('Review', 'Révision'),
    'generated-ui': l('Generated form', 'Formulaire généré'),
    agent: l('Coding agent (MCP)', 'Agent de code (MCP)'),
    created: l('Created', 'Création'),
    example: l('Example', 'Exemple'),
  };
  return (
    <div className="history">
      <label className="check-label">
        <input type="checkbox" checked={onlySection} onChange={(e) => setOnlySection(e.target.checked)} />
        {l('Only revisions that changed this section', 'Seulement les révisions de cette section')}
      </label>
      <ol className="history-list">
        {shown.map((r) => (
          <li key={r.revision}>
            <button type="button" className={selected?.revision === r.revision ? 'selected' : ''} onClick={() => open(r.revision)}>
              <Clock size={14} aria-hidden />
              <strong>
                {l('Revision', 'Révision')} {r.revision}
              </strong>
              <Badge tone={r.provenance?.origin === 'ai' ? 'violet' : r.provenance?.origin === 'git' ? 'amber' : 'neutral'}>
                {origin[r.provenance?.origin ?? ''] ?? r.provenance?.origin ?? '—'}
              </Badge>
              <span className="muted small">
                {r.authorName} · {formatDate(r.at, lang)}
              </span>
            </button>
            {r.changes?.length ? (
              <ul className="change-paths">
                {r.changes.slice(0, 6).map((c) => (
                  <li key={c.path}>
                    {c.kind === 'added' ? '+' : c.kind === 'removed' ? '−' : '~'} {describePath(c.path, lang)}
                  </li>
                ))}
                {r.changes.length > 6 && <li className="muted">+{r.changes.length - 6}</li>}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      {selected && (
        <Suspense fallback={null}>
          <h4>
            {l(`Changes in revision ${selected.revision}`, `Changements de la révision ${selected.revision}`)}
          </h4>
          <DiffView original={selected.before} modified={selected.after} label={l('Revision comparison', 'Comparaison des révisions')} height="420px" />
        </Suspense>
      )}
    </div>
  );
}

export function DocumentPanel({ module, section, project, editable }: { module: Module; section: Section; project: ProjectState; editable: boolean }) {
  const l = useL();
  const [tab, setTab] = useState<Tab>('preview');
  const [toolsOpen, setToolsOpen] = useState(false);
  const spec = project.spec!;
  const refresh = () => {
    const markdown = refreshSectionMarkdown(module, section, spec.language, spec);
    if (markdown !== section.markdown) project.save({ sections: [{ id: section.id, markdown }] }, l('Document', 'Document'));
  };
  const statusLabel = { reviewed: l('Reviewed', 'Révisée'), 'needs-review': l('Needs review', 'À réviser'), draft: l('Draft', 'Brouillon') }[section.status];
  return (
    <section className="document-panel" aria-label={l('Document', 'Document')}>
      <div className="panel-heading">
        <span>
          <FileText size={15} aria-hidden /> {section.id}.md
        </span>
        <Badge tone={statusTone[section.status]}>{statusLabel}</Badge>
        <Button size="icon" variant="ghost" title={l('Tools', 'Outils')} aria-label={l('Document tools', 'Outils du document')} aria-expanded={toolsOpen} aria-controls="document-tools" onClick={() => { setToolsOpen(!toolsOpen); if (toolsOpen) setTab('preview'); }}><SlidersHorizontal size={15} aria-hidden /></Button>
      </div>
      {toolsOpen && <div className="document-toolbar" id="document-tools">
        <Tabs
          label={l('Document views', 'Vues du document')}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'preview', label: l('Preview', 'Aperçu') },
            { id: 'edit', label: l('Edit', 'Modifier') },
            { id: 'diagram', label: l('Diagram', 'Diagramme') },
            { id: 'history', label: l('History', 'Historique') },
          ]}
        />
        <Button size="sm" variant="ghost" disabled={!editable} onClick={refresh} title={l('Rewrite answer blocks and add missing questions; free text is kept', 'Réécrire les blocs de réponse et ajouter les questions manquantes ; le texte libre est conservé')}>
          <RefreshCw size={14} /> {l('Refresh', 'Actualiser')}
        </Button>
      </div>}
      <div className="document-content">
        {tab === 'preview' ? (
          <>
            <div className="doc-meta">
              <span>{spec.name}</span>
              <span>
                {l('REV', 'RÉV')} {spec.revision}
              </span>
            </div>
            <Markdown text={section.markdown} />
            {section.diagram && <Diagram code={section.diagram} />}
            <References section={section} project={project} editable={editable} />
          </>
        ) : tab === 'edit' ? (
          <MarkdownTab section={section} project={project} editable={editable} />
        ) : tab === 'diagram' ? (
          <DiagramTab module={module} section={section} project={project} editable={editable} />
        ) : (
          <HistoryTab spec={spec} section={section} />
        )}
      </div>
    </section>
  );
}

function References({ section, project, editable }: { section: Section; project: ProjectState; editable: boolean }) {
  const l = useL();
  const setReferences = (references: Section['references']) => project.save({ sections: [{ id: section.id, references }] }, l('References', 'Références'));
  return (
    <section className="document-references" aria-labelledby={`refs-${section.id}`}>
      <h3 id={`refs-${section.id}`} className="references-title">
        <Link2 size={14} aria-hidden /> {l('References', 'Références')}
      </h3>
      {section.references.length ? (
        <ul>
          {section.references.map((r) => (
            <li key={r.id}>
              <a href={r.url} target="_blank" rel="noreferrer noopener">
                {r.title}
              </a>{' '}
              <Badge tone={r.kind === 'official' ? 'neutral' : 'blue'}>{r.kind === 'official' ? l('official', 'officielle') : l('custom', 'personnalisée')}</Badge>
              {editable && (
                <Button size="icon" variant="ghost" aria-label={l(`Remove ${r.title}`, `Retirer ${r.title}`)} onClick={() => setReferences(section.references.filter((x) => x.id !== r.id))}>
                  <Trash2 size={13} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{l('No references yet.', 'Aucune référence pour l’instant.')}</p>
      )}
      {editable && (
        <form
          className="reference-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setReferences([
              ...section.references,
              { id: crypto.randomUUID(), title: String(f.get('title')), url: String(f.get('url')), kind: f.get('official') ? 'official' : 'custom' },
            ]);
            e.currentTarget.reset();
          }}
        >
          <input name="title" aria-label={l('Reference title', 'Titre de la référence')} placeholder={l('Title', 'Titre')} required maxLength={500} />
          <input name="url" type="url" pattern="https?://.+" aria-label={l('Reference URL', 'Adresse de la référence')} placeholder="https://…" required />
          <label className="check-label">
            <input type="checkbox" name="official" /> {l('Official source', 'Source officielle')}
          </label>
          <Button type="submit" size="sm">
            <Plus size={14} /> {l('Add', 'Ajouter')}
          </Button>
        </form>
      )}
    </section>
  );
}
