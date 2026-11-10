# Change log

## 2026-11-10: Specification visualizer and MCP improvement workflow (TASK-175)

- Added a shared specification snapshot and visualizer to Overview and MCP Apps, with section progress, readiness findings, filters and paged recorded relationships.
- Added `show_specification`, the authenticated UI resource and `improve_specification`. Improvement requests enter the conversation; proposed content still needs human review. `propose_change` can reject a stale `baseRevision`.
- Preserved the destination repository's initial MIT license and history and documented setup at `antoinebou12/Spec-Driven-Helper`.
- Verification in progress. No hosted deployment or live assistant connection has been established.

## 2026-09-27 — CHG-001 Foundation (TASK-001–003, TASK-006–007)

- Added pnpm workspace, TypeScript, Vite, lint/format/test configuration.
- Added 14 bilingual modules, shared schemas, revision-safe domain operations, readiness and section merge logic.
- Added MongoDB/security utilities, AI provider adapters and initial export serializers.
- Verification: pending dependency installation and first typecheck.

## 2026-09-27 — CHG-002 Implementation records (TASK-013)

- Created .plan plan, tasks, backlog, designs and change log at the user's request.
- Requested the netlift repository reference; no match assumed.
- Verification: files created; alignment with reference pending.

## 2026-09-27 — CHG-003 API and persistence (TASK-004, TASK-006–008)

- Added session authentication, invitation acceptance, OIDC with PKCE and verified-email invitation requirements, project roles and audit records.
- Added revision-safe edits, proposal review, imports/exports, catalog, readiness-gated baselines, section reviews and AI job endpoints.
- Added GridFS upload support and server-side encrypted provider configuration.
- Verification: pending typecheck and integration tests; job execution and Git implementation are next.

## 2026-09-27 — CHG-004 Jobs and Git review (TASK-007, TASK-009)

- Added leased MongoDB worker jobs, AG-UI events, cancellation checks, bounded retries and idempotent proposal generation.
- Added GitHub branch/PR publishing, Markdown import, section three-way comparison and explicit conflict resolution.
- Verification: pending; GitHub live calls require operator credentials. No remote repository has been modified.

## 2026-09-27 — CHG-005 Workspace UI (TASK-005, TASK-008)

- Added split interview/document workspace, bilingual navigation, question statuses, RACI-style table input, Monaco, Mermaid, references and history.
- Added project creation, login, exports/imports, technology radar/catalog and traceability editors.
- Added responsive navy/blue design, dark theme and accessible dialog primitives.
- Verification: first typecheck identified API typing issues and unfinished views; fixes in progress.

## 2026-09-27 — CHG-006 Review and runtime (TASK-004, TASK-007–012)

- Added proposal diffs, generated question renderer through OpenUI, job activity, section reviews and baseline readiness.
- Added provider/Git/team settings, local bootstrap, Docker Compose, seeded example and restricted Claude Agent runner service.
- Corrected initial API typing issues; TypeScript passed before adding runner and final views.
- Verification: live provider/SSO/Git credentials are not available; local MongoDB and browser verification next.

## 2026-09-27 — CHG-007 Verification and review invariants (TASK-006, TASK-012–013)

- Added domain tests and real-MongoDB API tests for authorization, optimistic concurrency, import proposals, encrypted credentials and immutable baselines.
- Added browser journeys and responsive screenshots. Added .plan plan/tasks/backlog/designs/changes to exported bundles.
- Fixed an asynchronous cookie helper that caused login to wait on an unsent response, and prevented edit/import paths from granting reviewed status.
- Verification: 10 domain tests passed. Remaining checks in progress.

## 2026-09-27 — CHG-008 Publishing and connector adapters (TASK-014–016)

- Added isolated PDF report renderer with blocked network requests, structured report chapters and Mermaid rendering; added publishing jobs, GridFS downloads and image approval.
- Added a versioned React/Fastify scaffold generated from approved baselines.
- Added GitLab, Linear, Jira, Notion, Confluence, Google Drive, Figma and restricted MCP resource adapters. External issue creation requires explicit confirmation.
- Added optional OpenTelemetry initialization. Provider credentials remain server-side.
- Verification: 18 domain/API tests and 2 browser journeys passed before this change; publishing and connector checks pending.

## 2026-09-27 — CHG-009 Specification core rebuild (TASK-002–010, TASK-017–018)

- Repaired a syntax error and expanded minified sources; verified the baseline before changes.
- Rewrote the template library (bilingual prompts, explanations, examples, references, diagrams, adaptivity by project type) keeping question IDs stable.
- Partial patches, traceability invalidation, conflict payloads for stale writes, provenance on revisions, Markdown answer blocks with implied-answer proposals.
- Git: generic remotes, merge base taken from the published revision (fixes unmerged-PR false reverts), field-level conflicts kept on proposals.
- Claude Agent runner: tool policy moved to a PreToolUse hook (pre-approved tools previously bypassed the path check); minimal environment; audited tool log.
- UI rebuilt: resizable workspace, autosave, conflict view, open questions, proposals, readiness and baselines, traceability, radar, publishing, settings; Monaco bundled locally; system fonts.
- Verification: 58 Vitest tests (domain, API, jobs/agent, Git with a local bare repository, isolation), 3 Playwright journeys with axe. Bugs found by journeys fixed: new-project payload, WCAG 2.2 target size, discarded conflicts resurrected by autosave, Monaco dropping keystrokes.

## 2026-09-27 — CHG-010 Scope extension recorded (TASK-020–055)

- Recorded the guided-start, brownfield import, delivery board, MCP, OpenAPI, Storybook, frontend tests, CI and documentation work as tasks.
## 2026-09-27 — Expanded scope and repository reconciliation

- Recorded all new hero/identity, PostgreSQL/vector search, dashboards, architecture canvas, Kroki/UML, document structure, guide, Helm, security/SBOM and performance requests in expanded-scope.md.
- User specified configurable `antoieobu12/uml-mcp`; public URL lookup returned 404, so configuration must not assume an unverified tool contract.
- Found newer modularized implementation and task records in the shared checkout. Preserve these changes and integrate against their current interfaces rather than overwrite them.

## 2026-09-27 — CHG-011 Delivery board, container, CI and agent docs (TASK-041, 042, 052, 054, 055, 068)

- Implementation board: `packages/shared/src/board.ts`, `apps/api/src/board.ts`, `apps/web/src/views/Board.tsx`.
  - Cards are created from the latest approved baseline. Regenerating keeps progress and marks removed items obsolete instead of deleting them.
  - Five columns with drag and drop, plus a "Move…" select as the keyboard alternative. Writes are revision-guarded.
  - `.plan/tasks.md` import (with preview) and export round-trip columns, sources and pull-request links.
  - Pull-request status is read on explicit request from GitHub, GitLab and Azure DevOps only (fixed hosts). The project's GitHub token is sent only to its own repository. Status suggests a column; it never moves cards.
- Navigation: board added after Readiness. Alt+1…9 and Alt+0 now follow the sidebar order; Codex's added Search entry had made the Alt+0 hint wrong.
- Docker: two-stage build, runtime as `node` with `tini`, `git` for import and publishing, pnpm usable offline, health check on `/api/health/live`, and a smaller build context. Built and smoke-tested against PostgreSQL (live, health and web all return 200).
- Fixed a startup race: the API and worker migrated a fresh PostgreSQL namespace at the same time (unique violation 23505). Migrations now hold an advisory lock, and a duplicate migration record is treated as already applied.
- Fixed a type error in `diagrams.ts` (stream iteration) that blocked `pnpm build`. Documented the three diagram routes in OpenAPI.
- Browser journeys updated:
  - navigation order and the first-run tour;
  - PostgreSQL namespace isolation (`sdd_test_e2e_*`) and teardown through the store;
  - a board journey: create from baseline, keyboard move, axe, `.plan` export, persistence.
- CI workflow; `docs/installation.md`, `docs/operations.md`; `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/skills/sdd-studio-maintenance`.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck and lint clean;
  - 87 Vitest tests in 10 files pass;
  - 3 Playwright journeys pass;
  - Docker image built and smoke-tested.
- Note: the local `.env` has no `DATABASE_URL`, so `pnpm dev` and `pnpm test` still fall back to MongoDB until it is added.

## 2026-09-27 — CHG-012 Feature flags, infrastructure as code, license rules and icons (TASK-043, 068–077)

- Feature flags (TASK-071), continued from an interrupted Claude session:
  - 18 flags in `packages/shared/src/feature-flags.ts`; the Administration panel keeps switches as a draft, saves only changed flags, and is audited as `features.updated`.
  - Closed the routes the route guard missed: AI import calls `queueAiJob` directly, so the check now lives there (including Claude Agent); the worker fails jobs queued before a feature was switched off; `/auth/options` hides Google and SSO when they are off.
  - The web client hides views, Alt shortcuts, tour steps, Ask AI buttons, generated forms, PR status, publishing sections, AI import methods, the Claude Agent provider and diagram services.
