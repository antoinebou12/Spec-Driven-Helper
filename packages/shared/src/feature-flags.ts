/**
 * Feature flags: every optional capability can be switched off by a workspace Owner or Admin.
 * The API refuses the routes of a disabled feature (403, code `feature-disabled`) and the web client
 * hides its views and actions. Core flows (specification, review, readiness, settings) always stay on.
 */
export type FeatureCategory =
  'authoring' | 'ai' | 'delivery' | 'integrations' | 'identity' | 'experience';
export type FeatureFlag = {
  id: string;
  category: FeatureCategory;
  label: { en: string; fr: string };
  description: { en: string; fr: string };
  defaultEnabled: boolean;
  /** Sidebar views hidden when the feature is off. */
  views?: string[];
  /** API routes refused when off: `METHOD /path` with `:param` segments; METHOD may be `*`. */
  routes?: string[];
};

const f = (flag: FeatureFlag) => flag;

export const featureFlags = [
  f({
    id: 'openspec', category: 'delivery', defaultEnabled: true,
    label: { en: 'OpenSpec exchange', fr: 'Échange OpenSpec' },
    description: { en: 'Export OpenSpec files and import reviewed changes.', fr: 'Exporter OpenSpec et importer des changements à réviser.' },
    routes: ['GET /api/v1/projects/:id/openspec', 'POST /api/v1/projects/:id/openspec/import'],
  }),
  f({
    id: 'stack',
    category: 'authoring',
    label: { en: 'Technology stack step', fr: 'Étape de pile technologique' },
    description: {
      en: 'Drag-and-drop stack selection before the interview, with stack-based suggestions.',
      fr: 'Choix de la pile par glisser-déposer avant l’entrevue, avec suggestions.',
    },
    defaultEnabled: true,
    views: ['stack'],
  }),
  f({
    id: 'import',
    category: 'authoring',
    label: { en: 'Import existing work', fr: 'Import de l’existant' },
    description: {
      en: 'Repository, document and JSON bundle import into proposals.',
      fr: 'Import de dépôts, documents et paquets JSON en propositions.',
    },
    defaultEnabled: true,
    views: ['import'],
    routes: [
      '* /api/v1/projects/:id/import', 'POST /api/v1/projects/:id/plan-folder/import',
      '* /api/v1/projects/:id/import/:kind',
      'GET /api/v1/import/rules',
    ],
  }),
  f({
    id: 'catalog',
    category: 'authoring',
    label: { en: 'Technology catalog editing', fr: 'Modification du catalogue technologique' },
    description: {
      en: 'Allow updates to workspace catalog entries through the API.',
      fr: 'Autoriser la modification des technologies du catalogue par l’API.',
    },
    defaultEnabled: true,
    routes: ['PUT /api/v1/catalog/:id'],
  }),
  f({
    id: 'search',
    category: 'authoring',
    label: { en: 'Section search', fr: 'Recherche de sections' },
    description: {
      en: 'Full-text and semantic search across document sections.',
      fr: 'Recherche plein texte et sémantique dans les sections.',
    },
    defaultEnabled: true,
    views: ['search'],
    routes: ['* /api/v1/projects/:id/search', '* /api/v1/projects/:id/search/index'],
  }),
  f({
    id: 'ai',
    category: 'ai',
    label: { en: 'AI assistance', fr: 'Assistance IA' },
    description: {
      en: 'Ask AI runs (OpenAI, Anthropic, NVIDIA NIM, Ollama) that produce proposals and generated questions.',
      fr: 'Exécutions IA (OpenAI, Anthropic, NVIDIA NIM, Ollama) produisant des propositions.',
    },
    defaultEnabled: true,
    views: ['builder'],
    routes: ['POST /api/v1/projects/:id/jobs', 'POST /api/v1/projects/:id/agent', 'POST /api/v1/projects/:id/agent/warm'],
  }),
  f({
    id: 'agentRunner',
    category: 'ai',
    label: { en: 'Claude Agent workspaces', fr: 'Espaces Claude Agent' },
    description: {
      en: 'Isolated Claude Agent runs that inspect repository snapshots.',
      fr: 'Exécutions Claude Agent isolées sur des instantanés de dépôt.',
    },
    defaultEnabled: true,
    // No route of its own: queueAiJob refuses `claude-agent` runs when this is off.
  }),
  f({
    id: 'mcp',
    category: 'ai',
    label: { en: 'MCP server for coding agents', fr: 'Serveur MCP pour agents de code' },
    description: {
      en: 'Project tokens that let coding agents read the specification, move cards and propose changes.',
      fr: 'Jetons permettant aux agents de lire la spécification et de proposer des changements.',
    },
    defaultEnabled: true,
    routes: [
      '* /api/v1/mcp',
      '* /api/v1/projects/:id/mcp/tokens',
      '* /api/v1/projects/:id/mcp/tokens/:tokenId',
    ],
  }),
  f({
    id: 'board',
    category: 'delivery',
    label: { en: 'Implementation board', fr: 'Tableau de réalisation' },
    description: {
      en: 'Kanban board from baselines with .plan/tasks.md import and export.',
      fr: 'Tableau Kanban issu des références, import et export .plan.',
    },
    defaultEnabled: true,
    views: ['board'],
    routes: ['* /api/v1/projects/:id/board', '* /api/v1/projects/:id/board/:action'],
  }),
  f({
    id: 'pullRequests',
    category: 'delivery',
    label: { en: 'Pull-request status', fr: 'État des demandes de fusion' },
    description: {
      en: 'Reads GitHub, GitLab and Azure DevOps pull-request status for board cards.',
      fr: 'Lit l’état des demandes de fusion GitHub, GitLab et Azure DevOps.',
    },
    defaultEnabled: true,
    routes: ['POST /api/v1/projects/:id/board/pull-requests'],
  }),
  f({
    id: 'gitPublishing',
    category: 'delivery',
    label: { en: 'Git publishing', fr: 'Publication Git' },
    description: {
      en: 'Branches and pull requests from approved baselines, and Git imports.',
      fr: 'Branches et demandes de fusion depuis les références, imports Git.',
    },
    defaultEnabled: true,
    routes: ['* /api/v1/projects/:id/git', '* /api/v1/projects/:id/git/:action'],
  }),
  f({
    id: 'reports',
    category: 'delivery',
    label: { en: 'PDF reports and images', fr: 'Rapports PDF et images' },
    description: {
      en: 'Isolated rendering of PDF reports and concept images.',
      fr: 'Rendu isolé de rapports PDF et d’images.',
    },
    defaultEnabled: true,
    routes: ['* /api/v1/projects/:id/publishing'],
  }),
  f({
    id: 'starter',
    category: 'delivery',
    label: { en: 'Starter repository', fr: 'Dépôt de départ' },
    description: {
      en: 'Download a versioned starter repository generated from the baseline.',
      fr: 'Télécharger un dépôt de départ généré depuis la référence.',
    },
    defaultEnabled: true,
    routes: ['GET /api/v1/projects/:id/scaffold'],
  }),
  f({
    id: 'connectors',
    category: 'integrations',
    label: { en: 'Connectors', fr: 'Connecteurs' },
    description: {
      en: 'GitLab, Linear, Jira, Notion, Confluence, Google Drive, Figma and MCP resource sources.',
      fr: 'Sources GitLab, Linear, Jira, Notion, Confluence, Google Drive, Figma et MCP.',
    },
    defaultEnabled: true,
    routes: [
      '* /api/v1/projects/:id/connectors',
      '* /api/v1/projects/:id/connectors/:connector',
      '* /api/v1/projects/:id/connectors/:connector/:action',
    ],
  }),
  f({
    id: 'diagrams',
    category: 'integrations',
    label: { en: 'Kroki and UML MCP diagrams', fr: 'Diagrammes Kroki et UML MCP' },
    description: {
      en: 'External diagram rendering and UML drawing tools.',
      fr: 'Rendu externe de diagrammes et outils UML.',
    },
    defaultEnabled: true,
    routes: [
      '* /api/v1/projects/:id/diagrams/kroki',
      '* /api/v1/projects/:id/diagrams/evidence',
      '* /api/v1/projects/:id/diagrams/uml/tools',
      '* /api/v1/projects/:id/diagrams/uml/call',
    ],
  }),
  f({
    id: 'googleSignIn',
    category: 'identity',
    label: { en: 'Google sign-in', fr: 'Connexion Google' },
    description: {
      en: 'Sign in with Google when it is configured.',
      fr: 'Connexion avec Google lorsqu’elle est configurée.',
    },
    defaultEnabled: true,
    routes: ['GET /api/v1/auth/google', 'GET /api/v1/auth/google/callback'],
  }),
  f({
    id: 'sso',
    category: 'identity',
    label: { en: 'Enterprise SSO (OIDC)', fr: 'Authentification unique (OIDC)' },
    description: {
      en: 'Sign in through the configured OpenID Connect provider.',
      fr: 'Connexion par le fournisseur OpenID Connect configuré.',
    },
    defaultEnabled: true,
    routes: ['GET /api/v1/auth/oidc', 'GET /api/v1/auth/oidc/callback'],
  }),
  f({
    id: 'tour',
    category: 'experience',
    label: { en: 'Guided tour', fr: 'Visite guidée' },
    description: {
      en: 'First-run tour that highlights each area of the app.',
      fr: 'Visite au premier lancement qui présente chaque zone.',
    },
    defaultEnabled: true,
  }),
  f({
    id: 'generatedUi',
    category: 'experience',
    label: { en: 'AI-generated forms', fr: 'Formulaires générés par IA' },
    description: {
      en: 'Validated forms proposed by AI runs for follow-up questions.',
      fr: 'Formulaires validés proposés par l’IA pour les questions de suivi.',
    },
    defaultEnabled: true,
    routes: ['POST /api/v1/projects/:id/proposals/:proposalId/controls/:index'],
  }),
] as const satisfies readonly FeatureFlag[];

