import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  GitBranch,
  BookText,
  HelpCircle,
  KanbanSquare,
  MessagesSquare,
  Keyboard,
  LayoutGrid,
  Layers,
  Layers3,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  Type,
  X,
} from 'lucide-react';
import { api } from './api';
import { useLatest } from './hooks';
import { Badge, Button, Modal, Segmented } from './components/ui';
import { ConflictDialog } from './components/ConflictDialog';
import { NewProject } from './components/NewProject';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { Tour } from './components/Tour';
import { tourSteps } from './tour-steps';
import { LanguageProvider, useL } from './i18n';
import { FeaturesProvider, useFeatures } from './features';
import { useLocalStorage, useProject, type ProjectState } from './state';
import { applyTheme, useAppearance } from './appearance';
import { Workspace } from './views/Workspace';
import Login from './views/Login';
import type { Guidance } from './views/Interview';
import { can } from '../../../packages/shared/src/domain';
import type { Language } from '../../../packages/shared/src/templates';
import type { Role } from '../../../packages/shared/src/schema';

const Builder = lazy(() => import('./views/Builder'));
const Overview = lazy(() => import('./views/Overview'));
const Stack = lazy(() => import('./views/Stack'));
const Traceability = lazy(() => import('./views/Traceability'));
const Proposals = lazy(() => import('./views/Proposals'));
const Readiness = lazy(() => import('./views/Readiness'));
const Publishing = lazy(() => import('./views/Publishing'));
const SettingsView = lazy(() => import('./views/Settings'));
const SearchView = lazy(() => import('./views/Search'));
const BoardView = lazy(() => import('./views/Board'));
const DashboardView = lazy(() => import('./views/Dashboard'));

type User = { id: string; name: string; email: string; role: Role };
type ProjectSummary = {
  id: string;
  name: string;
  projectType: string;
  percent: number;
  role: Role;
};
const views = [
  'builder',
  'overview',
  'stack',
  'import',
  'specification',
  'traceability',
  'proposals',
  'readiness',
  'publishing',
  'settings',
  'search',
  'board',
  'dashboard',
] as const;
type View = (typeof views)[number];
/** Sidebar order; Alt+1…9 and Alt+0 open its first ten entries. */
const navOrder: View[] = [
  'builder',
  'overview',
  'stack',
  'specification',
  'traceability',
  'proposals',
  'readiness',
  'board',
  'publishing',
];