- Infrastructure as code (TASK-072): `iac` layer and category, 12 new catalog tools, migration 006, import rules (`iacFindings`), delivery.15–19 and two stack rules.
- License rules (TASK-073): `packages/shared/src/licenses.ts`, governance.8–11, `LicenseCheck` panel on the Stack view, LICENSE detection in import, and `scripts/check-licenses.ts` in CI.
  - The dependency check found that SPDX expressions in parentheses, such as `(MIT OR GPL-3.0-or-later)`, were misclassified. Fixed and covered by tests. `Public domain` and `OFL-1.1` are classified too.
- Icons (TASK-074): `layerIcons` and `featureIcons` in `apps/web/src/icons.ts`; brand icons for OpenTofu, Pulumi and Ansible; an IaC category icon.
- Recorded earlier untracked work as TASK-075–077 (split images, metrics, design document). Marked TASK-043 (MCP server) done; it has not been tried with a live client (backlog).
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck clean; lint has no errors (21 existing hook-dependency warnings);
  - 131 Vitest tests in 17 files pass, including the new `licenses-iac` and `migrations` tests;
  - 12 component tests pass;
  - 3 Playwright journeys pass;
  - axe (WCAG 2.2 AA) finds no violations in the feature-flag and license-check stories, light and dark;
  - `pnpm licenses:check` passes.
  - Not done: exercising the admin panel and the Stack license panel in a running app. The format check stays advisory (TASK-052); only new files were formatted.

## 2026-09-27 — CHG-013 Tests across every type, secret-file fix (TASK-071–074, TASK-078)

- Security:
  - AI runs that include the repository, and Claude Agent runs, received every text file of the snapshot. `safeFiles` ran only on the rule-based import path.
  - `git.ts` now skips secret-looking files and IaC caches when it reads archives and cloned trees, so no caller can receive them.
  - The secret list gained Terraform state and variables, CLI credentials and kubeconfig.
- Accessibility: the new Storybook sweep found an unnamed `<select>` in the choice-answer story. `AnswerControl` now names choice and text answers through `${id}-label`, as it already did for tables.
- UI: `BUSL-1.1` no longer wraps in the license list.
- Improvements:
  - AI import excerpts include `.tf`, `.bicep`, Chart, Pulumi, CDK, Kustomize and LICENSE files;
  - `featureIcons` is typed by feature id;
  - shared Playwright helpers (`tests/e2e/helpers.ts`).
- New checks: `pnpm test:stories` (CI e2e job), `tests/e2e/governance.spec.ts` and `tests/observability.test.ts` (closes TASK-076). The new domain, isolation, API and component tests are listed under TASK-078.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck clean; lint has no errors (21 existing warnings);
  - 146 Vitest tests in 18 files pass;
  - 17 component tests pass;
  - 5 Playwright journeys pass;
  - 21 stories × 3 variants pass axe.
- TASK-071 and TASK-074 are now verified in the running app.

## 2026-09-27 — CHG-014 Architecture rules, local CI, exports, Spec Kit concepts, catalog, conventions, coverage (TASK-075, 079–087)

- Architecture (TASK-079): ArchUnitTS rules for the web client, API, shared package, publisher and agent runner in `tests/archunit.test.ts`. Removing type-level import cycles moved `Auth` to `apps/api/src/auth-types.ts` and the library authoring types to `packages/shared/src/template-types.ts`. `pnpm arch:graph` draws the dependency graph.
- Local CI (TASK-080): `pnpm ci:local` runs the GitHub Actions jobs in Docker with act; guide in `docs/ci-local.md`, linked from `docs/installation.md`.
  - Running the workflow this way found two bugs: a step `if` that read `secrets` (invalid on GitHub too), and the PostgreSQL service hostname, which does not resolve for a job container on the host network. `vars.ACT_POSTGRES_PORT` now fixes the service port under act.
  - It also found that the agent-runner policy allowed `C:\Windows\System32` when the tests ran on Linux. The policy now denies drive-letter, UNC and home paths on every platform.
- Catalog (TASK-081): categories `search`, `storage`, `networking`, `identity` and `development`, a `development` stack layer, AWS and Azure services, search engines and development tools; migration 007.
- Conventions (TASK-082): naming and folder layouts for TypeScript, Python, C#, C++, Java, Go and Rust (`conventions.ts`), stack suggestions, the `ConventionsGuide` card with a case converter, and `.plan/conventions.md` in the implementation bundle.
- Exports (TASK-083): one Markdown parser in `document-render.ts` feeds a real LaTeX document (chapters, table of contents, `longtable` tables, lists, verbatim, links) and a print-ready HTML document. New formats: `html`, `svg` (overview image), `pdf` (direct, through the isolated publisher, `reports` flag) and `speckit`. The Publishing view previews the image and converts it to PNG in the browser; Mermaid diagrams have an SVG download.
  - Security: rendered HTML and SVG are sent with `default-src 'none'`; only http(s) and mailto links survive; `\end{verbatim}` cannot break out of a code block.
- Spec Kit concepts (TASK-084): the spec-driven workflow card on the Overview (nine phases from constitution to converge, status computed from the specification, each phase opens its view), governance.12 persistence model, governance.13 spec of specs, the Spec Kit export with `specs/roadmap.md`, and read-only / read-write badges on feature flags.
- Coverage (TASK-085): `pnpm test:coverage` and `pnpm test:coverage:web` with thresholds as floors; CI runs both and uploads the reports.
- Code health (TASK-086): the 21 hook-dependency warnings are fixed with `useLatest` and `useCallback` (no rule disabled); `pnpm lint` fails on warnings.
- Journeys and stories (TASK-087, TASK-075): the repository import journey, the nginx web image smoke test (`pnpm smoke:web`, in the CI `docker` job), and stories for full views and the new components.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck clean; lint clean with `--max-warnings 0`;
  - backend: 21 files, 193 tests pass, coverage 88.6% statements, 80.9% branches, 92.2% functions;
  - web: 33 component tests pass, coverage 55.9% statements, 78.6% branches;
  - 7 Playwright journeys pass;
  - the Storybook axe sweep passes for every story, including the new ones;
  - `pnpm smoke:web` passes; `act push -j checks` succeeds (the format check stays advisory, TASK-052).
  - Not done: a run on GitHub Actions, and a PDF produced through a running publisher (done in CHG-015).

## 2026-09-27 — CHG-015 Real Ollama, Compose, SSO sign-in and sign-up, README and docs, PDF publisher (TASK-088–093)

- Ollama (TASK-088): runs ask for the model's real context window (`num_ctx`, from `/api/show`) instead of Ollama's silent default. When the specification does not fit, a compact context covers only the sections the request names (by title, one title word such as "Operations", or a question id), or else the sections with the most open questions. The model answers in a small, grammar-checked format that becomes a normal proposal. Echoed answers, unknown question ids and answers that would replace a recorded answer with "unknown" are dropped and counted in the run activity. Admins get a connection check (`GET /api/v1/integrations/ollama/status`, Administration → Local AI) and `pnpm ollama:check` runs a live proposal and an embedding test.
  - Live results with Ollama 0.33.3 on this machine: `gemma2:2b` (8,192-token window) produces valid proposals in compact mode in 40–70 s through the containerised worker; `nomic-embed-text` returns 768-dimension vectors. The 2B model mostly answers "unknown"; a 7–8B model is recommended (backlog).
  - Before the cleaning step, a live proposal would have replaced recorded answers with empty "unknown" values if accepted.
- Compose (TASK-089): hardened app and worker (read-only root, tmpfs, no capabilities, `no-new-privileges`), rotated logs, health checks, Ollama on the Docker host by default, profiles `ollama`, `pdf` and `legacy-migration`, and `compose.split.yaml` / `compose.gpu.yaml`.
- SSO (TASK-090): one set of account rules for company SSO and Google. Security fixes: Google sign-up created active accounts without an administrator, company SSO ignored the registration setting, and a disabled SSO user could fall into account re-creation. SSO failures now return to the sign-in page with a readable message.
- Sign-in and sign-up (TASK-091): new `views/Login.tsx` with the hero, tabs, SSO buttons on both tabs, invitation acceptance and outcome messages.
- Documentation (TASK-092): root `README.md` with hero banner and badges, `docs/README.md` with screenshots, installation guide for profiles, Ollama and SSO, documented `.env.example`. Empty `OLLAMA_*` values in `.env` now fall back to defaults, and search embeddings use the same Ollama URL helper.
- PDF publisher (TASK-093): markers, labels and empty references fixed in the report; the publisher image no longer downloads pnpm at start.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck clean; lint clean with `--max-warnings 0`;
  - backend: 23 files, 220 tests pass;
  - web: 42 component tests pass, coverage 60.7% statements, 83.1% branches (the sign-in view is now included);
  - 7 Playwright journeys pass against the new sign-in page;
  - the Storybook axe sweep passes: 39 stories in light, dark and French;
  - live: `pnpm ollama:check`, a containerised Ollama job, and a PDF through `docker compose --profile pdf`.
  - Not done: SSO against a live Google or OIDC provider, a run on GitHub Actions, the `ollama` container profile (the host Ollama was used), and the split and GPU variants beyond `docker compose config`.