export type FeatureId = (typeof featureFlags)[number]['id'];
export type FeatureState = Record<FeatureId, boolean>;

export const defaultFeatures = (): FeatureState =>
  Object.fromEntries(featureFlags.map((flag) => [flag.id, flag.defaultEnabled])) as FeatureState;

/** Stored overrides applied to defaults; unknown keys are ignored so removed flags cannot linger. */
export function effectiveFeatures(overrides: Partial<Record<string, boolean>> = {}): FeatureState {
  const state = defaultFeatures();
  for (const flag of featureFlags)
    if (typeof overrides[flag.id] === 'boolean') state[flag.id] = overrides[flag.id]!;
  return state;
}

const toPattern = (route: string) => {
  const [method, path] = route.split(' ');
  return { method, regex: new RegExp(`^${path.replace(/:[A-Za-z]+/g, '[^/]+')}/?$`) };
};
const compiled = featureFlags.flatMap((flag) =>
  ((flag as FeatureFlag).routes ?? []).map((r) => ({ id: flag.id as FeatureId, ...toPattern(r) })),
);

/** Feature that owns a request, if any (the most specific pattern wins, so pull requests beat the board). */
export function featureForRequest(method: string, path: string): FeatureId[] {
  const clean = path.split('?')[0];
  return compiled
    .filter((c) => (c.method === '*' || c.method === method) && c.regex.test(clean))
    .map((c) => c.id);
}

/** Views hidden by disabled features. */
export const hiddenViews = (state: FeatureState) =>
  new Set(
    featureFlags
      .filter((flag) => !state[flag.id])
      .flatMap((flag) => (flag as FeatureFlag).views ?? []),
  );

/**
 * Effect of a feature, after Spec Kit extensions: read-write when any of its routes can change data
 * (any method but GET), read-only when it only reads or renders.
 */
export function featureEffect(id: FeatureId): 'read-only' | 'read-write' {
  const routes = (featureFlags.find((flag) => flag.id === id) as FeatureFlag | undefined)?.routes ?? [];
  return routes.some((r) => !r.startsWith('GET ')) ? 'read-write' : 'read-only';
}
