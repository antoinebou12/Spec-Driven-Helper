import type { FastifyInstance, RouteOptions } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemas } from '../../../packages/shared/src/schema';
import type { Auth } from './auth-types';

/**
 * OpenAPI 3.1 description of the HTTP API, served at /api/docs/json and rendered with Swagger UI
 * at /api/docs. Handlers validate input with the shared Zod schemas; this table documents each
 * route and references those schemas. `tests/openapi.test.ts` fails when a registered route is
 * missing here, so the document cannot drift from the server.
 */
type Doc = { tag: string; summary: string; body?: string; response?: string; public?: boolean; description?: string };
const d = (tag: string, summary: string, extra: Omit<Doc, 'tag' | 'summary'> = {}): Doc => ({ tag, summary, ...extra });

export const routeDocs: Record<string, Doc> = {
  'GET /api/v1/projects/{id}/openspec': d('Export', 'OpenSpec export diagnostics (revision, draft, validated=false, bilingual diagnostics)'),
  'POST /api/v1/projects/{id}/openspec/import': d('Import', 'Preview OpenSpec files or explicitly propose specification changes / merge board tasks', { description: 'Body: files (path to text), baseRevision, selectedChange (required for multiple changes), preview (default true), action (specification or board). Board action requires expectedBoardRevision. Preview writes nothing and returns sources, diagnostics, specification.patch/changes and board.cards/added/updated/revision. Confirmed specification imports return proposalId. 409: stale revision; 422: unresolved diagnostics. No CLI, instructions or external writes are executed.' }),
  'GET /api/health': d('Operations', 'Readiness probe (database reachable)', { public: true }),
  'GET /api/health/live': d('Operations', 'Liveness probe', { public: true }),
  'GET /api/metrics': d('Operations', 'Prometheus metrics (METRICS_TOKEN or local request)', { public: true }),
  'GET /api/v1/auth/options': d('Authentication', 'Available sign-in methods', { public: true }),
  'POST /api/v1/auth/login': d('Authentication', 'Sign in with email and password', { public: true }),
  'POST /api/v1/auth/logout': d('Authentication', 'Sign out and end the session', { public: true }),
  'GET /api/v1/auth/me': d('Authentication', 'Current user'),
  'POST /api/v1/auth/invites': d('Authentication', 'Create an invitation link (admin)'),
  'POST /api/v1/auth/accept-invite': d('Authentication', 'Accept an invitation and create an account', { public: true }),
  'GET /api/v1/auth/oidc': d('Authentication', 'Start company SSO (OIDC with PKCE)', { public: true }),
  'GET /api/v1/auth/oidc/callback': d('Authentication', 'OIDC callback', { public: true }),
  'POST /api/v1/auth/signup': d('Authentication', 'Request an account when self-registration is enabled (activated by an admin)', { public: true }),
  'GET /api/v1/auth/google': d('Authentication', 'Start Google sign-in (OIDC with PKCE)', { public: true }),
  'GET /api/v1/auth/google/callback': d('Authentication', 'Google sign-in callback', { public: true }),
  'GET /api/v1/admin/configuration': d('Administration', 'Runtime configuration (secrets reported only as configured)'),
  'PUT /api/v1/admin/configuration': d('Administration', 'Update runtime configuration (admin; secrets encrypted)'),
  'GET /api/v1/admin/stats': d('Administration', 'Usage, job and performance statistics (admin)'),
  'GET /api/v1/admin/example-projects': d('Administration', 'Projects created from the built-in example (admin)'),
  'DELETE /api/v1/admin/example-projects': d('Administration', 'Remove every example project and the data it owns (admin, body {"confirm": true}; audited)'),
  'POST /api/v1/admin/users/{id}/activate': d('Administration', 'Activate a requested account (admin)'),
  'GET /api/v1/projects/{id}/search': d('Search', 'Full-text or semantic search across document sections'),
  'POST /api/v1/projects/{id}/search/index': d('Search', 'Rebuild the section search index and embeddings'),
  'GET /api/v1/users': d('Workspace', 'List workspace users (admin)'),
  'PUT /api/v1/users/{userId}/role': d('Workspace', 'Change a workspace role (owner-only escalation)'),
  'POST /api/v1/users/{userId}/deactivate': d('Workspace', 'Deactivate a user and end their sessions'),
  'GET /api/v1/audit': d('Workspace', 'Recent audit entries (admin)'),
  'GET /api/v1/templates': d('Templates', 'Specification modules, questions, references and diagrams'),
  'GET /api/v1/schemas': d('Templates', 'JSON Schemas of the shared contracts'),
  'GET /api/v1/guidance': d('Templates', 'Team guidance per module or question'),
  'PUT /api/v1/guidance/{key}': d('Templates', 'Set team guidance (admin)'),
  'GET /api/v1/catalog': d('Catalog', 'Technology catalog', { response: 'technology' }),
  'PUT /api/v1/catalog/{id}': d('Catalog', 'Create or update a technology; ring moves are recorded', { body: 'technology' }),
  'GET /api/v1/catalog/{id}/usage': d('Catalog', 'Projects that use a technology'),
  'GET /api/v1/import/rules': d('Import', 'Repository import rules'),
  'GET /api/v1/projects': d('Projects', 'Projects visible to the user'),
  'POST /api/v1/projects': d('Projects', 'Create a project (blank or from the example)'),
  'POST /api/v1/projects/import': d('Projects', 'Create a project from a canonical JSON bundle', { body: 'bundle' }),
  'GET /api/v1/projects/{id}': d('Projects', 'Specification, role, readiness and pending proposal count'),
  'PATCH /api/v1/projects/{id}': d('Projects', 'Apply a patch against an expected revision (409 with conflict details when stale)', { body: 'patch', response: 'specification' }),
  'GET /api/v1/projects/{id}/history': d('Projects', 'Revision history with provenance and changed paths'),
  'GET /api/v1/projects/{id}/revisions/{revision}': d('Projects', 'One revision snapshot'),
  'GET /api/v1/projects/{id}/members': d('Projects', 'Project members'),
  'POST /api/v1/projects/{id}/members': d('Projects', 'Add or change a member (admin)'),
  'DELETE /api/v1/projects/{id}/members/{userId}': d('Projects', 'Remove a member (admin)'),
  'GET /api/v1/projects/{id}/settings': d('Projects', 'AI budget settings'),
  'PUT /api/v1/projects/{id}/settings': d('Projects', 'Update AI budget settings (admin)'),
  'POST /api/v1/projects/{id}/import': d('Import', 'Stage a JSON bundle as a proposal', { body: 'bundle', response: 'proposal' }),
  'POST /api/v1/projects/{id}/import/repository': d('Import', 'Analyse a repository (zip, Git URL or configured remote) into a proposal'),
  'POST /api/v1/projects/{id}/import/document': d('Import', 'Map a Markdown, text or HTML document into a proposal'),
  'POST /api/v1/projects/{id}/diagrams/kroki': d('Diagrams', 'Render a diagram through the configured Kroki endpoint (editor; not for local-only projects)'),
  'GET /api/v1/projects/{id}/diagrams/uml/tools': d('Diagrams', 'UML MCP tools enabled by the administrator (editor)'),
  'POST /api/v1/projects/{id}/diagrams/uml/call': d('Diagrams', 'Call an enabled read-only UML MCP drawing tool (editor)'),
  'POST /api/v1/projects/{id}/diagrams/evidence': d('Diagrams', 'Render a section evidence map through MCP and propose it for review (editor; confirmed; revision guarded; not local-only)'),
  'GET /api/v1/features': d('Features', 'Effective feature flags and their catalog'),
  'GET /api/v1/dashboard': d('Projects', 'Role-aware dashboard: progress of every readable project and what waits for the user'),
  'GET /llms.txt': d('AIO', 'Product summary for language models (llmstxt.org)', { public: true }),
  'GET /llms-full.txt': d('AIO', 'Full product description, FAQ and MCP tools for language models', { public: true }),
  'GET /robots.txt': d('AIO', 'Crawler rules: public pages allowed, /api never', { public: true }),
  'GET /sitemap.xml': d('AIO', 'Public pages', { public: true }),
  'GET /api/v1/projects/{id}/plan-folder': d('Export', 'The whole .plan folder as a zip: specification, section documents, tasks, backlog and board'),
  'POST /api/v1/projects/{id}/plan-folder/import': d('Import', 'Import a .plan folder: specification as a proposal, tasks and backlog into the board (preview first)'),
  'GET /api/v1/admin/observability': d('Admin', 'Live traffic, latency, errors, jobs, database and links to Grafana, Prometheus and Netdata (workspace admin)'),
  'GET /api/v1/admin/features': d('Features', 'Feature flags with last change (workspace admin)'),
  'PUT /api/v1/admin/features': d('Features', 'Enable or disable features (workspace admin, audited)'),
  'GET /api/v1/projects/{id}/mcp/tokens': d('MCP', 'Active MCP tokens of the project (admin)'),
  'POST /api/v1/projects/{id}/mcp/tokens': d('MCP', 'Create a project MCP token; the token is returned once (admin)'),
  'DELETE /api/v1/projects/{id}/mcp/tokens/{tokenId}': d('MCP', 'Revoke an MCP token (admin)'),
  'POST /api/v1/mcp': d('MCP', 'MCP Streamable HTTP endpoint for coding agents (Bearer project MCP token, JSON-RPC)'),
  'GET /api/v1/mcp': d('MCP', 'Not supported by this stateless MCP server (405)'),
  'GET /api/v1/projects/{id}/board': d('Board', 'Kanban board and the latest approved baseline'),
  'PUT /api/v1/projects/{id}/board': d('Board', 'Replace the cards (moves and edits) with a revision guard (editor)'),
  'POST /api/v1/projects/{id}/board/generate': d('Board', 'Refresh the task plan (epics, order, dependencies) from the latest approved baseline; approving a baseline already does this (editor)'),
  'POST /api/v1/projects/{id}/board/import-plan': d('Board', 'Import .plan/tasks.md checkbox tasks; preview first (editor)'),
  'GET /api/v1/projects/{id}/board/export-plan': d('Board', 'Export the board as .plan/tasks.md'),
  'POST /api/v1/projects/{id}/board/pull-requests': d('Board', 'Read GitHub, GitLab and Azure DevOps pull-request status for the cards'),
  'GET /api/v1/projects/{id}/export/{format}': d('Export', 'Export the current revision (json, markdown, xml, toon, latex, html, svg, pdf, zip, speckit, openspec, skill, agents)'),
  'GET /api/v1/projects/{id}/baselines/{baselineId}/export/{format}': d('Export', 'Export an approved baseline'),
  'POST /api/v1/projects/{id}/assets': d('Assets', 'Upload an image or text asset'),
  'GET /api/v1/projects/{id}/assets/{assetId}': d('Assets', 'Download an asset'),
  'POST /api/v1/projects/{id}/assets/{assetId}/approve': d('Assets', 'Approve a generated asset (reviewer)'),
  'GET /api/v1/projects/{id}/proposals': d('Review', 'Proposals with change summaries', { response: 'proposal' }),
  'POST /api/v1/projects/{id}/proposals/{proposalId}/accept': d('Review', 'Accept a proposal (409 when stale)'),
  'POST /api/v1/projects/{id}/proposals/{proposalId}/reject': d('Review', 'Reject a proposal'),
  'POST /api/v1/projects/{id}/proposals/{proposalId}/rebase': d('Review', 'Move a stale proposal onto the current revision when nothing overlaps'),
  'POST /api/v1/projects/{id}/proposals/{proposalId}/controls/{index}': d('Review', 'Answer a generated follow-up control'),
  'POST /api/v1/projects/{id}/proposals/{proposalId}/resolve': d('Git', 'Choose a version for each Git conflict'),
  'POST /api/v1/projects/{id}/review/{sectionId}': d('Review', 'Mark a section reviewed (reviewer)'),
  'POST /api/v1/projects/{id}/items/{itemId}/review': d('Review', 'Clear needs-review or accept an item (reviewer)'),
  'GET /api/v1/projects/{id}/baselines': d('Review', 'Approved baselines'),
  'POST /api/v1/projects/{id}/baselines': d('Review', 'Approve an immutable baseline when ready (reviewer); splits the project into board tasks and reports how many were added'),
  'GET /api/v1/projects/{id}/baselines/{baselineId}': d('Review', 'One approved baseline'),
  'GET /api/v1/integrations': d('AI', 'Providers and whether each is configured (secrets are never returned)'),
  'PUT /api/v1/integrations/{provider}': d('AI', 'Configure a provider (admin; secret is write-only)'),
  'GET /api/v1/integrations/{provider}/models': d('AI', 'Models available from a provider'),
  'GET /api/v1/integrations/ollama/status': d('AI', 'Ollama connection check: version, installed models, context windows (admin)'),
  'GET /api/v1/projects/{id}/usage': d('AI', 'Token usage this month and budget'),
  'GET /api/v1/projects/{id}/jobs': d('AI', 'Recent AI and publishing runs'),
  'POST /api/v1/projects/{id}/jobs': d('AI', 'Queue an AI run (budgets, local-only and capability checks apply)'),
  'POST /api/v1/projects/{id}/jobs/{jobId}/cancel': d('AI', 'Cancel a queued or running job'),
  'POST /api/v1/projects/{id}/draft': d('AI', 'Draft the essential answers of the project type from one sentence as a proposal for review; the sentence defaults to the project description; says why when no AI can run (editor)'),
  'GET /api/v1/projects/{id}/jobs/{jobId}/events': d('AI', 'AG-UI event stream (server-sent events)', { description: 'Resumable with the Last-Event-ID header.' }),
  'POST /api/v1/projects/{id}/agent': d('AI', 'Conversational builder (AG-UI agent, server-sent events)', { description: 'Takes an AG-UI RunAgentInput and streams AG-UI events. Confirmed facts become pending proposals; nothing is written directly. Editors and above.' }),
  'POST /api/v1/projects/{id}/agent/warm': d('AI', 'Load a local Ollama model before the conversation starts'),
  'GET /api/v1/projects/{id}/git': d('Git', 'Configured remote and last publication'),
  'PUT /api/v1/projects/{id}/git': d('Git', 'Configure GitHub or a generic HTTPS remote (admin)'),
  'POST /api/v1/projects/{id}/git/publish': d('Git', 'Publish the implementation bundle to a new branch (explicit confirmation)'),
  'POST /api/v1/projects/{id}/git/import': d('Git', 'Import Git changes as a three-way-merged proposal'),
  'GET /api/v1/projects/{id}/publishing': d('Publishing', 'Publishing assets and PDF service status'),
  'POST /api/v1/projects/{id}/publishing': d('Publishing', 'Queue a PDF report or UX concept image'),
  'GET /api/v1/projects/{id}/scaffold': d('Publishing', 'Starter repository from the latest baseline'),
  'GET /api/v1/projects/{id}/connectors': d('Connectors', 'Connectors and their status'),
  'PUT /api/v1/projects/{id}/connectors/{connector}': d('Connectors', 'Configure a connector (admin)'),
  'POST /api/v1/projects/{id}/connectors/{connector}/read': d('Connectors', 'Import an external source as a proposal'),
  'POST /api/v1/projects/{id}/connectors/{connector}/publish': d('Connectors', 'Create an external issue (explicit confirmation)'),
};