## 2026-09-27 — CHG-016 Observability: Prometheus, Grafana, Netdata and the admin panel (TASK-094, TASK-061)

- `compose.observability.yaml` overlay:
  - Prometheus scrapes `/api/metrics` with `METRICS_TOKEN` (mounted as a Compose secret, never in the config file) and Netdata. It evaluates five alert rules: API down, 5xx rate above 5 %, p95 above 2.5 s, failing jobs, queued jobs.
  - Grafana is provisioned with a Prometheus datasource and the SDD Studio dashboard (12 panels), generated from code by `pnpm grafana:dashboard`. Sign-up, anonymous access and telemetry are off.
  - Netdata provides host and container resources.
  - All UIs bind to 127.0.0.1.
- API: `metricsSummary()` in `observability.ts` (totals, error rate, latency quantiles from histogram buckets, busiest routes, process memory); `GET /api/v1/admin/observability` (workspace admins) adds database round trip, jobs by status, recent failures, pending proposals, tracing state and links to the tools. Only http(s) URLs are linked.
- Web: `ObservabilityPanel` on the Administration page (stat tiles, jobs, busiest routes, tool links, 30 s refresh), with a story and component tests.
- Docs: operations guide section, `.env.example` variables, AGENTS.md feature map.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck and lint clean;
  - new API and component tests pass, with OpenAPI, architecture and ArchUnit tests;
  - live: an isolated Compose project with all three scrape targets up, alert rules healthy, the Grafana dashboard and datasource loaded, and `/api/metrics` returning 403 without the token. The project was removed afterwards.
- Not done: user and read-only Viewer dashboards (rest of TASK-061), and alert delivery (Alertmanager is not included).

## 2026-09-28 — CHG-017 UX review with a screenshot tour (TASK-095)

- New journey `tests/e2e/ux-tour.spec.ts`:
  - visits the 12 views of the example project on desktop (1440 px) and phone (390 px);
  - saves full-page screenshots to `test-results/ux/`;
  - checks horizontal scrolling, off-screen controls (except inside scrollable tables), targets under 24 px (labels count for checkboxes), error banners and console errors.
- Fixed what it found:
  - Phone navigation: 10 of 12 views were hidden in a horizontal strip with no hint. They are now a 3-column grid of icon tiles, and the project picker has its own full-width row.
  - License check rows: names overlapped the licence code (`MongoDBSSPL-1.0`); names now truncate with an ellipsis.
  - Board: the filter icon sat above the field (the global `label` layout); the title repeated as a second heading; the empty state now explains where cards come from and offers "Go to Readiness & baselines".
  - Checkboxes: 18 px, and `.check-label` is at least 24 × 24 px (WCAG 2.5.8); the catalog LTS checkbox is wrapped in a label.
  - Readiness: the section-review table overflowed the phone screen; it now scrolls inside its card.
- Remaining suggestions are in `backlog.md`.
- Verification:
  - typecheck and lint clean;
  - 44 component tests pass;
  - 9 Playwright journeys pass (including both UX tours);
  - Storybook axe: 41 stories × 3 variants pass.

## 2026-09-28 — CHG-018 `.plan` round trip, screenshot tools, coverage, phone navigation (TASK-096–098)

- `.plan` folder (TASK-096):
  - **Export:** `GET /api/v1/projects/:id/plan-folder` zips everything under `.plan/`. The board adds `tasks.md` (work), `board-backlog.md` (backlog column) and a lossless `board.json`; the manifest has a SHA-256 per file.
  - **Import:** `POST …/plan-folder/import` takes a folder or zip (paths normalised to `.plan/`, traversal refused, 400 files and 12 MB at most).
    - `specification.json`, or else `spec/NN-<id>.md`, becomes a pending proposal.
    - `board.json`, or else `tasks.md` plus `board-backlog.md` and `backlog.md`, merges into the board under its revision guard, after a preview.
    - Backlog bullets get stable ids (`BL-xxxxxx`), so re-importing does not duplicate them. Generated readiness lists are not treated as work.
    - Gated by the `import` flag.
  - UI: a ".plan folder" card on Publish & handoff with folder or zip selection and a preview. Zip files are recognised by content, not by name.
  - Tested against this repository's own `.plan/`.
- Screenshot tools (TASK-097):
  - `scripts/ux/image_tools.py` (OpenCV 5, Pillow 12): crop, zoom, find an element by template, contact sheet, visual diff with a heatmap and changed regions, and a blank-capture check.
  - `pnpm ux:review` runs the tour, then builds contact sheets and zooms.
  - The tools run from a project `.venv` (`pnpm ux:setup`); 10 unit tests; a CI job `image-tools`.
- UX found with the contact sheets:
  - On phones the view grid filled the first screen. Views now sit behind a "Views: <current>" toggle that closes after a choice.
  - Hover highlights stuck after taps; they are now limited to devices that hover.
  - The header grid rows stretched on short pages.
- Coverage (TASK-098):
  - backend lines 89.4 % → 92.5 %: connectors 26 → 84 %, scaffolding 2 → 100 %, publishing 28 → 58 %, diagrams 35 → 72 %;
  - web lines 61.8 % → 77.3 %;
  - thresholds raised (backend 90/80/92/90, web 72/78/65/72).
- Found by the full journey run: all journeys share 127.0.0.1, so the fixed 300 requests/minute limit throttled the second session of the conflict journey. `RATE_LIMIT_MAX` (default 300) is now configurable; the test stack uses 5000.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck and lint clean;
  - backend 240 tests and web 56 tests pass, both with the raised coverage thresholds;
  - 10 Playwright journeys pass;
  - Storybook axe: 43 stories × 3 variants pass;
  - Python image tools: 10 tests pass;
  - `act -l` lists the new CI job.

## 2026-09-28 — CHG-019 Fixtures, Lighthouse, axe on every view, testing guide (TASK-099–101, TASK-069)

- Fixtures (TASK-099):
  - `pnpm fixtures` writes `fixtures/default-project/.plan/` and `fixtures/sdd-studio/.plan/` plus a zip of each, with pinned ids, dates and zip timestamps, so output is byte-stable.
  - The SDD Studio fixture is this repository analysed by the import rules (24 findings, 15 stack entries), with 102 board cards from `.plan/tasks.md` and `.plan/backlog.md`.
  - `planFolderFiles` moved to the pure `api/exports.ts` so scripts run without a database.
  - Found and fixed: with `board.json`, the Markdown copies of the board were reported as "not imported".
  - Tests: fixtures are current; folder equals zip; the bundle is valid; both import through the API; accepting the imported default project reproduces the example's answers.
- Lighthouse (TASK-100, completes TASK-069): `pnpm lighthouse` starts the production build, drives Chrome with Playwright, signs in and audits four pages.
  - This avoids the Lighthouse launcher's temp-folder failure on Windows and reaches signed-in pages.
  - Budgets: performance ≥ 85, accessibility ≥ 95, best practices ≥ 90, SEO ≥ 80, LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 300 ms. Reports go to `lighthouse-report/` (a CI artifact).
  - Results: performance 96–97, accessibility 100 after fixing the References heading (h4 → h3), LCP ≤ 1.2 s, CLS ≤ 0.023.
  - `lighthouserc.json` stays as the lhci alternative (port 3151).
- Accessibility (TASK-101): the UX tour now runs axe on all 12 views on desktop and phone. Found and fixed:
  - the selected filter chip's count failed contrast;
  - scrollable tables (conventions, Ollama models, section reviews) were not keyboard reachable; they are now focusable, named regions with a focus ring.
- Coverage: `state.ts` (project hook: serialised saves, conflicts, polling, persistence) is now tested; web lines 77.3 % → 82.7 %; web floors raised to 80/80/68/80.
- Docs: `docs/testing.md`, the guide to every test layer, coverage floors, the four accessibility checks, fixtures and where new tests go; `fixtures/README.md`; links from README, AGENTS.md and the maintenance skill.
- CI: `fixtures:check` in `checks`; Lighthouse after the journeys in `e2e`.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck and lint clean;
  - backend 247 and web 65 tests pass above their coverage floors (backend 92.5 % lines, web 82.7 %);
  - 10 Playwright journeys pass, including axe on every view;
  - Storybook axe: 43 stories × 3 variants;
  - Lighthouse budgets met;
  - fixtures current.

