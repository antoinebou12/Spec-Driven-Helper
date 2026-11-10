import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { api } from '../api';
import { Badge, Button, Tabs } from '../components/ui';
import { formatDate, useL, useLang, useLocalized } from '../i18n';
import { can } from '../../../../packages/shared/src/domain';
import { essentialCount, levelLabels, specLevels, type SpecLevel } from '../../../../packages/shared/src/essentials';
import {
  modules,
  projectTypeLabels,
  projectTypes,
} from '../../../../packages/shared/src/templates';
import type { Role } from '../../../../packages/shared/src/schema';
import type { ProjectState } from '../state';
import Admin from './Admin';
import { ProjectIntegrations } from '../components/ProjectIntegrations';
import { useFeatures } from '../features';

import { RunActivity } from '../components/RunActivity';
import { BackgroundRun } from '../components/BackgroundRun';

type Tab =
  | 'project'
  | 'members'
  | 'workspace'
  | 'providers'
  | 'guidance'
  | 'audit'
  | 'administration'
  | 'integrations'
  | 'activity';
type Me = { id: string; role: Role };
const roleNames = (l: (en: string, fr: string) => string): Record<Role, string> => ({
  Owner: l('Owner', 'Propriétaire'),
  Admin: l('Admin', 'Administrateur'),
  Editor: l('Editor', 'Éditeur'),
  Reviewer: l('Reviewer', 'Réviseur'),
  Viewer: l('Viewer', 'Lecteur'),
});

function ProjectSettings({
  project,
  notify,
}: {
  project: ProjectState;
  notify: (m: string) => void;
}) {
  const l = useL();
  const lang = useLang();
  const spec = project.spec!;
  const editable = can(project.role, 'edit');
  const admin = can(project.role, 'admin');
  const [budget, setBudget] = useState<{ aiRunLimit: number; aiTokenBudget: number } | null>(null);
  const [usage, setUsage] = useState<{ tokens: number } | null>(null);
  useEffect(() => {
    api(`/projects/${spec.id}/settings`)
      .then(setBudget)
      .catch(() => {});
    api(`/projects/${spec.id}/usage`)
      .then(setUsage)
      .catch(() => {});
  }, [spec.id]);
  return (
    <div className="settings-grid">
      <form
        className="card form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const saved = await project.save({
            name: String(f.get('name')),
            description: String(f.get('description')),
            projectType: String(f.get('projectType')),
            language: f.get('language') as 'en' | 'fr',
            localOnly: f.get('localOnly') === 'on',
            level: f.get('level') as SpecLevel,
          });
          if (saved) notify(l('Project settings saved.', 'Paramètres enregistrés.'));
        }}
      >
        <h3>{l('Project', 'Projet')}</h3>
        <fieldset disabled={!editable} className="form-stack">
          <label>
            {l('Name', 'Nom')}
            <input name="name" defaultValue={spec.name} required maxLength={120} />
          </label>
          <label>
            {l('Description', 'Description')}
            <textarea
              name="description"
              defaultValue={spec.description}
              rows={3}
              maxLength={3000}
            />
          </label>
          <label>
            {l('Project type', 'Type de projet')}
            <select name="projectType" defaultValue={spec.projectType}>
              {projectTypes.map((t) => (
                <option key={t} value={t}>
                  {projectTypeLabels[t][lang]}
                </option>
              ))}
            </select>
            <small className="muted">
              {l(
                'Changing the type changes which questions apply and what readiness requires.',
                'Changer de type modifie les questions applicables et les exigences de préparation.',
              )}
            </small>
          </label>
          <label>
            {l('Document language', 'Langue du document')}
            <select name="language" defaultValue={spec.language}>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </label>
          <label>
            {l('How much to specify', 'Niveau de détail')}
            <select name="level" defaultValue={spec.level}>
              {specLevels.map((level) => (
                <option key={level} value={level}>
                  {lang === 'fr' ? levelLabels[level].fr : levelLabels[level].en}
                </option>
              ))}
            </select>
            <small className="muted">
              {l(
                `Essentials requires ${essentialCount(spec.projectType)} core questions for this project type; Complete requires every question. Switching keeps every answer; only what readiness requires changes.`,
                `L’essentiel exige ${essentialCount(spec.projectType)} questions clés pour ce type de projet ; Complet les exige toutes. Changer conserve toutes les réponses ; seule l’exigence de préparation change.`,
              )}
            </small>
          </label>
          <label className="check-label">
            <input type="checkbox" name="localOnly" defaultChecked={spec.localOnly} />
            {l(
              'Local AI only (Ollama). Cloud providers are blocked, with no silent fallback.',
              'IA locale uniquement (Ollama). Les fournisseurs infonuagiques sont bloqués, sans repli silencieux.',
            )}
          </label>
          <Button type="submit" variant="primary">
            {l('Save project', 'Enregistrer le projet')}
          </Button>
        </fieldset>
      </form>
      <form
        className="card form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            setBudget(
              await api(`/projects/${spec.id}/settings`, 'PUT', {
                aiRunLimit: Number(f.get('aiRunLimit')),
                aiTokenBudget: Number(f.get('aiTokenBudget')),
              }),
            );
            notify(l('AI budget saved.', 'Budget IA enregistré.'));
          } catch (err) {
            notify((err as Error).message);
          }
        }}
      >
        <h3>{l('AI budget', 'Budget IA')}</h3>
        {usage && budget && (
          <p>
            {l(
              `${usage.tokens.toLocaleString()} of ${budget.aiTokenBudget.toLocaleString()} tokens used this month.`,
              `${usage.tokens.toLocaleString('fr-CA')} jetons sur ${budget.aiTokenBudget.toLocaleString('fr-CA')} utilisés ce mois-ci.`,
            )}
          </p>
        )}
        {budget && (
          <fieldset disabled={!admin} className="form-stack">
            <label>
              {l('Runs per day', 'Exécutions par jour')}
              <input
                name="aiRunLimit"
                type="number"
                min={0}
                max={10000}
                defaultValue={budget.aiRunLimit}
              />
            </label>
            <label>
              {l('Tokens per month', 'Jetons par mois')}
              <input
                name="aiTokenBudget"
                type="number"
                min={0}
                defaultValue={budget.aiTokenBudget}
              />
            </label>
            <Button type="submit">{l('Save budget', 'Enregistrer le budget')}</Button>
          </fieldset>
        )}
      </form>
    </div>
  );
}