const fonts = {
  system: {
    label: ['System sans-serif', 'Sans empattement du système'],
    stack: "'Inter', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  },
  readable: {
    label: ['High legibility', 'Haute lisibilité'],
    stack: "'Atkinson Hyperlegible', Verdana, Tahoma, 'DejaVu Sans', sans-serif",
  },
  humanist: {
    label: ['Humanist', 'Humaniste'],
    stack: "'Segoe UI', 'Gill Sans', 'Trebuchet MS', 'Noto Sans', 'Ubuntu', sans-serif",
  },
  serif: {
    label: ['Serif', 'Avec empattement'],
    stack: "Charter, 'Bitstream Charter', Georgia, Cambria, 'Times New Roman', serif",
  },
  mono: {
    label: ['Monospace', 'Chasse fixe'],
    stack: "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace",
  },
} as const;
type FontId = keyof typeof fonts;
type DisplayPrefs = { font: FontId; size: number };


function parseHash(): { projectId?: string; view?: View } {
  const [, p, id, previousView] = location.hash.split('/');
  const view =
    previousView === 'catalog'
      ? 'stack'
      : previousView === 'questions'
        ? 'specification'
        : previousView;
  return p === 'p'
    ? { projectId: id, view: views.includes(view as View) ? (view as View) : 'builder' }
    : {};
}

export default function App() {
  const [lang, setLang] = useLocalStorage<Language>(
    'sdd-language',
    navigator.language.startsWith('fr') ? 'fr' : 'en',
  );
  return (
    <LanguageProvider lang={lang}>
      <FeaturesProvider>
        <Shell lang={lang} setLang={setLang} />
      </FeaturesProvider>
    </LanguageProvider>
  );
}

function Shell({ lang, setLang }: { lang: Language; setLang: (l: Language) => void }) {
  const l = useL();
  const features = useFeatures();
  const visibleOrder = navOrder.filter((v) => !features.hidden.has(v));
  const { theme, choice: appearance, setChoice: setAppearance } = useAppearance();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | undefined>(parseHash().projectId);
  const [view, setView] = useState<View>(parseHash().view ?? 'builder');
  const [collapsed, setCollapsed] = useLocalStorage('sdd-sidebar-collapsed', false);
  // The sidebar folds itself into an icon rail on medium-width windows and opens again when there
  // is room; the toggle in the top bar still works in between.
  useEffect(() => {
    const narrow = window.matchMedia?.('(min-width: 761px) and (max-width: 1100px)');
    if (!narrow) return;
    if (narrow.matches) setCollapsed(true);
    const follow = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    narrow.addEventListener('change', follow);
    return () => narrow.removeEventListener('change', follow);
  }, [setCollapsed]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  useEffect(() => setAiPrompt(null), [projectId, view]);
  const [shortcuts, setShortcuts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [tourDone, setTourDone] = useLocalStorage('sdd-tour-done', false);
  const [tourOpen, setTourOpen] = useState(false);
  const [display, setDisplay] = useLocalStorage<DisplayPrefs>('sdd-display', {
    font: 'system',
    size: 14,
  });
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font',
      fonts[display.font]?.stack ?? fonts.system.stack,
    );
    document.documentElement.style.fontSize = `${display.size}px`;
  }, [display]);
  const [guidance, setGuidance] = useState<Guidance>({});
  const [target, setTarget] = useState<{ sectionId: string; questionId?: string } | null>(null);
  const onError = useCallback((m: string) => setError(m), []);
  const project = useProject(user ? projectId : undefined, onError);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // Opens the tour once per sign-in; finishing it later must not reopen it.
  const latest = useLatest({ tourDone, projectId });
  useEffect(() => {
    if (user && !latest.current.tourDone) setTourOpen(true);
  }, [user, latest]);
  useEffect(() => {
    if (features.hidden.has(view)) setView('overview');
  }, [features.hidden, view]);
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const refreshProjects = useCallback(async () => {
    const list = await api<ProjectSummary[]>('/projects');
    setProjects(list);
    return list;
  }, []);
  const refreshFeatures = features.refresh;
  useEffect(() => {
    if (!user) return;
    refreshFeatures().catch(() => {});
    refreshProjects()
      .then((list) => {
        const current = latest.current.projectId;
        if (!current || !list.some((p) => p.id === current)) setProjectId(list[0]?.id);
      })
      .catch((e) => setError(e.message));
    api<{ key: string; text: string; references: any[] }[]>('/guidance')
      .then((all) => setGuidance(Object.fromEntries(all.map((g) => [g.key, g]))))
      .catch(() => {});
  }, [user, refreshFeatures, refreshProjects, latest]);
  // Keep the address bar in sync so views can be bookmarked and Back works.
  useEffect(() => {
    if (projectId) history.replaceState(null, '', `#/p/${projectId}/${view}`);
  }, [projectId, view]);
  useEffect(() => {
    const onHash = () => {
      const h = parseHash();
      if (h.projectId) setProjectId(h.projectId);
      if (h.view) setView(h.view);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  // On phones the view grid folds behind a "Views" button and closes after a choice.
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (v: string, t?: { sectionId?: string; questionId?: string }) => {
    setView(v as View);
    setMenuOpen(false);
    if (t?.sectionId) setTarget({ sectionId: t.sectionId, questionId: t.questionId });
    requestAnimationFrame(() => document.getElementById('main')?.focus());
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        e.target.matches('input, textarea, select, [contenteditable], .monaco-editor *');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        setNotice(l('Saving your changes.', 'Enregistrement de vos modifications.'));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && features.on('search')) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.altKey && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const next = visibleOrder[e.key === '0' ? 9 : Number(e.key) - 1];
        if (next) go(next);
      } else if (e.key === '?' && !typing) setShortcuts(true);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (loading)
    return (
      <div className="loading-screen" role="status">
        <Layers aria-hidden /> {l('Opening your workspace…', 'Ouverture de votre espace…')}
      </div>
    );
  if (!user)
    return (
      <Login
        lang={lang}
        setLang={setLang}
        onLogin={(u) => {
          setUser(u);
          history.replaceState(null, '', '/');
        }}
      />
    );

  const spec = project.spec;
  const allNav: { id: View; icon: typeof BookOpen; label: string; count?: number }[] = [
    { id: 'builder', icon: MessagesSquare, label: l('Build with AI', 'Construire avec l’IA') },
    { id: 'overview', icon: LayoutDashboard, label: l('Overview', 'Vue d’ensemble') },
    { id: 'stack', icon: Layers3, label: l('Technology stack', 'Pile technologique') },
    { id: 'specification', icon: BookOpen, label: l('Specification', 'Spécification') },
    {
      id: 'traceability',
      icon: GitBranch,
      label: l('Requirements & decisions', 'Exigences et décisions'),
    },
    {
      id: 'proposals',
      icon: Sparkles,
      label: l('Proposals', 'Propositions'),
      count: project.pendingProposals,
    },
    {
      id: 'readiness',
      icon: ShieldCheck,
      label: l('Readiness & baselines', 'Préparation et références'),
    },
    { id: 'board', icon: KanbanSquare, label: l('Implementation board', 'Tableau de réalisation') },
    {
      id: 'publishing',
      icon: Download,
      label: l('Publish & handoff', 'Publication et transmission'),
    },
  ];
  const nav = allNav.filter((n) => !features.hidden.has(n.id));
  const activeView = view === 'import' || view === 'search' ? 'overview' : view;
  const current =
    nav.find((n) => n.id === activeView)?.label ??
    (view === 'dashboard' ? l('Dashboard', 'Tableau de bord') : l('Settings', 'Paramètres'));
  const statusText = {
    idle: '',
    saving: l('Saving…', 'Enregistrement…'),
    saved: l('All changes saved', 'Modifications enregistrées'),
    error: l('Save failed', 'Échec de l’enregistrement'),
    conflict: l('Needs your decision', 'Décision requise'),
  }[project.status];
  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <a className="skip-link" href="#main">
        {l('Skip to content', 'Aller au contenu')}
      </a>
      <aside className="sidebar" aria-label={l('Workspace navigation', 'Navigation de l’espace')}>
        <div className="brand">
          <span className="brand-symbol" aria-hidden>
            <Layers size={20} />
          </span>
          <strong>
            SDD <span>Studio</span>
          </strong>
        </div>
        <label className="project-picker" data-tour="project-picker">
          <span className="sr-only">{l('Current project', 'Projet courant')}</span>
          <select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value)}>
            {!projects.length && <option value="">{l('No project yet', 'Aucun projet')}</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {can(user.role, 'edit') && (
          <Button className="new-project" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> {l('New project', 'Nouveau projet')}
          </Button>
        )}
        <button
          type="button"
          className="views-toggle"
          aria-expanded={menuOpen}
          aria-controls="project-views"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <LayoutDashboard size={16} aria-hidden /> {l('Views', 'Vues')}: {current}
        </button>
        <nav
          id="project-views"
          className={menuOpen ? 'open' : undefined}
          aria-label={l('Project views', 'Vues du projet')}
        >
          <ul>
            {nav.map((n, i) => (
              <li key={n.id}>
                <button
                  type="button"
                  data-tour={`nav-${n.id}`}
                  className={`nav-item ${activeView === n.id ? 'active' : ''}`}
                  aria-current={activeView === n.id ? 'page' : undefined}
                  disabled={!spec}
                  onClick={() => go(n.id)}
                  title={
                    i < 9 ? `${n.label} (Alt+${i + 1})` : i === 9 ? `${n.label} (Alt+0)` : n.label
                  }
                >
                  <n.icon size={17} aria-hidden />
                  <span>{n.label}</span>
                  {!!n.count && <span className="nav-count">{n.count}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
            aria-current={view === 'dashboard' ? 'page' : undefined}
            disabled={!spec}
            onClick={() => go('dashboard')}
            title={l('Dashboard: all your projects', 'Tableau de bord : tous vos projets')}
          >
            <LayoutGrid size={17} aria-hidden /> <span>{l('Dashboard', 'Tableau de bord')}</span>
          </button>
          <button
            type="button"
            data-tour="nav-settings"
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            aria-current={view === 'settings' ? 'page' : undefined}
            disabled={!spec}
            onClick={() => go('settings')}
          >
            <SettingsIcon size={17} aria-hidden /> <span>{l('Settings', 'Paramètres')}</span>
          </button>
          <div className="profile">
            <span className="avatar" aria-hidden>
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={l('Sign out', 'Se déconnecter')}
              onClick={async () => {
                await api('/auth/logout', 'POST');
                setUser(null);
              }}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <Button
              variant="ghost"
              size="icon"
              aria-label={l('Toggle navigation', 'Afficher/masquer la navigation')}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={17} />
            </Button>
            <span className="crumb">{spec?.name ?? 'SDD Studio'}</span>
            <span aria-hidden>›</span>
            <strong>{current}</strong>
          </div>
          <div className="top-actions">
            {spec && features.on('search') && (
              <Button
                variant="ghost"
                size="icon"
                title={l('Search current project', 'Rechercher dans le projet')}
                aria-label={l('Search current project', 'Rechercher dans le projet')}
                onClick={() => setSearchOpen(true)}
              >
                <Search size={18} aria-hidden />
              </Button>
            )}
            <span
              className={`save-status ${project.status}`}
              role="status"
              aria-live="polite"
              data-tour="save-status"
            >
              {statusText}
            </span>
            {project.readiness && (
              <Badge
                tone={project.readiness.ready ? 'green' : 'neutral'}
                title={l('Required answers complete', 'Réponses obligatoires complètes')}
              >
                {project.readiness.percent}% · {l('rev.', 'rév.')} {spec?.revision}
              </Badge>
            )}
            <label>
              <span className="sr-only">{l('Interface language', 'Langue de l’interface')}</span>
              <select value={lang} onChange={(e) => setLang(e.target.value as Language)}>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </label>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                theme === 'dark'
                  ? l('Use light theme', 'Thème clair')
                  : l('Use dark theme', 'Thème sombre')
              }
              onClick={() => setAppearance(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-tour="display"
              aria-label={l('Display preferences', 'Préférences d’affichage')}
              onClick={() => setDisplayOpen(true)}
            >
              <Type size={17} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={l('Keyboard shortcuts', 'Raccourcis clavier')}
              onClick={() => setShortcuts(true)}
            >
              <Keyboard size={17} />
            </Button>
            <Button asChild variant="ghost" size="icon">
              <a
                href="/docs/"
                target="_blank"
                rel="noopener"
                aria-label={l(
                  'Documentation (opens in a new tab)',
                  'Documentation (nouvel onglet)',
                )}
                title={l('Documentation', 'Documentation')}
              >
                <BookText size={17} aria-hidden />
              </a>
            </Button>
            {features.on('tour') && (
              <Button
                variant="ghost"
                size="icon"
                data-tour="help"
                aria-label={l('Take the guided tour', 'Faire la visite guidée')}
                onClick={() => setTourOpen(true)}
              >
                <HelpCircle size={17} />
              </Button>
            )}
          </div>
        </header>
        {error && (
          <div className="message error" role="alert">
            <AlertCircle size={16} aria-hidden />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError('')}>
              {l('Dismiss', 'Fermer')}
            </Button>
          </div>
        )}
        {notice && (
          <div className="message success" role="status">
            <CheckCircle2 size={16} aria-hidden />
            <span>{notice}</span>
          </div>
        )}
        <main
          id="main"
          tabIndex={-1}
          className={view === 'specification' ? 'main workspace-main' : 'main'}
        >
          {!spec ? (
            projects.length ? (
              <div className="loading-screen" role="status">
                {l('Loading project…', 'Chargement du projet…')}
              </div>
            ) : (
              <div className="empty-workspace">
                <Layers size={34} aria-hidden />
                <h1>{l('A clear starting point.', 'Un point de départ clair.')}</h1>
                <p>
                  {l(
                    'Turn an idea into a reviewed specification your team — and its coding agents — can build from.',
                    'Transformez une idée en spécification révisée pour votre équipe et ses agents de code.',
                  )}
                </p>
                {can(user.role, 'edit') && (
                  <Button variant="primary" onClick={() => setNewOpen(true)}>
                    <Plus size={16} /> {l('Create a project', 'Créer un projet')}
                  </Button>
                )}
              </div>
            )
          ) : (
            <>
              {view !== 'specification' && (
                <div className="page-heading">
                  <h1>{current}</h1>
                </div>
              )}
              <Suspense
                fallback={<div className="loading-screen">{l('Loading…', 'Chargement…')}</div>}
              >
                {aiPrompt !== null && features.on('ai') && view === 'proposals' && (
                  <section
                    className="inline-assistant"
                    aria-label={l('AI assistant', 'Assistant IA')}
                  >
                    <div className="view-toolbar">
                      <h2>{l('Conversation', 'Discussion')}</h2>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={l('Close conversation', 'Fermer la discussion')}
                        title={l('Close conversation', 'Fermer la discussion')}
                        onClick={() => setAiPrompt(null)}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                    <Builder
                      key={spec.id}
                      project={project}
                      embedded
                      entry={aiPrompt ? { id: aiPrompt, prompt: aiPrompt } : undefined}
                      onEntryHandled={() => setAiPrompt('')}
                      go={go}
                      notify={setNotice}
                    />
                  </section>
                )}
                <ProjectView
                  view={view}
                  project={project}
                  user={user}
                  guidance={guidance}
                  target={target}
                  clearTarget={() => setTarget(null)}
                  go={go}
                  notify={setNotice}
                  askAi={(prompt) => setAiPrompt(prompt)}
                  openProject={(id, v) => {
                    setProjectId(id);
                    go(v);
                  }}
                />
              </Suspense>
            </>
          )}
        </main>
      </div>
      {newOpen && (
        <NewProject
          onClose={() => setNewOpen(false)}
          onCreated={async (id) => {
            setNewOpen(false);
            await refreshProjects();
            setProjectId(id);
            go('builder');
          }}
          notify={setNotice}
          lang={lang}
        />
      )}
      {spec && features.on('search') && (searchOpen || view === 'search') && (
        <Modal
          open
          wide
          onOpenChange={() => {
            setSearchOpen(false);
            if (view === 'search') go('overview');
          }}
          title={l(`Search: ${spec.name}`, `Rechercher : ${spec.name}`)}
        >
          <Suspense fallback={<p role="status">{l('Loading…', 'Chargement…')}</p>}>
            <SearchView
              key={spec.id}
              project={project}
              go={(v, target) => {
                setSearchOpen(false);
                go(v, target);
              }}
            />
          </Suspense>
        </Modal>
      )}
      <KeyboardShortcuts open={shortcuts} onOpenChange={setShortcuts} />
      <Modal
        open={displayOpen}
        onOpenChange={setDisplayOpen}
        title={l('Display preferences', 'Préférences d’affichage')}
      >
        <div className="form-stack">
          <Segmented
            label={l('Theme', 'Thème')}
            value={appearance}
            onChange={setAppearance}
            items={[
              { id: 'system', label: l('Match system', 'Comme le système') },
              { id: 'light', label: l('Light', 'Clair') },
              { id: 'dark', label: l('Dark', 'Sombre') },
            ]}
          />
          <label>
            {l('Font', 'Police')}
            <select
              value={display.font}
              onChange={(e) => setDisplay({ ...display, font: e.target.value as FontId })}
            >
              {(Object.keys(fonts) as FontId[]).map((f) => (
                <option key={f} value={f}>
                  {l(fonts[f].label[0], fonts[f].label[1])}
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label={l('Text size', 'Taille du texte')}
            value={String(display.size)}
            onChange={(v) => setDisplay({ ...display, size: Number(v) })}
            items={[
              { id: '13', label: 'A−' },
              { id: '14', label: 'A' },
              { id: '15', label: 'A+' },
              { id: '16', label: 'A++' },
            ]}
          />
          <p className="muted small" style={{ fontFamily: fonts[display.font]?.stack }}>
            {l(
              'The quick brown fox jumps over the lazy dog — 0123456789',
              'Portez ce vieux whisky au juge blond qui fume — 0123456789',
            )}
          </p>
        </div>
      </Modal>
      <Tour
        open={tourOpen && !!spec && features.on('tour')}
        steps={tourSteps(l).filter(
          (s) => !s.target?.startsWith('nav-') || !features.hidden.has(s.target.slice(4)),
        )}
        onClose={() => {
          setTourOpen(false);
          setTourDone(true);
        }}
      />
      <ConflictDialog conflict={project.conflict} onResolve={project.resolveConflict} />
    </div>
  );
}

function ProjectView({
  view,
  project,
  user,
  guidance,
  target,
  clearTarget,
  go,
  notify,
  askAi,
  openProject,
}: {
  view: View;
  project: ProjectState;
  user: User;
  guidance: Guidance;
  target: { sectionId: string; questionId?: string } | null;
  clearTarget: () => void;
  go: (v: string, t?: { sectionId?: string; questionId?: string }) => void;
  notify: (m: string) => void;
  askAi: (prompt: string) => void;
  openProject: (id: string, view: string) => void;
}) {
  const l = useL();
  const editable = can(project.role, 'edit');
  switch (view) {
    case 'builder':
      return <Builder project={project} go={go} notify={notify} />;
    case 'overview':
    case 'search':
    case 'import':
      return <Overview project={project} go={go} notify={notify} importOpen={view === 'import'} />;
    case 'stack':
      return <Stack project={project} go={(v) => go(v)} notify={notify} />;
    case 'traceability':
      return <Traceability project={project} />;
    case 'proposals':
      return (
        <Proposals
          project={project}
          onAskAi={() =>
            askAi(
              l(
                'Review the specification for gaps, contradictions and untestable requirements, and propose focused improvements.',
                'Révisez la spécification pour trouver les manques, contradictions et exigences non testables, et proposez des améliorations ciblées.',
              ),
            )
          }
        />
      );
    case 'readiness':
      return <Readiness project={project} notify={notify} go={go} />;
    case 'publishing':
      return <Publishing project={project} notify={notify} go={(v) => go(v)} />;
    case 'settings':
      return <SettingsView project={project} me={user} notify={notify} />;
    case 'dashboard':
      return <DashboardView openProject={openProject} />;
    case 'board':
      return <BoardView project={project} notify={notify} go={(v) => go(v)} />;
    default:
      return (
        <Workspace
          project={project}
          editable={editable}
          guidance={guidance}
          target={target}
          onTargetHandled={clearTarget}
          go={go}
          notify={notify}
        />
      );
  }
}