## 2026-09-28 — CHG-020 AI optimisation (AIO) and the MCP quality gate (TASK-102, TASK-103)

- AIO (`packages/shared/src/aio.ts`, `api/aio.ts`, `aioHtml` in `vite.config.ts`, nginx location):
  - Public files: `/llms.txt`, `/llms-full.txt` (features, 14 modules, FAQ, and the MCP tools read from the running server), `/robots.txt`, `/sitemap.xml`.
  - In `index.html`: Open Graph, JSON-LD (SoftwareApplication, WebSite, FAQPage) and a `<noscript>` summary for crawlers that do not run JavaScript.
  - Claims come only from `features.ts`, `feature-flags.ts` and a bilingual FAQ of facts. Links use `APP_ORIGIN`; `AIO_ALLOW_AI_CRAWLERS=false` blocks AI crawlers.
  - The four files are public routes in OpenAPI and in the architecture security sweep.
- AIO testing:
  - `tests/aio.test.ts` (13): llmstxt.org format, robots rules and blocking, sitemap, schema.org graph, JSON-LD that cannot break out of its tag, the noscript content, claims matching features, bilingual FAQ without superlatives, public routes, every MCP tool listed, no project data in public files.
  - `tests/e2e/aio.spec.ts`: files served through the web server; the page read with JavaScript off.
  - `pnpm smoke:web`: nginx forwards the files; the shell carries JSON-LD.
  - Lighthouse SEO 91 → 100 on all audited pages.
- MCP (`api/mcp.ts`):
  - Every tool declares an output schema and returns structured content, with the same JSON as text.
  - Descriptions start with when to use the tool, and every input is described.
  - Lists page with `limit` and `offset` (50 by default, 200 at most); Markdown is capped at 20 000 characters.
  - Server instructions describe the workflow. Prompts `implement_next_task` and `close_readiness_gaps`; resource `sdd://project/tasks.md`.
  - `mcpToolCatalog()` lists the tools through the protocol, in memory.
- MCP quality gate (`tests/mcp-quality.test.ts`): 12 rules, black-box over HTTP against the SDD Studio fixture (naming, metadata, described inputs, hints, output schemas, untrusted-content notice, readable errors, size, speed, context budget, guidance, safety). It found that the default `get_board` returned 46 000 characters (≈ 11 500 tokens); the default page size was halved (now 21 000).
- Docs: `docs/ai-readiness.md`; testing guide rows; AGENTS.md feature map and "adding an MCP tool or a public claim"; README; `.env.example`.
- Verification with `DATABASE_URL` on local PostgreSQL:
  - typecheck and lint clean;
  - backend 267 tests (92.7 % lines) and web 65 tests pass above their floors;
  - 11 Playwright journeys pass;
  - Storybook axe: 43 stories;
  - Lighthouse: all budgets met, accessibility 100, SEO 100;
  - `pnpm smoke:web` passes; fixtures regenerated and current.

## 2026-09-28 — CHG-021 PRODUCT.md and DESIGN.md, TOON import, use cases, icon rail, docs website, backend performance (TASK-104–110)

- `PRODUCT.md` (problem, vision, users, goals, non-goals, requirements, success measures) and `DESIGN.md` (Google design-document sections plus the visual design system for UI agents) at the root. `agent-docs.ts` generates both for every project bundle.
- TOON:
  - `parseBundleText` reads JSON or TOON; `POST /projects/:id/import` accepts `{ toon }`.
  - `.plan/specification.toon` is exported, and read when the JSON is absent. Publishing imports `.json` and `.toon`.
  - Tests: both fixtures import identically from JSON and TOON; a live TOON export re-imports without loss; broken files give readable errors.
- Use cases: a structured template (actor, trigger, preconditions, main flow, alternates, outcome) stored as Markdown, review hints, and conversion of older free text; stories and tests.
- Sidebar: a 64 px icon rail when collapsed (accessible labels, tooltips). It folds itself between 761 and 1100 px. The UX tour now also runs at tablet width, where it caught rail buttons under 24 px (fixed).
- Documentation website (`pnpm docs:site`):
  - 13 pages from the repository Markdown, with navigation, search, table of contents, light and dark themes, the Markdown copies and an `llms.txt`.
  - Served at `/docs/` by the API and by the nginx image; a GitHub Pages workflow publishes it; a "Documentation" button sits in the top bar.
  - The link checker fails the build on broken links, anchors or images.
  - Found and fixed: README banner HTML appeared as text, and the index page had no H1.
- Backend performance:
  - `pnpm perf` runs 8 scenarios with budgets on the SDD Studio fixture (for example, spec read p95 21 ms at ~490 req/s; autosave p95 50 ms; MCP `get_board` p95 52 ms), with 0 % errors; it runs in CI.
  - `tests/performance.test.ts` sets hot-path budgets, including a linear-scaling check.
  - Found: the MCP route limit (120/min) throttles load tests; `MCP_RATE_LIMIT_MAX` is now configurable.
- `docs/testing.md` lists the 15 test types with commands and CI jobs. The tour covers the board, the handoff formats and the documentation.
- Backlog: 12 new ideas.

## 2026-09-28 — CHG-022 Rich controls, security checklist, skill and agent exports, glossary, Helm, dashboards (TASK-061, 062, 067, 068, 070)

- Questions:
  - New `slider` kind (bounded number with step and unit): quality.11 availability target, quality.12 p95 response time.
  - New `matrix` kind (one choice per row): security.14 data classification.
  - Both round-trip through the managed Markdown in English and French (a decimal comma is read too).
  - Controls: a range input with a number field; an accessible radio grid.
- The complete example now answers every question; 11 questions added earlier (IaC, licences, Spec Kit) had no answer. A test fails when a new question has no example answer.
- Security completeness checklist: 15 areas from OWASP ASVS and NIST SSDF mapped to questions (met, partial, missing or not applicable), shown on Readiness with links to the missing questions and exported as `.plan/security-checklist.md`.
- Exports:
  - `/export/skill`: a standalone Claude skill (`<project>-spec/SKILL.md` with progressive-disclosure references).
  - `/export/agents`: AGENTS.md, CLAUDE.md, GEMINI.md, Copilot instructions, a Cursor rule, PRODUCT.md and DESIGN.md.
  - Found and fixed: generated AGENTS.md, CLAUDE.md, Copilot files and the skill had mojibake (`â€”`) in headings; a test now rejects mojibake in every generated file.
- Glossary (`docs/glossary.md`) in the docs website and its search.
- Helm chart:
  - Contents: API and worker Deployments, Service, Ingress, Secret with required-value guards, PDB, NetworkPolicy, ServiceMonitor and a `helm test` pod; hardened pods.
  - `pnpm helm:check`: lint, template, kubeconform (8 valid, 0 invalid) and the guards.
  - `pnpm k8s:test`: k3s in Docker, image loaded, PostgreSQL in the cluster, `helm install`, `helm test`, then sign-in, project creation, docs and llms.txt through the Service. Both run in CI.
  - The first run found that the all-in-one image no longer built (the docs link check needs `.plan/`, which the build context excludes); the Docker build now warns instead.
- Dashboard:
  - `GET /api/v1/dashboard` and a Dashboard view (sidebar, next to Settings) with progress per project (completeness, required answers, security coverage, board, baseline) and "Waiting for you" by role; read-only for Viewers.
  - Found and fixed: duplicate button names for different actions, and progress bars collapsing to zero height inside cards.

# 2026-09-28 — CHG-023 Local Docker origins and image layout

- Added an explicit `APP_ALLOWED_ORIGINS` list for local browser origins while retaining `APP_ORIGIN` as the canonical callback and cookie origin.
- Compose allows the Vite URL (`http://localhost:5173`) and both local app URLs (`http://localhost:3001`, `http://127.0.0.1:3001`).
- Moved the all-in-one Dockerfile into `docker/local.Dockerfile` and updated Compose, build instructions and the API origin guard test.
- Verification: API suite passed (20 tests); all three allowed login origins reached credential validation, the foreign-origin test remains rejected, `docker compose config --quiet` passed, and the rebuilt app container is healthy at both hostnames. Vite on `http://localhost:5173` is running and its proxied login request also reached credential validation.

## 2026-09-28 — CHG-024 PostgreSQL-only runtime and CI verification (TASK-052, TASK-063)

- Removed stale MongoDB migration instructions and clarified PostgreSQL-only application persistence; MongoDB remains only as a target technology in the project catalog.
- Documented PostgreSQL JSONB persistence, pgvector semantic search and permission-filtered full-text section search in the feature map and task scope.
- Updated CI to use `docker/local.Dockerfile` and fixed the Trivy action tag reference; removed an unused PostgreSQL import exposed by lint.
- Verification: fixture check, lint, typecheck, backend/API/integration and frontend coverage, production build and Storybook build passed in the local Docker/act `checks` job. Format check remains advisory with existing Helm-template parsing warnings. GitHub-hosted CI has not been run.