function Members({ project, notify }: { project: ProjectState; notify: (m: string) => void }) {
  const l = useL();
  const names = roleNames(l);
  const spec = project.spec!;
  const admin = can(project.role, 'admin');
  const [members, setMembers] = useState<{ id: string; name: string; email: string; role: Role }[]>(
    [],
  );
  const reload = useCallback(() => api(`/projects/${spec.id}/members`).then(setMembers), [spec.id]);
  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);
  const setRole = (email: string, role: Role) =>
    api(`/projects/${spec.id}/members`, 'POST', { email, role }).then(reload, (e) =>
      notify(e.message),
    );
  return (
    <section className="card">
      <h3>
        <Users size={17} aria-hidden /> {l('Project members', 'Membres du projet')}
      </h3>
      <p className="muted small">
        {l(
          'Owners manage ownership; admins manage membership and integrations; editors draft; reviewers approve; viewers read.',
          'Les propriétaires gèrent la propriété ; les administrateurs, les membres et intégrations ; les éditeurs rédigent ; les réviseurs approuvent ; les lecteurs consultent.',
        )}
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{l('Person', 'Personne')}</th>
            <th scope="col">{l('Role', 'Rôle')}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>
                {m.name} <small className="muted block">{m.email}</small>
              </td>
              <td>
                {admin ? (
                  <select
                    aria-label={l(`Role of ${m.name}`, `Rôle de ${m.name}`)}
                    value={m.role}
                    onChange={(e) => setRole(m.email, e.target.value as Role)}
                  >
                    {(Object.keys(names) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {names[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge>{names[m.role]}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {admin && (
        <form
          className="inline-actions"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setRole(String(f.get('email')), f.get('role') as Role);
            e.currentTarget.reset();
          }}
        >
          <input
            name="email"
            type="email"
            required
            aria-label={l('Member email', 'Courriel du membre')}
            placeholder={l('person@company.com', 'personne@entreprise.com')}
          />
          <select name="role" aria-label={l('Role', 'Rôle')} defaultValue="Editor">
            {(['Admin', 'Editor', 'Reviewer', 'Viewer'] as Role[]).map((r) => (
              <option key={r} value={r}>
                {names[r]}
              </option>
            ))}
          </select>
          <Button type="submit">
            <UserPlus size={14} /> {l('Add to project', 'Ajouter au projet')}
          </Button>
        </form>
      )}
    </section>
  );
}

function Workspace({ me, notify }: { me: Me; notify: (m: string) => void }) {
  const l = useL();
  const names = roleNames(l);
  const [users, setUsers] = useState<
    { id: string; name: string; email: string; role: Role; disabled: boolean }[]
  >([]);
  const [invite, setInvite] = useState('');
  const reload = () => api('/users').then(setUsers);
  useEffect(() => {
    reload().catch(() => {});
  }, []);
  const act = (p: Promise<unknown>) => p.then(reload, (e) => notify(e.message));
  return (
    <div className="settings-grid">
      <section className="card">
        <h3>{l('Workspace users', 'Utilisateurs de l’espace')}</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{l('Person', 'Personne')}</th>
              <th scope="col">{l('Workspace role', 'Rôle dans l’espace')}</th>
              <th scope="col">
                <span className="sr-only">{l('Actions', 'Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.disabled ? 'superseded' : ''}>
                <td>
                  {u.name} <small className="muted block">{u.email}</small>
                </td>
                <td>
                  <select
                    aria-label={l(`Workspace role of ${u.name}`, `Rôle de ${u.name}`)}
                    value={u.role}
                    disabled={u.disabled || u.id === me.id}
                    onChange={(e) =>
                      act(api(`/users/${u.id}/role`, 'PUT', { role: e.target.value }))
                    }
                  >
                    {(Object.keys(names) as Role[]).map((r) => (
                      <option
                        key={r}
                        value={r}
                        disabled={me.role !== 'Owner' && (r === 'Owner' || r === 'Admin')}
                      >
                        {names[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {u.disabled ? (
                    <Badge>{l('Deactivated', 'Désactivé')}</Badge>
                  ) : (
                    u.id !== me.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.confirm(
                            l(
                              `Deactivate ${u.name}? Their sessions end immediately.`,
                              `Désactiver ${u.name} ? Ses sessions prennent fin immédiatement.`,
                            ),
                          ) && act(api(`/users/${u.id}/deactivate`, 'POST'))
                        }
                      >
                        {l('Deactivate', 'Désactiver')}
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <form
        className="card form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            setInvite(
              (await api('/auth/invites', 'POST', { email: f.get('email'), role: f.get('role') }))
                .url,
            );
          } catch (err) {
            notify((err as Error).message);
          }
        }}
      >
        <h3>
          <UserPlus size={17} aria-hidden /> {l('Invite someone', 'Inviter quelqu’un')}
        </h3>
        <p className="muted small">
          {l(
            'Accounts are invitation-only. Company SSO users also need an invitation for their verified email.',
            'Les comptes sont sur invitation. Les utilisateurs SSO ont aussi besoin d’une invitation à leur courriel vérifié.',
          )}
        </p>
        <label>
          {l('Email', 'Courriel')}
          <input name="email" type="email" required />
        </label>
        <label>
          {l('Workspace role', 'Rôle dans l’espace')}
          <select name="role" defaultValue="Editor">
            {(['Admin', 'Editor', 'Reviewer', 'Viewer'] as Role[]).map((r) => (
              <option key={r} value={r} disabled={r === 'Admin' && me.role !== 'Owner'}>
                {names[r]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary">
          {l('Create invitation link', 'Créer le lien d’invitation')}
        </Button>
        {invite && (
          <div className="invite-link">
            <input
              readOnly
              value={invite}
              aria-label={l('Invitation link', 'Lien d’invitation')}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              size="sm"
              onClick={() =>
                navigator.clipboard
                  .writeText(invite)
                  .then(() =>
                    notify(
                      l(
                        'Link copied. It expires in 3 days.',
                        'Lien copié. Il expire dans 3 jours.',
                      ),
                    ),
                  )
              }
            >
              <Copy size={13} /> {l('Copy', 'Copier')}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

function Providers({ notify }: { notify: (m: string) => void }) {
  const l = useL();
  const [list, setList] = useState<
    { id: string; label: string; model: string; configured: boolean; local: boolean; endpoint?: string }[]
  >([]);
  const reload = () => api('/integrations').then(setList);
  useEffect(() => {
    reload().catch(() => {});
  }, []);
  return (
    <div className="settings-grid">
      {list.map((p) => (
        <form
          key={p.id}
          className="card form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api(`/integrations/${p.id}`, 'PUT', {
                model: f.get('model'),
                secret: f.get('secret') || undefined,
              });
              e.currentTarget.reset();
              await reload();
              notify(l(`${p.label} saved.`, `${p.label} enregistré.`));
            } catch (err) {
              notify((err as Error).message);
            }
          }}
        >
          <h3>
            <KeyRound size={16} aria-hidden /> {p.label}{' '}
            <Badge tone={p.configured ? 'green' : 'neutral'}>
              {p.configured ? l('Configured', 'Configuré') : l('Not configured', 'Non configuré')}
            </Badge>
          </h3>
          {p.id === 'nvidia-nim' && (
            <p className="muted small">
              {p.endpoint === 'self-hosted'
                ? l(
                    'Uses your own NIM server (NIM_BASE_URL). A key is optional.',
                    'Utilise votre propre serveur NIM (NIM_BASE_URL). Une clé est facultative.',
                  )
                : l(
                    'The free hosted endpoint: create a key at build.nvidia.com. Requests go to NVIDIA, so local-only projects cannot use it. Pick a model that supports tools, such as openai/gpt-oss-20b.',
                    'Le point d’accès gratuit hébergé : créez une clé sur build.nvidia.com. Les requêtes vont chez NVIDIA, donc les projets locaux ne peuvent pas l’utiliser. Choisissez un modèle avec outils, comme openai/gpt-oss-20b.',
                  )}
            </p>
          )}
          {p.id === 'claude-agent' ? (
            <p className="muted small">
              {l(
                'Runs on an isolated runner (AGENT_RUNNER_URL) that holds its own Anthropic key, can only read a disposable copy of project material, and returns proposals for review.',
                'S’exécute sur un exécuteur isolé (AGENT_RUNNER_URL) qui détient sa propre clé Anthropic, ne lit qu’une copie jetable du matériel du projet et renvoie des propositions à réviser.',
              )}
            </p>
          ) : p.local ? (
            <p className="muted small">
              {l(
                'Uses OLLAMA_URL on your network. No key is needed.',
                'Utilise OLLAMA_URL sur votre réseau. Aucune clé requise.',
              )}
            </p>
          ) : (
            <label>
              {l('API key (write-only)', 'Clé d’API (écriture seule)')}
              <input
                name="secret"
                type="password"
                autoComplete="new-password"
                placeholder={
                  p.configured
                    ? l(
                        'Leave blank to keep the current key',
                        'Laisser vide pour garder la clé actuelle',
                      )
                    : ''
                }
              />
            </label>
          )}
          <label>
            {l('Default model', 'Modèle par défaut')}
            <input
              name="model"
              defaultValue={p.model}
              placeholder={p.id === 'nvidia-nim' ? 'openai/gpt-oss-20b' : undefined}
              required
            />
          </label>
          <Button type="submit">{l('Save', 'Enregistrer')}</Button>
        </form>
      ))}
    </div>
  );
}

function GuidanceEditor({ notify }: { notify: (m: string) => void }) {
  const l = useL();
  const loc = useLocalized();
  const [all, setAll] = useState<{ key: string; text: string }[]>([]);
  const [key, setKey] = useState('discovery');
  const [text, setText] = useState('');
  useEffect(() => {
    api('/guidance')
      .then(setAll)
      .catch(() => {});
  }, []);
  useEffect(() => setText(all.find((g) => g.key === key)?.text ?? ''), [key, all]);
  return (
    <form
      className="card form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/guidance/${key}`, 'PUT', { text });
          setAll(await api('/guidance'));
          notify(l('Team guidance saved.', 'Consignes enregistrées.'));
        } catch (err) {
          notify((err as Error).message);
        }
      }}
    >
      <h3>{l('Team guidance', 'Consignes de l’équipe')}</h3>
      <p className="muted small">
        {l(
          'Shown to everyone in the interview beside the built-in explanations. Markdown is supported.',
          'Affichées à tous dans l’entretien à côté des explications intégrées. Markdown pris en charge.',
        )}
      </p>
      <label>
        {l('Section or question', 'Section ou question')}
        <select value={key} onChange={(e) => setKey(e.target.value)}>
          {modules.map((m) => (
            <optgroup key={m.id} label={loc(m.title)}>
              <option value={m.id}>{l('Whole section', 'Section entière')}</option>
              {m.questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id} — {loc(q.label)} {all.some((g) => g.key === q.id) ? '•' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        {l('Guidance', 'Consignes')}
        <textarea
          rows={6}
          value={text}
          maxLength={10000}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Button type="submit" variant="primary">
        {l('Save guidance', 'Enregistrer les consignes')}
      </Button>
    </form>
  );
}

function Audit() {
  const l = useL();
  const lang = useLang();
  const [entries, setEntries] = useState<
    {
      id: string;
      action: string;
      userId: string;
      projectId?: string;
      at: string;
      details?: unknown;
    }[]
  >([]);
  useEffect(() => {
    api('/audit')
      .then(setEntries)
      .catch(() => {});
  }, []);
  return (
    <section className="card">
      <h3>
        <ShieldCheck size={17} aria-hidden /> {l('Audit log', 'Journal d’audit')}
      </h3>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{l('When', 'Quand')}</th>
            <th scope="col">{l('Action', 'Action')}</th>
            <th scope="col">{l('Details', 'Détails')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="small">{formatDate(e.at, lang)}</td>
              <td className="mono">{e.action}</td>
              <td className="small muted">
                {e.details ? JSON.stringify(e.details).slice(0, 160) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Settings({
  project,
  me,
  notify,
}: {
  project: ProjectState;
  me: Me;
  notify: (m: string) => void;
}) {
  const l = useL();
  const features = useFeatures();
  const workspaceAdmin = can(me.role, 'admin');
  const [selectedTab, setTab] = useState<Tab>('project');
  const [activityEpoch, setActivityEpoch] = useState(0);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'project', label: l('Project', 'Projet') },
    { id: 'members', label: l('Members', 'Membres') },
    ...(features.on('ai')
      ? [{ id: 'activity' as const, label: l('AI activity', 'Activité IA') }]
      : []),
    ...(features.on('mcp') || features.on('connectors')
      ? [{ id: 'integrations' as const, label: l('Integrations', 'Intégrations') }]
      : []),
    ...(workspaceAdmin
      ? ([
          { id: 'workspace', label: l('Workspace users', 'Utilisateurs') },
          { id: 'administration', label: l('Administration', 'Administration') },
          { id: 'providers', label: l('AI providers', 'Fournisseurs IA') },
          { id: 'guidance', label: l('Team guidance', 'Consignes') },
          { id: 'audit', label: l('Audit log', 'Audit') },
        ] as { id: Tab; label: string }[])
      : []),
  ];
  const tab = tabs.some((item) => item.id === selectedTab) ? selectedTab : 'project';
  return (
    <div className="view-body">
      <Tabs
        label={l('Settings sections', 'Sections des paramètres')}
        value={tab}
        onChange={setTab}
        items={tabs}
      />
      <div className="tab-panel">
        {tab === 'project' && <ProjectSettings project={project} notify={notify} />}
        {tab === 'members' && <Members project={project} notify={notify} />}
        {tab === 'activity' && (
          <section aria-label={l('AI runs', 'Exécutions IA')}>
            <h2>{l('AI runs', 'Exécutions IA')}</h2>
            {can(project.role, 'edit') && <BackgroundRun project={project} onQueued={() => setActivityEpoch((n) => n + 1)} />}
            <RunActivity
              key={activityEpoch}
              projectId={project.spec!.id}
              canCancel={can(project.role, 'edit')}
              onFinished={() => project.reload()}
            />
          </section>
        )}
        {tab === 'integrations' && <ProjectIntegrations project={project} notify={notify} />}
        {tab === 'workspace' && <Workspace me={me} notify={notify} />}
        {tab === 'providers' && <Providers notify={notify} />}
        {tab === 'guidance' && <GuidanceEditor notify={notify} />}
        {tab === 'audit' && <Audit />}
        {tab === 'administration' && workspaceAdmin && <Admin />}
      </div>
    </div>
  );
}
