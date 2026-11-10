import { lazy, Suspense, useEffect, useState } from 'react';
import { useLatest } from '../hooks';
import { Check, ChevronDown, ChevronRight, FolderOpen, PanelLeft, Search } from 'lucide-react';
import { Splitter } from '../components/Splitter';
import { moduleIcons } from '../icons';
import { Button, Tabs } from '../components/ui';
import { InterviewPanel, type Guidance } from './Interview';
import { DocumentPanel } from './DocumentPanel';
import { useL, useLocalized } from '../i18n';
import { useLocalStorage, type ProjectState } from '../state';
import { answerStatus } from '../../../../packages/shared/src/domain';
import { moduleQuestions, modules } from '../../../../packages/shared/src/templates';
import type { ConversationEntry } from '../builder-session';

const Builder = lazy(() => import('./Builder'));

const marks: Record<string, string> = { answered: '✓', unknown: '?', na: '–', empty: '○' };
function SectionIcon({ id }: { id: string }) {
  const Icon = moduleIcons[id];
  return Icon ? <Icon size={15} className="section-icon" aria-hidden /> : null;
}

function DocumentTree({
  project,
  sectionId,
  onSelect,
}: {
  project: ProjectState;
  sectionId: string;
  onSelect: (sectionId: string, questionId?: string) => void;
}) {
  const l = useL();
  const loc = useLocalized();
  const spec = project.spec!;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useLocalStorage<string[]>('sdd-checklist-open', []);
  const q = query.trim().toLowerCase();
  const statusLabel = (s: string) =>
    ({
      answered: l('answered', 'répondue'),
      unknown: l('unknown', 'inconnue'),
      na: l('not applicable', 'non applicable'),
      empty: l('not answered', 'sans réponse'),
    })[s];
  return (
    <nav
      className="document-tree"
      aria-label={l('Specification checklist', 'Liste de contrôle de la spécification')}
    >
      <div className="tree-title">
        <FolderOpen size={15} aria-hidden />
        <strong>{l('Specification', 'Spécification')}</strong>
      </div>
      <label className="search-box">
        <Search size={14} aria-hidden />
        <span className="sr-only">
          {l('Find a section or question', 'Trouver une section ou une question')}
        </span>
        <input
          placeholder={l('Find a section or question…', 'Trouver une section ou question…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ol className="section-list">
        {modules.map((m, i) => {
          const section = spec.sections.find((s) => s.id === m.id)!;
          const questions = moduleQuestions(m, spec);
          const matches = questions.filter(
            (x) => !q || `${loc(x.label)} ${loc(x.prompt)} ${x.id}`.toLowerCase().includes(q),
          );
          if (q && !loc(m.title).toLowerCase().includes(q) && !matches.length) return null;
          const answered = questions.filter(
            (x) => answerStatus(section.answers[x.id]) !== 'empty',
          ).length;
          const expanded = open.includes(m.id) || !!q;
          return (
            <li key={m.id}>
              <div className={`section-item ${sectionId === m.id ? 'selected' : ''}`}>
                <button
                  type="button"
                  className="expand"
                  aria-expanded={expanded}
                  aria-label={l(
                    `Show questions of ${loc(m.title)}`,
                    `Afficher les questions de ${loc(m.title)}`,
                  )}
                  onClick={() =>
                    setOpen(expanded ? open.filter((x) => x !== m.id) : [...open, m.id])
                  }
                >
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <button
                  type="button"
                  className="section-link"
                  aria-current={sectionId === m.id ? 'page' : undefined}
                  onClick={() => onSelect(m.id)}
                >
                  <span className={`section-dot ${section.status}`} aria-hidden>
                    {section.status === 'reviewed' ? (
                      <Check size={11} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  <SectionIcon id={m.id} />
                  <span className="section-name">{loc(m.title)}</span>
                  <span
                    className="section-count"
                    aria-label={l(
                      `${answered} of ${questions.length} answered`,
                      `${answered} sur ${questions.length} répondues`,
                    )}
                  >
                    {answered}/{questions.length}
                  </span>
                  {section.status === 'needs-review' && (
                    <span
                      className="attention"
                      title={l('Needs review', 'À réviser')}
                      aria-label={l('Needs review', 'À réviser')}
                    >
                      !
                    </span>
                  )}
                </button>
              </div>
              {expanded && (
                <ol className="checklist">
                  {matches.map((x) => {
                    const status = answerStatus(section.answers[x.id]);
                    return (
                      <li key={x.id}>
                        <button
                          type="button"
                          className={`check-item ${status}`}
                          onClick={() => onSelect(m.id, x.id)}
                        >
                          <span aria-hidden>{marks[status]}</span>
                          <span>{loc(x.label)}</span>
                          {x.required && (
                            <span
                              className="required-mark"
                              aria-label={l('required', 'obligatoire')}
                            >
                              *
                            </span>
                          )}
                          <span className="sr-only">, {statusLabel(status)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Workspace({
  project,
  editable,
  guidance,
  target,
  onTargetHandled,
  go,
  notify,
}: {
  project: ProjectState;
  editable: boolean;
  guidance: Guidance;
  target: { sectionId: string; questionId?: string } | null;
  onTargetHandled: () => void;
  go: (view: string, target?: { sectionId?: string; questionId?: string }) => void;
  notify: (message: string) => void;
}) {
  const l = useL();
  const [sectionId, setSectionId] = useLocalStorage(`sdd-section-${project.spec!.id}`, 'discovery');
  const [focusQuestion, setFocusQuestion] = useState<string | null>(null);
  const [treeWidth, setTreeWidth] = useLocalStorage('sdd-tree-width', 260);
  const [outlineOpen, setOutlineOpen] = useLocalStorage('sdd-outline-open', true);
  const [interviewWidth, setInterviewWidth] = useLocalStorage('sdd-interview-width', 560);
  const [narrowTab, setNarrowTab] = useState<'interview' | 'document'>('interview');
  const [mode, setMode] = useLocalStorage<'chat' | 'form'>(
    'sdd-section-mode',
    editable ? 'chat' : 'form',
  );
  const [entry, setEntry] = useState<ConversationEntry>();
  const select = (id: string, questionId?: string) => {
    if (id === sectionId && !questionId) return;
    setSectionId(id);
    setFocusQuestion(questionId ?? null);
    setNarrowTab('interview');
    const nextModule = modules.find((m) => m.id === id);
    const nextQuestion =
      questionId ??
      (nextModule &&
        moduleQuestions(nextModule, project.spec!).find(
          (q) =>
            answerStatus(project.spec!.sections.find((s) => s.id === id)?.answers[q.id]) ===
            'empty',
        )?.id);
    if (questionId && answerStatus(project.spec!.sections.find((s) => s.id === id)?.answers[questionId]) !== 'empty') {
      setMode('form');
      setEntry(undefined);
    } else if (nextQuestion) setEntry({ id: crypto.randomUUID(), questionId: nextQuestion });
    else { setEntry(undefined); setNarrowTab('document'); }
  };
  const latest = useLatest({ select, onTargetHandled });
  useEffect(() => {
    if (target) {
      latest.current.select(target.sectionId, target.questionId);
      if (target.questionId) setMode('form');
      latest.current.onTargetHandled();
    }
  }, [target, latest, setMode]);
  const module = modules.find((m) => m.id === sectionId) ?? modules[0];
  const section = project.spec!.sections.find((s) => s.id === module.id)!;
  return (
    <div className="workspace-shell">
      <div className="workspace-toolbar">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={outlineOpen}
          aria-controls="specification-outline"
          aria-label={outlineOpen ? l('Hide sections', 'Masquer les sections') : l('Show sections', 'Afficher les sections')}
          onClick={() => setOutlineOpen(!outlineOpen)}
        >
          <PanelLeft size={16} aria-hidden />
          {l('Sections', 'Sections')}
        </Button>
        <Tabs
          label={l('Section mode', 'Mode de section')}
          value={mode}
          onChange={setMode}
          items={[
            { id: 'chat', label: l('Chat', 'Discussion') },
            { id: 'form', label: l('Form', 'Formulaire') },
          ]}
        />
      </div>
      <div
        className={`workspace ${outlineOpen ? '' : 'outline-collapsed'}`}
        style={{
          ['--tree' as string]: `${treeWidth}px`,
          ['--interview' as string]: `${interviewWidth}px`,
        }}
      >
        <div id="specification-outline" className="outline-slot" hidden={!outlineOpen}>
          <DocumentTree project={project} sectionId={module.id} onSelect={select} />
        </div>
        {outlineOpen && (
          <Splitter
            value={treeWidth}
            min={200}
            max={420}
            onChange={setTreeWidth}
            label={l('Resize checklist', 'Redimensionner la liste')}
          />
        )}
        <div className="narrow-tabs">
          <Tabs
            label={l('Workspace panels', 'Panneaux de l’espace de travail')}
            value={narrowTab}
            onChange={setNarrowTab}
            items={[
              { id: 'interview', label: l('Interview', 'Entretien') },
              { id: 'document', label: l('Document', 'Document') },
            ]}
          />
        </div>
        <div className={`panel-slot interview-slot ${narrowTab === 'interview' ? 'shown' : ''}`}>
          {mode === 'chat' ? (
            <Suspense
              fallback={
                <p role="status">
                  {l('Loading conversation...', 'Chargement de la discussion...')}
                </p>
              }
            >
              <Builder
                key={project.spec!.id}
                project={project}
                embedded
                entry={entry}
                onEntryHandled={() => setEntry(undefined)}
                onSectionChange={setSectionId}
                notify={notify}
                go={(view, destination) => {
                  if (view === 'specification' && destination?.sectionId) {
                    select(destination.sectionId, destination.questionId);
                    setMode('form');
                  } else go(view, destination);
                }}
              />
            </Suspense>
          ) : (
            <InterviewPanel
              module={module}
              section={section}
              project={project}
              editable={editable}
              guidance={guidance}
              focusQuestion={focusQuestion}
              onFocused={() => setFocusQuestion(null)}
              onNextModule={() =>
                select(modules[(modules.indexOf(module) + 1) % modules.length].id)
              }
              onAskAi={(prompt, questionId) => {
                setEntry({ id: crypto.randomUUID(), prompt, questionId, sectionId: module.id });
                setMode('chat');
                setNarrowTab('interview');
              }}
            />
          )}
        </div>
        <Splitter
          value={interviewWidth}
          min={380}
          max={900}
          onChange={setInterviewWidth}
          label={l('Resize interview panel', 'Redimensionner l’entretien')}
        />
        <div className={`panel-slot document-slot ${narrowTab === 'document' ? 'shown' : ''}`}>
          <DocumentPanel module={module} section={section} project={project} editable={editable} />
        </div>
      </div>
    </div>
  );
}