## 2026-09-28 — CHG-025 Product follow-up planning (TASK-111–125)

- Added separately scoped, unstarted tasks from the supplied UI screenshots and request: project/page simplification, bulk workflows, settings and feature-flag navigation, import, Storybook discovery, inline AI, SMTP/2FA, organization/team/project RBAC, Ollama reliability, Admin observability, Compose/analytics configuration, Teams, agent skills and architecture/deployment docs.
- Recorded guardrails and dependencies: proposal-only AI, revision/RBAC checks, authenticated Grafana, no default AWS stack, and OLAP selection deferred pending requirements.
- Updated task status for local act checks and PostgreSQL search; GitHub Actions remains unverified. MongoDB instrumentation found in the generic OpenTelemetry bundle is not a database driver or supported application storage path.

## 2026-09-28 — CHG-026 Overview, import dialog and integration settings (TASK-111, TASK-113, TASK-114)

- Simplified Overview into unframed sections with a smaller progress indicator and collapsed score, workflow and history details. Next steps omit disabled features.
- Moved repository/document import from the sidebar to an Overview dialog; existing import routes open the same flow. Findings and proposal review remain intact, and Viewers/disabled imports cannot open it.
- Moved coding-agent MCP access and connectors from Publishing into Settings > Integrations. Each feature remains separately gated, and disabling the selected tab falls back to Project.
- Updated keyboard journey expectations for the shorter navigation and the architecture reachability check for lazy embedded views. Added component tests, a Settings story, and a desktop/phone browser journey.
- Fixed the standalone Storybook axe runner's collision with the addon's automatic scan by selecting manual addon scanning for that runner only; the addon remains in error mode.
- Verification: 319 backend tests, 77 frontend tests (73 existing plus four new tests rerun after fixing their setup), typecheck, lint, fixture check, Storybook build and 54 stories across light/dark/French passed. Eight affected browser journeys passed across the final runs (import, navigation, workspace and governance), including axe and desktop/phone screenshots. The local docs build has zero link problems. Docker image rebuilt, app/worker recreated and healthy at port 3001. Docker still reports the existing Monaco chunk warning and five .plan documentation links absent from its excluded build context.

## 2026-09-28 — CHG-027 Review comments: exports, readiness, navigation, search, user guide (TASK-111, TASK-113)

- Publish & handoff: the 11 export formats are grouped as "For coding agents", "Documents to read and share" and "Data and backups".
- Readiness: a "Next step" line, blockers grouped by kind in collapsible groups with Fix links (question, traceability or proposals), and warnings folded away as not blocking.
- Retired the radar/ring board and the Open Questions page (Codex, finished here): removed their leftover CSS; old links redirect.
- Collapsible specification outline and the top-bar search dialog (Codex).
- New `docs/user-guide.md` (every page from an empty project to a published baseline), linked from the docs map and the docs website.
- Fixed two stale component tests (dashboard action now opens Specification; the catalog flag no longer hides a view).
- Verification: typecheck, lint, 77 frontend tests, docs-site test and link check (15 pages, 0 problems), Storybook axe on 53 stories × 3 variants; Docker Compose stack rebuilt. Not checked in a signed-in browser session.

## 2026-09-28 — CHG-028 Build with AI: conversational builder over AG-UI and CopilotKit (TASK-126, TASK-116, TASK-119)

- New default project page, Build with AI: a conversation on the left and the document on the right, so the document is built without moving between pages. The other pages stay for detailed work.
- API: `POST /api/v1/projects/:id/agent` is an AG-UI agent (server-sent events) that CopilotKit reaches directly as a self-managed agent, behind the usual session, role (Editor and above), feature flag, local-only rule, rate limit and token budget. Conversation turns count toward the monthly token budget, not the daily run limit, and are hidden from AI runs.
- The model streams its reply (OpenAI, Anthropic, Ollama), asks through interactive cards the browser renders (choice, multiple choice, slider, free text, stack picker) and records confirmed facts with `propose_changes`, which only creates a pending proposal after validating the patch against the current revision. The proposal card in the chat accepts, rejects or opens it.
- Local models: replies stream; the model is warmed up when the page opens; embedding models are hidden; models without tool calling get a structured-output pass (`local-extract.ts`) that maps what the user stated to open questions (at most 15, focused section first), recovers cut-off JSON and ignores blanks and repeats. Verified with gemma2:2b on CPU: about 20 s per extraction, after the reply has streamed.
- Live document: section cards with animated progress rings, a light 3D tilt, a glow on answers that changed, in-place editing of simple answers (focus moves into the editor) and Ask on every question. Motion follows prefers-reduced-motion.
- The conversation is kept per project in the browser; New conversation starts over. CopilotKit's inspector, the attachment menu and its telemetry-capable cloud features are off; its theme maps to the app's light and dark tokens.
- Dependencies: `@copilotkit/react-core` 1.75 (MIT) and `motion` 13 (MIT). CopilotKit 1.75 is newer than the lockfile's minimum release age and was excluded from that check by pnpm; `@scarf/scarf` install analytics are not allowed to run.
- Found and fixed while testing in the browser: a crash when no model was stored yet, stale Vite transforms on OneDrive, a page scroll of 12 px, unnamed icon buttons, merged accessible names, a stale proposal count and decided proposals offering Accept again after a reload.
- Verification: typecheck, lint, 13 builder agent tests with a fake streaming Ollama, OpenAPI and feature-flag tests, 86 component tests, and the full loop in the browser with a real local model (message, streamed reply, proposal card, accept, document update, inline edit, light and dark themes).

## 2026-09-29 - CHG-029 Annotated UI review completion (TASK-128 through TASK-135)

- Added eight explicit tasks and `browser-review.md` with per-comment acceptance criteria; linked the broader requests to their existing TASK-111 through TASK-125 records rather than marking them complete.
- Replaced export format cards with a grouped selector and explicit Download action. Search now has compact typed/localized results, useful loading/error/empty states and a folded semantic-index action for editors.
- Fixed outline collapse layout: remove unused grid tracks, preserve remembered visibility, and keep both desktop panels and narrow-screen tabs usable. Overview Sections stays keyboard-collapsible.
- Readiness folds repetitive section blockers by default and links each to its focusable review row, without approving it or bypassing permissions. Removed redundant explanatory copy; the guide carries it.
- Corrected stale radar product/agent claims, preserved catalog/stack compatibility, and verified legacy catalog/questions/search bookmarks. Added the Administration and access guide with actual role capabilities (Reviewer cannot edit answers), origin-error troubleshooting, feature flags and clear boundaries for planned features.
- Expanded browser and component regression coverage. Updated journeys for the new default Builder page and shorter shortcut order. Alternate E2E ports are configurable, so checks do not terminate another local server. Storybook axe uses reduced motion to avoid sampling transient animation opacity.
- Expanded plan fixtures exposed an MCP export size-budget defect: preview capped at 24,000 characters, truncation explicitly directs agents to the complete resource before writing a file; covered by a resource-preservation test.
- Verification: typecheck, lint, 93 component tests, 64 stories x 3 axe variants, 16 documentation pages with zero broken links, and nine affected browser journeys passed across final runs. Backend run had one MCP budget failure; the fix and all eight MCP quality tests passed on rerun. Final backend/fixture checks and Docker rebuild follow below.

## 2026-09-29 — CHG-030 MongoDB removed, Testcontainers, example-data removal, worker coverage, more journeys, per-task specs (TASK-136 through TASK-141, TASK-127)

