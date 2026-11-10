import { createSpec, validateSpec } from './domain';
import { renderSection } from './markdown';
import { applicableQuestions, modules, type Language } from './templates';
import type { Item, Link, Spec } from './schema';

/**
 * Complete example project demonstrating every documentation module: answers for all applicable
 * questions, traceable items, links and diagrams. Sections start as drafts so teams can walk
 * through review and baseline approval themselves.
 */
const rows = (...r: string[][]) => JSON.stringify(r);
const answers: Record<string, string> = {
  // Business & discovery
  'discovery.1':
    'Business customers track service requests through email threads. Support spends about 6 hours per week answering status questions, and customers cannot see progress or history in one place.',
  'discovery.2':
    'Reduce status follow-up emails by 30% within one quarter of launch. Give every customer a single, current view of their requests.',
  'discovery.3': rows(
    ['Customer Experience director', 'Fewer escalations', 'Approves scope and budget'],
    ['Platform Engineering lead', 'Operable, secure system', 'Approves architecture'],
    ['Support Operations manager', 'Faster responses', 'Consulted on workflows'],
    ['Security architect', 'Tenant isolation', 'Approves threat model'],
  ),
  'discovery.4':
    'Primary: office managers at client companies who submit and follow requests a few times a week from a laptop. Secondary: support agents who work in the tool all day and need fast triage.',
  'discovery.5':
    'Launch: 2,000 registered users, 200 daily, 50 concurrent. Year one: 10,000 registered, 250 concurrent. Source: current CRM account list; confidence medium.',
  'discovery.6':
    'Internal cost centre (Customer Experience). Build: 3 engineers for 4 months. Hosting under $600/month; AI assistance capped at $150/month.',
  'discovery.7':
    'Must run on the company Kubernetes platform and use the corporate identity provider. Assumption: customers accept email notifications — validate with 5 interviews before the pilot.',
  'discovery.8':
    'Status emails per week: 120 → 84 by end of Q2 (support mailbox tags). Median first response time under 4 business hours (support tool).',
  'discovery.9': rows(
    ['Low customer adoption', 'Medium', 'High', 'Pilot with 3 accounts before launch', 'Product owner'],
    ['Identity integration delayed', 'Medium', 'Medium', 'Register OIDC client in week 1', 'Tech lead'],
  ),
  // Scope & requirements
  'scope.1':
    'Sign-in through company SSO, request creation with attachments, request timeline, support replies, email notifications and an agent triage queue.',
  'scope.2':
    'Billing changes and live chat are excluded. Native mobile apps are deferred; the web app must work on mobile browsers.',
  'scope.3': rows(
    ['REQ-001', 'Customers submit a request with up to 5 attachments', 'Must', 'Request receives an ID within 2 seconds'],
    ['REQ-002', 'Customers see only their organization’s requests', 'Must', 'Cross-organization access returns 404'],
    ['REQ-003', 'Customers see a timeline of status changes and replies', 'Must', 'Timeline updates within 5 seconds of a reply'],
    ['REQ-004', 'Agents reply to requests from a triage queue', 'Must', 'Reply visible to the customer within 5 seconds'],
    ['REQ-005', 'Customers receive an email when a request changes status', 'Should', 'Email sent within 2 minutes for 99% of changes'],
    ['REQ-006', 'All screens meet WCAG 2.2 AA', 'Must', 'No serious axe violations; manual NVDA pass'],
  ),
  'scope.4':
    'Given a signed-in customer, when they submit a valid request, then it appears in their timeline with an ID within 2 seconds. Given a customer of organization A, when they open a request of organization B, then the API returns 404 and the attempt is audited.',
  'scope.5':
    'Identity team registers the OIDC client (week 1). Email delivery account approved by Procurement (week 3).',
  'scope.6':
    'Attachments rarely exceed 10 MB — confirm from last quarter’s mailbox. Agents prefer a single queue over per-product queues — confirm in the pilot.',
  'scope.7':
    'Pilot with 3 customers on June 15 (all Must requirements pass). General availability on August 1 after the pilot review.',
  // Users & workflows
  'workflows.1': rows(
    ['Customer', 'Create and view own organization’s requests; reply', 'See other organizations; change status'],
    ['Support agent', 'View queues, reply, change status', 'Change organization settings'],
    ['Administrator', 'Manage organizations, users and settings', 'Read request content without an assignment'],
  ),
  'workflows.2':
    '1. Customer signs in with SSO. 2. Opens “New request”. 3. Describes the issue and attaches files. 4. Submits. 5. Sees the request ID and status “Submitted”. 6. Receives an email when an agent replies.',
  'workflows.3': rows(
    ['UC-001', 'Submit a request', 'Customer', 'New issue', 'Request tracked with an ID'],
    ['UC-002', 'Follow a request', 'Customer', 'Status question', 'Current status and history visible'],
    ['UC-003', 'Triage and reply', 'Support agent', 'New request in queue', 'Customer receives a reply'],
  ),
  'workflows.4':
    'BR-01: A closed request can be reopened only within 14 days. BR-02: Attachments are limited to 5 files of 10 MB each. BR-03: Only agents change status.',
  'workflows.5':
    'Attachment upload fails: keep the draft, show which file failed, allow retry. Session expires: preserve the draft locally and ask the user to sign in again. Email provider down: queue notifications for 24 hours.',
  'workflows.6':
    'Draft → Submitted (customer) → In progress (agent) → Resolved (agent) → Closed after 14 days; Submitted → Rejected (agent, with reason).',
  'workflows.7':
    'The full request journey works with keyboard and NVDA; no step has a time limit; error messages name the field and the fix.',
  // Architecture
  'architecture.1':
    'Inside: web app, request API, notification worker, PostgreSQL. External: corporate identity provider (OIDC) and email delivery service.',
  'architecture.2': rows(
    ['CMP-001 Web app', 'Customer and agent interface', 'React, TypeScript'],
    ['CMP-002 Request API', 'Validation, authorization, persistence', 'Node.js, Fastify'],
    ['CMP-003 Notification worker', 'Sends status emails from a durable queue', 'Node.js'],
    ['CMP-004 Request store', 'Requests, timelines, attachments', 'PostgreSQL (JSONB) with S3-compatible object storage for attachments'],
  ),
  'architecture.3':
    'Identity provider: OIDC authorization code with PKCE. Email service: HTTPS JSON API, API key in the vault, 5 s timeout, 3 retries with backoff, failures queued for 24 hours.',
  'architecture.4':
    'Two API containers and one worker behind the company TLS ingress in the Canada Central region; managed PostgreSQL with a standby replica in the same region.',
  'architecture.5': rows(
    ['Modular monolith', 'Simple deploys, one codebase', 'Coarse scaling', 'Chosen (ADR-001)'],
    ['Microservices', 'Independent scaling', 'Operational overhead for a team of 3', 'Rejected'],
  ),
  'architecture.6':
    'ADR-001 Modular monolith for release 1. ADR-002 PostgreSQL for requests, object storage for attachments. ADR-003 Durable job queue in PostgreSQL for notifications.',
  'architecture.7':
    'Web app, API and worker: Platform Engineering. Email templates: Customer Experience.',
  // Data & APIs
  'data.1':
    'Organization 1–n Customer; Customer 1–n Request; Request 1–n TimelineEntry; Request 1–n Attachment. Request IDs are opaque UUIDs; the organizationId is on every request.',
  'data.2':
    'REST JSON under /api/v1 described with OpenAPI 3.1. Breaking changes ship as /api/v2 with 6 months of overlap.',
  'data.3':
    'RequestStatusChanged is delivered at least once to the notification worker; the worker deduplicates by requestId and status.',
  'data.4':
    'Every request body is validated with shared JSON Schemas on the server. Errors use RFC 9457 problem details with field paths.',
  'data.5':
    'Closed requests kept 3 years, then anonymized. Attachments deleted after 1 year. Backups expire after 35 days.',
  'data.6':
    'Versioned migration scripts run before deployment using expand/contract: add fields, switch code, remove old fields one release later.',
  'data.7':
    'CSV export of requests for reporting (lossy). JSON export and import of an organization’s data (lossless, schema-validated).',
  // Nonfunctional
  'quality.1':
    'Request list p95 < 300 ms server time at 50 req/s. Pages interactive within 2.5 s on a mid-range laptop.',
  'quality.2': '250 concurrent sessions, 80 req/s peak, 50 GB of attachments in year one, with 2× headroom.',
  'quality.3': '99.5% monthly during business hours (8:00–18:00 ET); maintenance announced 48 hours ahead.',
  'quality.4': 'WCAG 2.2 AA for all screens; axe checks in CI; manual NVDA review before each release.',
  'quality.5': 'API containers scale out at 70% CPU up to 6 instances; the database is the first bottleneck — review at 60% storage.',
  'quality.6': 'Notifications queue for 24 hours if email is down. Database RPO 15 minutes, RTO 2 hours.',
  'quality.7': 'Domain code ≥ 80% branch coverage; dependencies updated monthly; each module has a README with its contracts.',
  'quality.8': rows(
    ['p95 < 300 ms at 50 req/s', 'Load test', 'k6', 'Before each release'],
    ['99.5% availability', 'SLO monitoring', 'Prometheus', 'Continuous'],
    ['WCAG 2.2 AA', 'Automated and manual audit', 'axe, NVDA', 'Each release'],
  ),
  // Security & privacy
  'security.1': rows(
    ['Request content and attachments', 'Confidential', 'Customer Experience', 'PostgreSQL, object storage and backups'],
    ['User identities', 'Confidential', 'Platform Engineering', 'PostgreSQL'],
    ['Email API key', 'Restricted', 'Platform Engineering', 'Vault'],
  ),
  'security.2':
    'Browser→API: session hijacking — HttpOnly SameSite cookies, origin checks. API→DB: cross-tenant reads — organization filter enforced in the data layer (RISK-002). Worker→Email: key leakage — key only in the vault.',
  'security.3': 'Corporate OIDC with MFA enforced by the IdP; 8-hour sessions in HttpOnly cookies; invitation-only provisioning.',
  'security.4': rows(
    ['Customer', 'Own organization’s requests', 'Status changes, other organizations', 'Organization'],
    ['Support agent', 'Assigned queues, replies, status', 'Organization settings', 'Assigned queues'],
    ['Administrator', 'Users and settings', 'Unassigned request content', 'Workspace'],
  ),
  'security.5': 'Secrets in the cloud vault, injected at runtime, rotated every 90 days; secret scanning on every pull request.',
  'security.6': 'TLS 1.2+ everywhere; storage encryption by the database service; the email API key is never stored in the database.',
  'security.7': 'Audit role changes, exports, denied cross-organization access and settings changes with actor, time and target; keep 1 year.',
  'security.8':
    'Customers in Québec and Ontario: Québec Law 25 and PIPEDA likely apply. Privacy officer confirms and completes a privacy impact assessment by week 4.',
  // UX & design system
  'design.1': 'Left navigation with Requests, Knowledge base and Settings; each request has a shareable URL; breadcrumbs on detail pages.',
  'design.2': rows(
    ['Request list', 'Find requests', 'Filter and open', 'UC-002'],
    ['New request', 'Capture an issue', 'Submit', 'UC-001'],
    ['Request detail', 'Follow and reply', 'Reply', 'UC-002, UC-003'],
    ['Triage queue', 'Assign and answer', 'Reply', 'UC-003'],
  ),
  'design.3':
    'Button, text field, file drop zone, status badge, timeline, data table, dialog — each with default, hover, focus-visible, loading, empty, error and disabled states. Built on shadcn/ui primitives.',
  'design.4': 'Color roles surface, text, muted, accent, danger, success; body 16 px / 1.5; 4 px spacing scale; light and dark themes with at least 4.5:1 text contrast.',
  'design.5': 'Below 768 px the navigation becomes a menu button, tables become cards and touch targets are at least 44 px. Supports 200% zoom.',
  'design.6': 'Skip link to main content; logical focus order; status changes announced in a polite live region; dialogs trap and restore focus; tested with NVDA and VoiceOver.',
  'design.7': 'Clickable prototype tested with 5 customers; success = 4 of 5 submit a request unaided in under 3 minutes.',
  // Technology
  'technology.1': rows(
    ['TypeScript', '5.9', 'All application code', 'Adopt'],
    ['React', '19', 'Web interface', 'Adopt'],
    ['Fastify', '5', 'HTTP API', 'Adopt'],
    ['PostgreSQL', '17', 'Persistence and job queue', 'Adopt'],
    ['OpenTelemetry', '1.x', 'Tracing', 'Trial'],
  ),
  'technology.2': 'Node.js 24 LTS; PostgreSQL 17; dependencies updated monthly; critical security patches within 72 hours.',
  'technology.3': 'Allowed: MIT, Apache-2.0, BSD-3-Clause, ISC. Review: MPL-2.0, LGPL. Forbidden in distributed code: AGPL. Checked in CI.',
  'technology.4': rows(
    ['PostgreSQL', 'Relational integrity, team experience', 'Migrations for flexible timeline entries', 'Not chosen (ADR-002)'],
    ['PostgreSQL', 'JSONB for flexible timelines, transactions, one database to operate', 'Schema migrations to plan', 'Chosen'],
  ),
  'technology.5': 'react.dev (React 19), fastify.dev (v5), PostgreSQL 17 manual, internal “API error conventions” page.',
  'technology.6': 'pnpm workspaces, Prettier, ESLint, Vitest, Playwright; Claude Code and Copilot with repository instructions.',
  'technology.7': 'TypeScript end to end lets the team share validation schemas between the interface and the API; one language keeps a team of 3 productive.',
  'technology.8': 'Hosted AI providers may be used for drafting documentation only; never with customer request content.',
  // Conventions
  'conventions.1': 'camelCase variables, PascalCase components, kebab-case files; “request” (not ticket or case) everywhere; identifiers REQ-, UC-, ADR-, CMP-, RISK-, TEST-.',
  'conventions.2': 'apps/web, apps/api, packages/shared; unit tests beside code as *.test.ts; end-to-end tests in tests/e2e; specification in .plan/.',
  'conventions.3': 'Authorization and persistence only in apps/api; zod schemas in packages/shared; the web app never imports from apps/api.',
  'conventions.4': 'Prettier (100 columns, single quotes) and ESLint with typescript-eslint; CI fails on any warning.',
  'conventions.5': 'Throw HttpError with a status and a safe message; unexpected errors are logged server-side and return a generic message.',
  'conventions.6': 'Every pull request updates .plan/tasks.md and changes.md; architectural changes add an ADR.',
  'conventions.7': rows(
    ['Validate with the shared schema', 'Hand-written checks in routes', 'One source of truth for contracts'],
    ['Filter by organizationId in the data layer', 'Filter in the UI only', 'Prevents cross-tenant leaks'],
  ),
  // Testing
  'testing.1': 'Unit tests for domain rules (developers, < 30 s); API integration tests against PostgreSQL (< 3 min); 5 end-to-end journeys (QA lead).',
  'testing.2': 'State transitions, permission checks and validation; no mocks of our own domain code; 80% branch coverage for packages/shared.',
  'testing.3': 'API tests run against PostgreSQL in Docker (Testcontainers); responses validated against the OpenAPI document; email provider replaced by a contract stub.',
  'testing.4': 'Sign in → submit request → agent replies → customer sees reply (REQ-001, REQ-003, REQ-004); cross-organization access denied (REQ-002).',
  'testing.5': 'k6 load test at 2× expected peak before release; dependency and secret scanning in CI; external penetration test before general availability.',
  'testing.6': 'axe checks in every end-to-end test (no serious violations); manual NVDA pass on the three main journeys each release.',
  'testing.7': 'A seed script creates 3 organizations and 50 requests with synthetic names; each run uses a fresh database.',
  'testing.8': 'Merge: lint, typecheck, unit and integration tests, no high-severity vulnerabilities. Release: end-to-end suite green and product owner sign-off.',
  // Delivery
  'delivery.1': 'Local (Docker Compose, seed data); staging (production-like, synthetic data, team access); production (customer data, on-call access only).',
  'delivery.2': '.env.example lists every variable; secrets come from the vault; the API refuses to start without required settings.',
  'delivery.3': 'GitHub Actions: lint → tests → scans → image build → staging deploy → manual approval → rolling production deploy.',
  'delivery.4': 'Kubernetes manifests in the platform-infra repository, reviewed by Platform Engineering.',
  'delivery.5': '`docker compose up -d` starts the app, worker and PostgreSQL; data persists in a named volume; the app waits for a healthy database.',
  'delivery.6': 'Node.js 24 and pnpm on all platforms; PostgreSQL 17 via winget (Windows), Homebrew (macOS) or the official apt repository (Linux).',
  'delivery.7': 'Back up before migration; deploy to 10% then 100%; roll back to the previous image tag if the error rate exceeds 2% for 5 minutes.',
  // Operations
  'operations.1': 'SLI: share of API requests returning < 500 within 1 s. SLO: 99.5% over 28 days. No external SLA in release 1.',
  'operations.2': 'JSON logs with request IDs and redacted cookies; RED metrics per route; OpenTelemetry traces via OTLP; logs kept 30 days.',
  'operations.3': 'Page on-call when the 1-hour SLO burn rate exceeds 14×; business-hours rotation of 3 engineers; every alert links to a runbook.',
  'operations.4': 'SEV1: all customers affected — incident commander paged, status page within 15 minutes, blameless review within 5 business days.',
  'operations.5': 'Rotate the email API key; restore from backup; drain and restart the worker; revoke a compromised session.',
  'operations.6': 'Nightly backups plus point-in-time recovery; encrypted off-site copies; quarterly restore test into staging.',
  'operations.7': 'Region outage: RPO 15 minutes, RTO 4 hours using restored backups in a secondary region; tested yearly.',
  'operations.8': 'Monthly cost review with Finance; alert at 80% of the hosting budget; quarterly capacity forecast.',
  // Governance
  'governance.1': rows(
    ['Approve specification baseline', 'Tech lead', 'Customer Experience director', 'Security architect', 'Support Operations'],
    ['Release to production', 'Platform Engineering', 'Tech lead', 'Support Operations', 'Customers'],
    ['Operate on-call', 'Platform Engineering', 'Platform Engineering lead', 'Support Operations', 'Customer Experience'],
  ),
  'governance.2': 'Security section: security architect. Operations: platform lead. Baseline approval: Customer Experience director and tech lead.',
  'governance.3': 'Pilot (June 15): REQ-001 to REQ-004 and REQ-006; depends on the OIDC client. General availability (August 1): all requirements.',
  'governance.4': 'Email provider (SES or Postmark) — owner: tech lead — by week 2 — blocks REQ-005 only.',
  'governance.5': 'Read .plan/README.md and the conventions; run the Docker setup in under 30 minutes; first task tagged “good first issue”.',
  'governance.6': 'TASK-01 Request submission API (REQ-001, TEST-001). TASK-02 Organization isolation (REQ-002, TEST-002). TASK-03 Timeline and replies (REQ-003, REQ-004, TEST-003).',
  // Structured questions
  'architecture.9': rows(
    ['App shell and navigation', 'Layout, routing, sign-in state', 'Session from /auth/me', 'React 19'],
    ['Request list and detail pages', 'Find, filter and follow requests', 'Server state via query cache', 'React 19'],
    ['New request form', 'Capture issue and attachments', 'Local form state, autosave draft', 'React 19'],
  ),
  'architecture.10': rows(
    ['Request API', 'Validation, authorization, persistence', 'REST /api/v1 (OpenAPI 3.1)', 'Node.js 24, Fastify 5'],
    ['Notification worker', 'Send status emails with retries', 'Job queue in PostgreSQL', 'Node.js 24'],
  ),
  'data.10': JSON.stringify(['Synchronous REST over HTTP', 'Asynchronous message queue']),
  'data.11': JSON.stringify(['OpenAPI', 'JSON Schema']),
  'data.12': JSON.stringify(['JSON', 'CSV']),
  'security.11': JSON.stringify(['Session cookie (HttpOnly, Secure)', 'SameSite=Lax or Strict', 'CSRF protection', 'Preferences in local storage', 'No third-party cookies']),
  'security.12': 'yes',
  'security.13': 'yes',
  'security.14': JSON.stringify({ 'Personal data': 'Confidential', 'Credentials and secrets': 'Restricted', 'Payment data': 'Not handled', 'Business documents': 'Confidential', 'Logs and telemetry': 'Internal', Backups: 'Confidential' }),
  'quality.11': '99.9',
  'quality.12': '0.5',
  'delivery.9': JSON.stringify(['Kubernetes']),
  'delivery.10': JSON.stringify(['Microsoft Azure']),
  'delivery.11': 'GitHub Actions',
  'delivery.12': JSON.stringify(['Lint and format check', 'Type check / compile', 'Unit tests', 'Integration tests', 'End-to-end tests', 'Dependency scan', 'Secret scan', 'Build artifact / image', 'Deploy to staging', 'Manual approval', 'Deploy to production', 'Smoke tests']),
  'delivery.13': 'yes',
  'delivery.14': JSON.stringify(['Ubuntu LTS']),
  'delivery.15': JSON.stringify(['Terraform', 'Helm']),
  'delivery.16': 'Remote backend with locking (object storage)',
  'delivery.17': JSON.stringify(['Plan shown on every pull request', 'Approval required before apply', 'Apply only from the pipeline', 'Short-lived cloud credentials (OIDC federation)']),
  'delivery.18': 'yes',
  'delivery.19': JSON.stringify(['Checkov', 'Trivy (configuration scan)']),
  'governance.8': 'Proprietary (all rights reserved)',
  'governance.9': 'Hosted service (SaaS)',
  'governance.10': JSON.stringify(['Permissive (MIT, BSD, Apache-2.0, ISC)', 'Weak copyleft (LGPL, MPL, EPL)']),
  'governance.11': 'yes',
  'governance.12': 'Living specification (kept in sync, drift checked)',
  'governance.13': 'One specification per epic or release',
  'operations.11': 'no',
  'governance.7':
    'Always run pnpm lint and pnpm test before finishing; keep REQ/ADR identifiers; update .plan records. Never weaken organization isolation, never edit an approved baseline, and never guess an open decision — report it.',
};