/** `/a/:id` → `/a/{id}` */
export const openApiPath = (url: string) => url.replace(/:(\w+)/g, '{$1}');
const components = Object.fromEntries(
  Object.entries(jsonSchemas).map(([name, schema]) => {
    const { $schema: _drop, ...rest } = schema as Record<string, unknown>;
    return [name, rest];
  }),
);
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

export function openApiDocument(routes: { method: string; url: string }[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const path = openApiPath(r.url);
    const doc = routeDocs[`${r.method} ${path}`];
    if (!doc) continue;
    const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    (paths[path] ??= {})[r.method.toLowerCase()] = {
      tags: [doc.tag],
      summary: doc.summary,
      ...(doc.description ? { description: doc.description } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(doc.public ? { security: [] } : {}),
      ...(doc.body ? { requestBody: { required: true, content: { 'application/json': { schema: ref(doc.body) } } } } : {}),
      responses: {
        '200': { description: 'Success', ...(doc.response ? { content: { 'application/json': { schema: ref(doc.response) } } } : {}) },
        ...(doc.public ? {} : { '401': { description: 'Not signed in' }, '403': { description: 'Not permitted for this role' } }),
        '400': { description: 'Invalid input (field path and message in `error`)' },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'SDD Studio API',
      version: '1.0.0',
      description: 'Specification workspace API. Session cookie authentication; state-changing requests must come from the application origin.',
    },
    servers: [{ url: '/' }],
    security: [{ session: [] }],
    components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'sdd_session' } }, schemas: components },
    paths,
  };
}

/** Collects routes as they register; call before any route plugin. */
/** Public AI-optimisation files at the site root (llms.txt, robots.txt, sitemap.xml). */
const aioFiles = /^\/(llms(-full)?\.txt|robots\.txt|sitemap\.xml)$/;
export function collectRoutes(app: FastifyInstance) {
  const routes: { method: string; url: string }[] = [];
  app.addHook('onRoute', (route: RouteOptions) => {
    for (const method of [route.method].flat()) if (method !== 'HEAD' && ((route.url.startsWith('/api') && !route.url.startsWith('/api/docs')) || aioFiles.test(route.url))) routes.push({ method, url: route.url });
  });
  return routes;
}

/** Swagger UI at /api/docs for signed-in users; the document is built from the collected routes. */
export async function registerOpenApi(app: FastifyInstance, auth: Auth, routes: { method: string; url: string }[]) {
  // Filled when the server is ready, so routes registered after this call are included too.
  const document: Record<string, unknown> = {};
  app.addHook('onReady', async () => {
    Object.assign(document, openApiDocument(routes));
  });
  await app.register(swagger, { mode: 'static', specification: { document: document as never } });
  app.decorate('apiRoutes', routes);
  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    uiHooks: { onRequest: async (req) => auth(req) },
  });
}