- MongoDB: the runtime was already gone; the built-in example project, its stack and the plan records still described MongoDB and GridFS and now describe PostgreSQL (JSONB, object storage for attachments, a leased job table). (A guard test for this was added and then removed at the owner's request; the code has no MongoDB dependency, import, service, setting or fallback.) MongoDB remains a catalog technology for users' own projects. The local `.env` lost its MongoDB lines and gained `DATABASE_URL`.
- Testcontainers: backend tests start `pgvector/pgvector:pg17` when `DATABASE_URL` is not set (global setup in `tests/setup/postgres-container.ts`), so `pnpm test` works with Docker alone. `ssh2`/`cpu-features` native builds are not allowed; the pure-JS fallback is enough.
- Example data: Settings > Administration > Example data lists projects whose first revision came from the example and removes them with their revisions, proposals, baselines, board, jobs, connectors, Git settings, MCP tokens, files and search rows, after a confirmation (`DELETE /api/v1/admin/example-projects` with `{"confirm": true}`), admin only and audited.
- Worker: the polling loop moved to `worker-loop.ts` with injected sleep and stop; covered for jobs, idle waits, error back-off, stopping before a new job and finishing the current job on SIGTERM.
- Browser journeys: Build with AI end to end and example-data removal, with axe; the fake Ollama now streams chat replies with a tool call. Found and fixed: the in-place edit field faded its text below the contrast threshold while animating.
- Plan: every task has `.plan/tasks/TASK-###/intent.md` and `spec.md`, generated by `scripts/plan-task-docs.ts` from tasks, expanded scope, the browser review and the change log; acceptance criteria are never invented (missing ones are marked); `pnpm plan:tasks:check` runs in CI. The superseded Claude handoff note was deleted (approved in the duplicate review).
- Full browser suite: three journeys were stale after new projects started opening on Build with AI (dashboard, `.plan` folder) and the phone UX tour found top-bar icon buttons shrinking to 22 px on every page; icons now keep a 24 px minimum and the phone top bar uses tighter spacing so nothing scrolls sideways.

## 2026-09-29 — CHG-031 Roles that cannot be escalated, and the specification as an interactive chat (TASK-142, TASK-143, TASK-127)

- Roles: one policy (`shared/role-policy.ts`) applied by `api/role-guard.ts` to role changes, invitations (at creation and again at acceptance), single sign-on, sign-up and project members. Owner (root) is never granted through the application; only an owner grants Admin; nobody changes their own role; administrators cannot change, remove or deactivate other administrators or owners; refused attempts are written to the audit log. Found while checking: an owner could grant Owner, a project administrator could grant project ownership and administrator access and change their own role, and a stored invitation for an owner would have been honoured.
- The dedicated no-MongoDB test was removed at the owner's request (the code has no MongoDB dependency).
- Build with AI is now a guided interview: one question at a time as a card with the right control, saved at once, folded into question and answer bubbles, with skip, "not sure yet", "doesn't apply" (with a reason), "Suggest with AI", wrap-ups (skipped, unknown, optional, readiness), "Answer in chat" from the document and "Next question". It runs as a local AG-UI agent in the browser (no model, no wait, offline and local-only safe) inside the same CopilotKit conversation as the AI, which answers typed messages. A card left open is closed when the person moves elsewhere, so only the newest question is open. The conversation and the interview's memory are kept per project in the browser.
- AI hand-off: typed text goes to the AI with the interview turned into a plain conversation; "Suggest with AI" names its question so the server turns the AI's own words into a proposal for that question only (small local models read it with a structured pass). The first version read the hidden request as if the person had said it.
- Consolidation (from the approved duplicate review): one `answerStatus` in `shared/domain.ts` replaces four copies, one `ProgressRing`, `answerSummary` in `shared/interview.ts` replaces the live document's own preview.
- Found and fixed in the browser: CopilotKit empties the agent's messages when its chat first mounts (the starter now runs after it); an agent recreated while models loaded lost its messages (the agent is stable and looks the AI up per run); the greeting was written before the model list loaded; two cards were open at once; answer bubbles had white text on a tinted background inside CopilotKit's theme; CopilotKit's message toolbar buttons had no accessible name.
- Verification: typecheck, lint, backend tests on Testcontainers (permissions, interview, builder agent), frontend tests, 80 stories x 3 axe variants, and browser journeys for the interview (text, table, unknown, not applicable, every control kind, jumping, next, suggestion, no AI, French) with axe checks.

## 2026-10-01 - CHG-032 Native section conversation and quiet workspace (TASK-144 through TASK-148)

- Reused the guided AG-UI conversation in Specification with Chat as the initial mode and Form for direct editing. Proposals opens the same conversation in-page; the old Ask AI modal is removed. Contextual requests are consumed once, including across Form/Chat switches, and question suggestions use the existing question-scoped proposal contract.
- Moved help/examples and AI actions to question headers, folded guidance and removed repeated labels. Short visible controls retain descriptive accessible names. The document filename/status remain visible; Preview is the default and a Tools toggle reveals editing, diagrams, history and refresh.
- Moved run diagnostics/cancellation to Settings > AI activity. A folded background-request form preserves durable runs and the isolated agent. Feature gates, local-only filtering, role checks and proposal acceptance remain in place.
- Extracted conversation persistence into `builder-session.tsx`, and existing project-creation, keyboard-help and tour helpers into separate modules to keep the architecture size budgets unchanged. Updated the user guide and task intent/spec documents.
- Verification: typecheck and lint passed; 143 component tests plus the new background-run test passed. All 83 Storybook stories passed axe in three variants. Fifteen affected browser journeys passed across runs (a duplicate-text selector was corrected; a dev-server connection refusal passed on an isolated rerun). Native chat checked at 1440, 1213 and 390 px without horizontal overflow, including phone axe and non-replayed AI requests. Documentation: 16 pages, zero broken links in the source build. Architecture and generated task-document checks passed. Final backend and Docker results are recorded below.

## 2026-10-01 - CHG-033 NVIDIA NIM provider (TASK-149, TASK-150)

- NVIDIA NIM is a fifth AI provider (`nvidia-nim`). It speaks the OpenAI chat protocol, so OpenAI and NIM now share one path: `openaiHost` (host, key, headers) in `providers.ts` serves model listing and proposal runs, and `openaiTurn` in `chat-providers.ts` serves the streaming, tool-calling Build with AI conversation. The default host is the free hosted catalog (`https://integrate.api.nvidia.com/v1`, key from build.nvidia.com, stored encrypted and write-only like the other keys); `NIM_BASE_URL` points at a self-hosted NIM, which needs no key. `nim.ts` checks that address (plain http(s), no embedded credentials, trailing slash trimmed) and filters the catalog's embedding, safety, reward, vision and speech models out of the model list.
- Differences from OpenAI that the tests pin: NIM takes `max_tokens` (not `max_completion_tokens`), proposals do not request a JSON response mode (not every NIM model accepts it; `parseModelJson` copes with fences), a cut-off answer is reported as such, provider error bodies are never repeated (they can echo the key), 429 is retryable, and a 400 on a tool request suggests a model that supports tools. The integrations list reports `endpoint: hosted | self-hosted` without revealing the address; a self-hosted NIM counts as configured without a key. Settings > AI providers shows a short bilingual hint on the NVIDIA NIM card.
- Local-only projects never use NIM, hosted or self-hosted (the agent route, queued runs and `generate` all refuse it). Allowing a self-hosted NIM on a private address for local-only projects is in the backlog.
- Found while testing: the API's error handler replaces every 5xx message with a generic one, so setup hints such as "Configure an NVIDIA NIM API key" never reach the person (the same applies to OpenAI, Kroki, the PDF publisher and Google sign-in). Left unchanged and written to the backlog, since what the API may reveal is a separate decision.
- `pnpm nim:check` (TASK-150) checks an endpoint with `NVIDIA_API_KEY` (hosted) or `NIM_BASE_URL` (self-hosted): model list, one streamed reply with token usage, one tool call. It exercised against a throw-away fake server (no key, bad address, success, model without tools); it has not been run against the hosted service because that needs a key.
- Verification: typecheck and lint clean; `tests/nim.test.ts` (19 tests: address rules, settings and secrecy, model list, proposal request shape, no credentials to a keyless self-hosted NIM, fenced JSON, cut-off answers, rate limits and error bodies, streamed text, tool call and usage, the tool hint, queued run to pending proposal, conversation tokens, unknown model, local-only refusal); a web test that the picker offers NIM and hides it from local-only projects; full backend suite 390 passed (statements 93.57%, branches 84.03%) and web suite 145 passed. The public model list of the hosted endpoint was fetched without a key to confirm its OpenAI-style shape, and the Settings card was checked in the browser. Not verified: a chat completion or tool call against the real hosted service.

## 2026-10-01 - CHG-034 Skills follow Anthropic's authoring rules (TASK-151, TASK-152, TASK-153)

- Source: the video "Everything You Know About Skills IS OUTDATED" and the guide it is built on. Its seven points became checks instead of advice: content lists on long references, instruction strictness matched to risk, testing on every model, references one level deep (deeper ones are read with `head -100`), checklists, check-fix-repeat loops, explicit dependencies.
- `shared/skill-audit.ts` (pure) and `pnpm skills:check [--strict] [folder …]` apply those rules to this repository's skills (`.claude` and `.agents` must be identical), to the skills SDD Studio generates, and to any folder given. CI runs it with `--strict`. Pointed at third-party skills in `node_modules` it found real problems (references that point to other references, long files without a contents list, descriptions that never say when to use the skill).
- The exported project skill (now `api/skill-export.ts`) failed its own rules: every long reference lacked a contents list (`design.md` had 514 lines), `design.md` pointed to `PRODUCT.md`, a project named "Claude <b>Helper</b>" produced the name `claude-bhelperb-spec` (reserved word) and a description with a tag, the description carried the revision and an unquoted ": " that YAML cannot read, and every unanswered section was written as an empty file. Now: a valid name for any project name, a quoted and stable description (the revision moves to the body), contents lists, no cross-references, items split by type (`references/items/*.md`), no files for untouched sections (listed as open), a copyable checklist, and "follow exactly / do not build on / use judgement" levels.
- The maintenance skills got a checklist, a "never bend" section, a fix-and-repeat step and the commands added since (`plan:tasks`, `skills:check`). The two repository copies had drifted apart (one lacked the UX tour and fixtures steps).
- Found and fixed on the way: the overview image subtitle read "Â·" and the Markdown, LaTeX, HTML and PDF exports of a French project read "RÃ©vision", "TraÃ§abilitÃ©", "PrÃ©paration" and "prÃªt" (UTF-8 saved as Windows-1252); a test now scans the source of every module for it and exports a French project.
- Verification: `tests/skill-audit.test.ts` (28 tests: each rule with a failing and a passing case, this repository's skills, the generated skill for ten project shapes including 150 requirements and hostile names), `tests/agent-exports.test.ts`; typecheck, lint and `pnpm skills:check --strict` clean. Not done: running each skill on Haiku, Sonnet and Opus with three evaluations (backlog); the CI step has not run on GitHub.

## 2026-10-02 - CHG-035 Tasks appear when the specification is correct, and agents can read and write the project (TASK-157, TASK-158, TASK-159)

- Request: add MCP to read and write the existing project, and split the project into tasks automatically once the specification is correct. Before: the board made one flat card per item and only when someone clicked "Create from baseline"; nothing ordered or linked the tasks; agents could not ask what is ready, import an existing `.plan/tasks.md`, or read the whole specification.
- "Correct" is the existing gate: a reviewer approves a baseline, which already requires full readiness. Approving one now splits the project into tasks automatically (`createTasksForBaseline`, retried once on a board conflict, never failing the approval, audited either way), and the response and the notification say how many tasks were created. The Board's action became "Refresh from baseline" and uses the same plan.
- `shared/task-plan.ts` (`breakIntoTasks`) is a deterministic function, not a model: foundations from the stack, decisions, one epic per component (requirements by priority, each with its tests, the component's own task last), requirements without a component, use cases that wait for their requirements, risk mitigations, loose tests, "won't" items in the backlog, a test task for a requirement that has none, and a list of gaps. Every item keeps its identifier as the card identifier, so existing boards keep columns, assignees and pull requests; only grouping, order and dependencies are refreshed. Dependencies come from that structure and from the specification's own depends-on links; a loop is dropped and reported.
- Cards gained `dependsOn` and the board gained `gaps` (both with defaults, so older boards load). `.plan/tasks.md` writes dependencies as `— After: REQ-001, REQ-002` and reads them back; the Sources marker now accepts `stack:` sources. The Board shows "Waits for …" on a waiting card and lists the plan's gaps.
- MCP (`api/mcp-tasks.ts`, kept out of `mcp.ts` for the size rule): resource `sdd://project/specification.md` (the whole specification), `list_proposals`, `get_next_tasks` (ready tasks only), `import_plan_tasks` (an existing `.plan/tasks.md`, with a preview), `plan_tasks` (refuses until a baseline exists and says what is in the way; preview with `dryRun`), prompt `break_into_tasks`; `implement_next_task` now starts from `get_next_tasks`. Still no tool can approve, delete or touch baselines.
- Verification: `tests/task-plan.test.ts` (23), `views/board.test.tsx` (4), full web suite 152 passed with coverage floors met, architecture rules (19 ArchUnit tests, no cycles, size limits), typecheck, lint, production build, fixtures, task documents and the 16-page docs site. The MCP quality gate's definition-level rules were checked in memory (12 tools, 21,357 of 24,000 characters, no violations).
- Follow-up (2026-10-07): the database-backed tests could not run on 2026-10-02 because the Docker engine was down. Once it was back they ran: `tests/api.test.ts`, `tests/board.test.ts`, `tests/mcp.test.ts` (15), `tests/mcp-quality.test.ts` (8), `tests/aio.test.ts`, and the browser journey `e2e/workspace.spec.ts`. Two assertions of mine were wrong and were fixed in the tests: the sample project has a stack, so it gets foundation tasks (9, from the real catalog), and token creation is rate limited (10 a minute), so the new MCP tests store their tokens directly. TASK-158 and TASK-159 are done.

## 2026-10-07 - CHG-036 The minimal path to a correct specification (TASK-165, TASK-166, TASK-167)

- Request: make creating a spec minimal. A correct spec needed 60 required answers across 14 modules plus 14 section reviews. Asked what "minimal" should mean, the answer was all four options: an Essentials level, one idea in and a draft out, fewer clicks to approve, and an OpenSpec-style minimal change.
- Essentials level (TASK-165): one stored field, `Spec.level` (`essentials` or `complete`, default `complete`, migration 008), and one place that follows it, `moduleQuestions`, so readiness, completeness and the interview change without knowing about the level. `shared/essentials.ts` names the 15 core questions (problem, users, scope in and out, requirements, acceptance criteria, main journey, system boundaries, components, data, assets, authentication, stack, end-to-end journeys, environments), which cover nine modules; only those nine sections need a review, and completeness counts only them. Nothing is deleted when the level changes. The new-project dialog defaults to Essentials; the API default stays Complete, so no existing caller or the example changes. Settings > Project switches it, and `get_project_overview` tells agents which level they are working at.
- One idea in, a draft out (TASK-166): the "What are you building?" sentence becomes the description and, through `POST /projects/:id/draft`, queues one run of the existing AI pipeline (so the feature switch, local-only rule, budgets and provider checks all apply) that drafts only the 15 essentials as a proposal, with "unknown" where the sentence says nothing. The reply is an answer, not an error, when no model is chosen, the project is local-only without a local model, or the AI is switched off.
- Review all and approve (TASK-167): `reviewAll` on baseline approval reviews every section that needs it and has its required answers, then approves, and so creates the tasks. It checks readiness on the would-be-reviewed specification first, so a refused approval writes nothing. The Readiness page shows "Review all and approve" only when reviews are all that stands in the way.
- The OpenSpec-style change: OpenSpec's "propose" flow is the combination of the three above (one sentence, a drafted Essentials specification, one approval, the tasks). Codex's OpenSpec exchange (TASK-160 to TASK-164) deliberately invents no active change, so a one-page change brief is in the backlog for after it.
- Also: OpenSpec's generated skills (`metadata.generatedBy`) are listed and skipped by `pnpm skills:check` and its test, because the CLI rewrites them and the Claude and Codex copies differ on purpose; the audit still checks every skill this repository writes.
- Verification: `tests/essentials.test.ts` (12), `tests/minimal-spec.test.ts` (11, against PostgreSQL, including a queued draft run through the fake local model), `tests/migrations.test.ts`, `tests/mcp.test.ts`; web `new-project.test.tsx` (8) and `readiness.test.tsx` (5); full backend suite 479 passed before the last two small changes and the full web suite 163 passed with coverage floors met; browser journeys `e2e/minimal-spec.spec.ts` (2, run three times, with axe) and `e2e/workspace.spec.ts`. Found by the browser journey: reading the project id from the address right after creation sometimes found the previously open project, so the journey looks the project up by name.
- **Not passing, not mine:** in the full browser run, `builder.spec.ts` and four of the six `interview.spec.ts` journeys fail on conversation copy that Codex is rewriting in TASK-154 and TASK-155 (the composer now says "Ask a question…", and "Sure — here’s that question." is gone). They also needed to choose the Complete level, which they now do, and the first interview journey passes. They should be updated by the task that changed the copy.
- **Not verified:** how good a real model's draft is; only the wiring, the prompt and the safety rules were exercised, with a fake local model.

## 2026-10-09 - CHG-037 Essentials fit the project type, and a draft can be asked for again (TASK-168, TASK-169)

- Request: continue the minimal-spec work. The two follow-ups left open were one list of 15 for every project type (a library still had to describe sign-in and environments) and a draft that needed the sentence typed again.
- Essentials per type (TASK-168): `essentialIdsFor(projectType)` adjusts the base list (library: public API and packaging instead of sign-in and environments; device: test matrix and packaging instead of sign-in; mobile and desktop: packaging; data or AI: model evaluation). A test checks every listed question applies to its type, is already required at the complete level, and keeps the same nine sections under review; the counts are 15 or 16. Essentials projects of the changed types created on 2026-10-07 or 2026-10-08 now owe their type's questions instead of the web ones. Devices use the test matrix, not device security, because device security is optional in the question library.
- Draft again (TASK-169): with no sentence in the request, the draft uses the project description; Overview offers "Draft the essentials with AI" while an essential answer is missing. The notice text is shared with the new-project dialog.
- Fixed on the way: Overview showed reviews as "x/14" and kept suggesting reviews at the essentials level, where only nine sections need one (`completeness.reviewNeeded`). A navigation test that waited the default second for the lazily loaded import dialog timed out in full parallel runs; it now waits up to eight seconds.
- Verification: `tests/essentials.test.ts` (17) and `tests/minimal-spec.test.ts` (14, PostgreSQL; the file stays under the draft route's 10-a-minute limit); full backend suite 520 passed with coverage 93.8% statements, 85.9% branches; full web suite 173 passed with coverage; `e2e/minimal-spec.spec.ts` and `e2e/workspace.spec.ts` 5 passed; typecheck and lint clean.

## 2026-10-09 - CHG-038 UX review against Apple's Human Interface Guidelines, and its fixes (TASK-170, TASK-171)

- Request: use the apple-design skill (github.com/dickwu/apple-design-skill) to review and improve the UX and UI. Its `SKILL.md` and 18 HIG pages were read from a scratch folder and not installed in the repository, so `skills:check` and the `.claude`/`.agents` copies are unaffected. The report is `docs/ux-review.md`.
- Evidence: UX tour screenshots (9 views × 3 widths) before and after, and a script computing the contrast of every token pair in light and dark. Text contrast was already sound (at least 4.5:1 everywhere).
- Fixed:
  - Text fields, selects and switches had an edge of 1.49:1 (light) and 1.70:1 (dark). The new `--control-line` token brings it to at least 3.06:1 and 3.46:1.
  - `prefers-contrast: more` is supported.
  - Light and dark now follow the system live ("Match system", the default). The old `sdd-theme` key had stored the first visit's appearance as a choice, so it is ignored.
  - On phones, Dashboard, Settings and the account moved into the Views menu and the breadcrumb row is hidden. The page title starts about 110 px higher (the frame was about 42% of an 812 px screen).
  - The rail badge and section dots go from 9–10 px to 10.5 px.
  - `--nav-muted` on hover goes from 4.33:1 to 4.80:1.
  - Under Readiness, the disabled approve button is secondary when "Review all and approve" is offered.
- Deliberate deviations, recorded in the report: the in-app theme choice is kept as an accessibility preference, and there is no menu bar (a web app; commands are reachable by sidebar, toolbar, shortcuts and search).
- Backlog: a phone "More" menu followed by 44 px phone targets; stacked rows for the requirements table on phones; a five-step type scale in place of about 37 sizes.
- Tooling fixes found on the way:
  - `scripts/check-stories-a11y.ts` crashed with "headers already sent" when a file was missing, because it wrote the 200 before reading the file. It now reads first.
  - `expectAccessible` takes an optional scope, so a dialog is checked by itself. Under the backdrop, axe flagged the dimmed Build with AI page behind the new-project dialog whenever an earlier journey had left a project with a conversation open.
  - The navigation test that waits for the lazily loaded import dialog gets a 20-second limit for full parallel runs.
- Verification:
  - Contrast script: no failures in light or dark.
  - `appearance.test.tsx` (3); full web suite 176 passed with coverage.
  - `pnpm test:stories`: 90 stories × 3 variants pass axe.
  - The UX tour passes on desktop, tablet and phone (axe, targets, no sideways scrolling), and a live check at 375 px and 1280 px.
  - `native-chat`, `minimal-spec` and `workspace` journeys: 6 passed. Typecheck and lint are clean.
- **Not passing, not mine:** in the full browser run, `builder.spec.ts` and four `interview.spec.ts` journeys still fail on the conversation copy changed by TASK-154/155. Both `openspec.spec.ts` journeys fail axe's target-size rule on the nested "Download" and "JSON" summaries of the OpenSpec import preview (TASK-164, in progress). Both are in the backlog.

## 2026-10-09 - CHG-039 Answers you can interact with, and the failing journeys addressed (TASK-172, TASK-173)

- Request: improve the three groups still failing, and bring CopilotKit's Open Intelligent UI ("answers you can interact with") into the UI.
- Failing groups (TASK-172):
  - Every `<summary>` now gets a 24 px minimum target in `style.css`, which covers the OpenSpec preview without editing Codex's component.
  - The migrated OpenSpec command skills are marked as generated; `pnpm skills:check --strict` now reports 0 errors.
  - The conversation journeys now expect the behaviour TASK-154 introduced. The specs, not the product, were out of date: the composer says "Ask a question…" (or "Next question…" without AI), a question opened from the document arrives without a canned introduction, a question left open folds without a record, and "Next question" records a skip.
- Interactive answers (TASK-173):
  - Open Intelligent UI lets the agent pick prose, a native component or a sandboxed custom UI. Here the AI may answer with one tool, `show_visual`. It sends data for a weighted comparison, a step-by-step walkthrough or a bar chart, validated by one schema (`shared/visual-answers.ts`) on the server and in the browser.
  - The server answers the call at once (`{shown: true}`, or an error the model can fix) and ends the reply when the sentence is already written.
  - The browser draws it with native components: weight sliders that re-rank live, a Scores table with notes, a stepper with Play and Pause (reduced motion respected), and single-hue bars with values in text, a limit line, a table view and focusable rows. A refused or unknown shape draws nothing, and a streaming one shows a placeholder.
  - Follow-up buttons send an ordinary message from the person, so recorded facts still arrive as proposals (invariant 3). Model-written HTML or JavaScript is never run, which is why there is no sandboxed custom-UI mode. Local models without tool calling keep answering in prose.
- Verification so far:
  - `tests/visual-answers.test.ts` (6, schema, refusals, ranking) and `visual-answer.test.tsx` (6, re-ranking, ties, stepper, chart, streaming, French).
  - Typecheck and lint are clean; Storybook a11y passes (94 stories × 3 variants).
  - Story screenshots in light and dark. They found and fixed a misaligned limit line: the rows now share one grid.
- Found on the way:
  - CopilotKit's `useRenderTool` passes a call's arguments as `parameters`, not `args`, so the first wiring would have drawn nothing (typecheck caught it).
  - The new code first broke two architecture rules: `Builder.tsx` passed 800 lines and one component passed 300. The visual is now four files, and the wiring is a hook (`VisualAnswerTool.tsx`).
- Verification, completed on 2026-10-10 once Docker was back:
  - `tests/builder-agent.test.ts` 18 passed (two new `show_visual` cases: shown and ended; refused and retried).
  - Full browser suite 31 of 31, including `interactive-answers.spec.ts`, `builder.spec.ts`, all six `interview.spec.ts` journeys and both `openspec.spec.ts` journeys.
  - Full backend suite 528 passed (coverage 93.9% statements, 85.9% branches); full web suite 182 passed with coverage.
  - Architecture rules 19 of 19; Storybook a11y 94 stories × 3 variants.
- **Not verified:** how well a real model chooses and fills visuals; the journeys use a scripted model.

## 2026-10-10 - CHG-040 Motion and feel after the apple-design skill (TASK-174)

- Request: use the apple-design skill (Apple's "Designing Fluid Interfaces" and related talks, translated for the web) to improve the UI. The HIG review (CHG-038) had covered accessibility and conventions; this pass covers how the interface responds and moves.
- Changes:
  - Press feedback on pointer-down (`:active` scale 0.97, transform only).
  - One set of springs in `web/motion.ts`: `ui` and `snappy` critically damped, `momentum` only after a gesture. Conversation cards, the live document, chart bars and walkthrough steps use them instead of bouncy springs or fixed durations.
  - Steps move in the direction of travel.
  - Dialogs fade and scale in and leave the same way. The exit needs its own keyframes: reusing the entrance in reverse made Radix remove the dialog at once.
  - A rubber-band splitter that springs back with its release velocity.
  - A translucent top bar that is solid under reduced transparency or more contrast.
  - Size-aware heading tracking and leading with optical sizing.
  - A 250 ms colour fade when light and dark change.
- Deviations: reduced motion stays instant (the journeys check settled states, and it meets WCAG 2.3.3), and `playwright.config.ts` now runs every journey with reduced motion. Board and Stack keep native HTML5 drag; a pointer-based drag with momentum is in the backlog, as is keeping conditionally mounted dialogs mounted so their exit can play.
- Verification:
  - `motion.test.ts`, `splitter.test.tsx` and `appearance.test.tsx`, then the full web suite: 186 passed with coverage.
  - Typecheck and lint are clean; Storybook a11y passes (94 stories × 3 variants).
  - A live check in the preview browser: the dialog exit animation plays, the theme fades, the splitter gives 18.6 px past its limit and settles, and the top bar blurs.
- **Not verified yet:** the Docker engine stopped again on 2026-10-10, so the UX tour (axe at three widths) and the full browser suite have not run with these changes. TASK-174 stays in progress until they do. Feel can only be judged by using it.