const item = (id: string, type: Item['type'], title: string, extra: Partial<Item> = {}): Item => ({
  id,
  type,
  title,
  body: '',
  status: 'accepted',
  acceptance: '',
  owner: '',
  needsReview: false,
  ...extra,
});
const items: Item[] = [
  item('REQ-001', 'requirement', 'Customers submit a request with up to 5 attachments', {
    priority: 'must',
    acceptance: 'Given a signed-in customer, when they submit a valid request, then it receives an ID within 2 seconds.',
  }),
  item('REQ-002', 'requirement', 'Customers see only their organization’s requests', {
    priority: 'must',
    acceptance: 'Given a customer of organization A, when they request a record of organization B, then the API returns 404 and audits the attempt.',
  }),
  item('REQ-003', 'requirement', 'Customers see a timeline of status changes and replies', {
    priority: 'must',
    acceptance: 'Timeline shows a new reply within 5 seconds.',
  }),
  item('REQ-004', 'requirement', 'Agents reply to requests from a triage queue', {
    priority: 'must',
    acceptance: 'Given an agent, when they reply, then the customer sees it within 5 seconds.',
  }),
  item('REQ-005', 'requirement', 'Customers receive an email when a request changes status', {
    priority: 'should',
    acceptance: '99% of status emails are sent within 2 minutes.',
  }),
  item('REQ-006', 'requirement', 'All screens meet WCAG 2.2 AA', {
    priority: 'must',
    acceptance: 'No serious axe violations in 5 end-to-end journeys; manual NVDA pass.',
  }),
  item('UC-001', 'use-case', 'Submit a request'),
  item('UC-002', 'use-case', 'Follow a request'),
  item('UC-003', 'use-case', 'Triage and reply'),
  item('ADR-001', 'decision', 'Modular monolith for release 1', {
    body: 'Context: team of 3, one deployable preferred. Decision: single API service with modules. Consequences: coarse scaling; revisit if two modules need independent scaling.',
  }),
  item('ADR-002', 'decision', 'PostgreSQL for requests, object storage for attachments', {
    body: 'Context: flexible timeline entries and binary attachments. Decision: PostgreSQL 17 with JSONB timelines and a standby replica; attachments in S3-compatible object storage. Consequences: organization filter enforced in the data layer; schema migrations in the release pipeline.',
  }),
  item('ADR-003', 'decision', 'Durable notification jobs in PostgreSQL', {
    body: 'Context: email provider may be unavailable. Decision: leased jobs with retries in PostgreSQL (SELECT … FOR UPDATE SKIP LOCKED). Consequences: at-least-once delivery; consumers deduplicate.',
  }),
  item('CMP-001', 'component', 'Web app'),
  item('CMP-002', 'component', 'Request API'),
  item('CMP-003', 'component', 'Notification worker'),
  item('CMP-004', 'component', 'Request store'),
  item('RISK-001', 'risk', 'Low customer adoption', { body: 'Likelihood medium, impact high.' }),
  item('RISK-002', 'risk', 'Cross-organization data exposure', { body: 'Likelihood low, impact critical.' }),
  item('RISK-003', 'risk', 'Email provider outage delays notifications', { body: 'Likelihood medium, impact low.' }),
  item('TEST-001', 'test', 'API integration: submit request returns ID < 2 s'),
  item('TEST-002', 'test', 'API integration: cross-organization access returns 404 and is audited'),
  item('TEST-003', 'test', 'End-to-end: customer sees agent reply in timeline'),
  item('TEST-004', 'test', 'End-to-end: agent replies from triage queue'),
  item('TEST-005', 'test', 'Worker integration: status email queued and retried'),
  item('TEST-006', 'test', 'Accessibility: axe checks on all journeys'),
  item('TEST-007', 'test', 'Pilot usability study with 3 accounts'),
];
const pairs: [string, string, Link['kind']][] = [
  ['TEST-001', 'REQ-001', 'tests'],
  ['TEST-002', 'REQ-002', 'tests'],
  ['TEST-003', 'REQ-003', 'tests'],
  ['TEST-004', 'REQ-004', 'tests'],
  ['TEST-005', 'REQ-005', 'tests'],
  ['TEST-006', 'REQ-006', 'tests'],
  ['UC-001', 'REQ-001', 'satisfies'],
  ['UC-002', 'REQ-003', 'satisfies'],
  ['UC-003', 'REQ-004', 'satisfies'],
  ['CMP-002', 'REQ-001', 'implements'],
  ['CMP-002', 'REQ-002', 'implements'],
  ['CMP-001', 'REQ-003', 'implements'],
  ['CMP-001', 'REQ-006', 'implements'],
  ['CMP-003', 'REQ-005', 'implements'],
  ['ADR-001', 'CMP-002', 'decides'],
  ['ADR-002', 'CMP-004', 'decides'],
  ['ADR-003', 'CMP-003', 'decides'],
  ['CMP-002', 'CMP-004', 'depends-on'],
  ['TEST-007', 'RISK-001', 'mitigates'],
  ['TEST-002', 'RISK-002', 'mitigates'],
  ['ADR-003', 'RISK-003', 'mitigates'],
];

export function buildExampleSpec(id: string, _language: Language = 'en', stack: Spec['stack'] = []): Spec {
  const projectType = 'Web application';
  const spec = createSpec(id, 'Customer Request Portal', 'en', false, projectType);
  spec.description =
    'Example project: a self-service portal where business customers submit and follow service requests and support agents triage and reply. Every documentation module is filled in.';
  for (const section of spec.sections) {
    const module = modules.find((m) => m.id === section.id)!;
    for (const q of applicableQuestions(module, projectType))
      if (answers[q.id]) section.answers[q.id] = { value: answers[q.id], state: 'answered', reason: '' };
    section.markdown = renderSection(module, section, 'en', projectType);
    section.diagram = module.diagram;
    section.references = module.references.slice(0, 2).map((r, i) => ({
      id: `${section.id}-ref-${i + 1}`,
      title: r.title,
      url: r.url,
      kind: 'official' as const,
    }));
  }
  spec.stack = stack;
  spec.technologyIds = [...new Set(stack.map((e) => e.technologyId))];
  spec.items = structuredClone(items);
  spec.links = pairs.map(([from, to, kind], i) => ({ id: `LINK-${String(i + 1).padStart(3, '0')}`, from, to, kind }));
  return validateSpec(spec);
}
export const exampleAnswers = answers;
