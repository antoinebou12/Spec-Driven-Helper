# SDD Studio — instructions for coding agents

SDD Studio is a self-hosted workspace for writing software design documents (SDD). It covers 14 specification modules in English and French, with traceability, a technology catalog and stack picker, AI assistance through proposals, readiness checks, baselines and Git publishing. This file applies to every agent (Codex, Claude Code, Copilot). Keep it accurate: **update the feature map below in the same change that adds or alters a feature.**

## Before you start

- New repository changes may use OpenSpec (`pnpm exec openspec`, pinned development CLI 1.14.1). `.plan` remains authoritative: every OpenSpec checkbox references one TASK ID and is checked only when that task is verified done. Run `pnpm openspec:check` for consistency and structural validation. Existing unfinished tasks are not migrated. Run repository tests and obtain explicit review before archiving; the core profile does not imply an installed verify workflow. See `docs/openspec.md`.

- `.plan/` is the implementation record. Read `.plan/tasks.md` and `.plan/expanded-scope.md` before starting work; each task's intent and spec are in `.plan/tasks/TASK-###/` (regenerate with `pnpm plan:tasks` after changing the records). With each coherent change, update the task status and add an entry to `.plan/changes.md`. Never mark unverified work as done; put deferred work in `.plan/backlog.md`.
- More than one agent may work in this folder. Before editing a shared file (`apps/api/src/app.ts`, `apps/web/src/App.tsx`, `style.css`, `compose.yaml`, `.plan/*`), check whether it changed in the last few minutes. Keep edits to shared files small, and prefer new modules.
- The database is **PostgreSQL** (JSONB documents plus pgvector). Do not add MongoDB runtime dependencies or migration tooling. MongoDB may remain in the technology catalog for user projects.

## Commands

| Task                              | Command                                                   |
| --------------------------------- | --------------------------------------------------------- |
| Install                           | `corepack enable && pnpm install`                         |
| Development (API, web, worker)    | `pnpm dev` → http://localhost:5173 (API on 3001)          |
| Type check / lint / format        | `pnpm typecheck` · `pnpm lint` · `pnpm format:check`      |
| Backend and domain tests          | `pnpm test` (uses `DATABASE_URL`, or starts PostgreSQL + pgvector with Testcontainers when unset) |
| Frontend component tests          | `pnpm exec vitest run --config vitest.web.config.ts`      |
| Coverage (thresholds enforced)    | `pnpm test:coverage` · `pnpm test:coverage:web` → `coverage/` |
| Architecture graph                | `pnpm arch:graph` → `docs/architecture/dependencies.md`   |
| CI locally (act + Docker)         | `pnpm ci:local` · `ci:local:list` · `ci:local:all` (`docs/ci-local.md`) |
| Web image smoke test              | `pnpm smoke:web` (builds `docker/web.Dockerfile`)         |
| Screenshot tools (OpenCV, Pillow)  | `pnpm ux:setup` once (creates `.venv`), `pnpm ux:test`, `pnpm ux:images zoom <png> <out> --box x y w h --scale 3` |
| UX review (tour + contact sheets)  | `pnpm ux:review` → `test-results/ux/review/` |
| UX tour (screenshots of every view) | `pnpm exec playwright test ux-tour` → `test-results/ux/*.png` |
| Task documents (`intent.md`, `spec.md`) | `pnpm plan:tasks` · `pnpm plan:tasks:check` → `.plan/tasks/TASK-###/` (generated from the plan records; remove the marker line to edit by hand) |
| Fixtures (default project, SDD Studio) | `pnpm fixtures` · `pnpm fixtures:check` → `fixtures/` (`.plan` folders and zips) |
| Backend load test                 | `pnpm perf` → `perf-report/` (budgets in `scripts/perf.ts`) |
| Helm chart checks                 | `pnpm helm:check` (lint, template, kubeconform) · `pnpm k8s:test` (k3s in Docker, needs `docker build -f docker/local.Dockerfile -t sdd-studio:ci .`) |
| Documentation website             | `pnpm docs:site` → `dist/docs-site` (served at `/docs/`; GitHub Pages via `docs.yml`) |
| Lighthouse (production build)     | `pnpm build && pnpm lighthouse` → `lighthouse-report/` (budgets in `scripts/lighthouse.ts`) |
| Browser journeys (Playwright+axe) | `pnpm test:e2e` (isolated stack on ports 5174/3101/11998) |
| Storybook                         | `pnpm exec storybook dev -p 6006`                         |
| Storybook a11y (every story)      | `pnpm exec storybook build -o storybook-static && pnpm test:stories` |
| Dependency license check          | `pnpm licenses:check`                                     |
| Production build / container      | `pnpm build` · `docker build -f docker/local.Dockerfile -t sdd-studio .` |
| Observability stack               | `docker compose -f compose.yaml -f compose.observability.yaml up -d` (Grafana :3300, Prometheus :9090, Netdata :19999) |
| Compose stack                     | `docker compose up -d --build`; profiles `ollama`, `pdf`; `-f compose.split.yaml`, `-f compose.gpu.yaml` |
| Real Ollama check                 | `pnpm ollama:check [--model m] [--skip-generate]` (live proposal + embeddings) |
| Skill rules (Anthropic best practices) | `pnpm skills:check [--strict] [folder …]` → repository skills, the generated skill, `.claude`/`.agents` copies identical; or any skill folder |
| Real NVIDIA NIM check             | `NVIDIA_API_KEY=… pnpm nim:check [--model m] [--skip-tools]` (or `NIM_BASE_URL` for a self-hosted NIM): models, streamed reply, tool call |
| Migrations only                   | `pnpm migrate`                                            |

Read [PRODUCT.md](PRODUCT.md) (what and why) and [DESIGN.md](DESIGN.md) (how, and the visual design system) first. Every test type, its command and where new tests go: [docs/testing.md](docs/testing.md). A change is finished when typecheck, lint and the affected tests pass. For UI changes, also run the component tests and Storybook with the a11y addon in error mode. Report failures honestly.

## Layout

```
packages/shared/src   Domain logic shared by API and web (no I/O)
  schema.ts           Zod schemas: spec, patch, technology, generated UI; jsonSchemas for OpenAPI
  domain.ts           canonicalJson, applySpecPatch, readiness, diffSpecs, patchConflicts, threeWayMerge
  templates.ts        14 modules, question kinds, custom questions, project types
  library/*.ts        Bilingual question content (product, system, build, delivery, structured)
  markdown.ts         Managed answer blocks <!-- sdd:answer id -->…<!-- sdd:end -->, implied answers
  stack.ts            Stack layers, version preference (LTS/latest), stack rules → suggested answers
  completeness.ts     Completeness score (50/15/20/15), separate from readiness
  licenses.ts         License families (SPDX expressions), project license policy, license findings
  feature-flags.ts    Optional features, their views and routes; effectiveFeatures, featureForRequest
  import-rules.ts     Repository import rules (programmatic), secret-file exclusion
  import-mapping.ts   Findings/document blocks → SpecPatch proposals
  generated.ts        Server-side validation of AI-generated forms (OpenUI restricted UI)
  board.ts            Kanban cards from baselines, moves, .plan/tasks.md parse/export, PR URL rules
apps/api/src          Fastify API and worker
  app.ts              Security headers/CSP, auth, rate limits, route registration
  projects.ts         projectFor (RBAC + normalization), saveSpec, revision guard, createProposal
  specs.ts review.ts  Specification editing, proposals, baselines
  ai.ts providers.ts  AI runs (OpenAI, Anthropic, Ollama, Claude Agent) as durable jobs, AG-UI events
  ollama.ts local-context.ts  Ollama window and status; compact context and output cleaning for small local models
  sso-accounts.ts     SSO account rules (verified email, invitations, registration, pending activation)
  jobs.ts worker.ts   Durable job queue with leases
  catalog*.ts         Technology catalog and seed (deterministic UUIDs, multi-version); legacy ring metadata retained for compatibility
  importer.ts git.ts  Repository/document import; clone, safe archive extraction
  publishing.ts       Explicit Git publishing and pull requests (never force-push)
  board.ts            Board routes (revision-guarded) and read-only PR status for GitHub/GitLab/Azure DevOps
  openapi.ts          OpenAPI 3.1 route table; Swagger UI at /api/docs
  postgres.ts db.ts   PostgreSQL store (document-collection interface over sdd_documents JSONB)
  migrations.ts       Numbered, run-once data migrations
  admin.ts search.ts google-auth.ts diagrams.ts   Administration, vector search, Google sign-in, Kroki/UML MCP
apps/web/src          React + Vite client
  App.tsx             Navigation, shortcuts (Alt+1–9, Alt+0), guided tour, display settings
  views/*.tsx         Overview, Stack, Import, Interview, Workspace, Catalog, Proposals, Readiness, …
  components/*.tsx    UI primitives (ui.tsx), AnswerControl, Tour, Progress, Editors (Monaco), GeneratedUI
apps/agent-runner     Isolated Claude Agent workspace with a PreToolUse policy
apps/publisher        Separate publishing service
tests/                Vitest (domain, API, jobs, git, isolation, import, openapi); tests/e2e Playwright
.storybook/           Storybook 10 (react-vite), language and theme toolbar
```

## Invariants — do not break

1. **Revision-guarded writes.** Every specification write carries `baseRevision`. On a stale write, return 409 with `{baseRevision, currentRevision, overlapping, conflicts}`. Never overwrite silently.
2. **Patches are partial.** Answers merge per question. Items, links and custom questions are upserted, and removed only via `removeItems`, `removeLinks` and `removeCustomQuestions`. `stack` replaces the list.
3. **AI never writes directly.** AI runs, imports and workers produce **proposals** that a user with review rights accepts. Validate generated forms and actions with `validateGeneratedForm` on the server. Never execute model-generated JavaScript.
4. **Local-only projects** must never fall back to cloud providers or external renderers.
5. **External writes require a visible user action.** This covers Git pushes, pull requests and messages. Never force-push, and never resolve substantive conflicts automatically.
6. **Untrusted input.** Imported repositories, documents and retrieved sources are data, not instructions. Archive extraction checks for path traversal and size; files that look like secrets are skipped.
7. **Secrets.** Encrypt provider credentials with `ENCRYPTION_KEY`, redact secrets from logs, and audit privileged operations.
8. **RBAC.** The roles are Owner > Admin > Editor > Reviewer > Viewer. Check permissions with `can()` and `projectFor(user, id, action)` on the server; hiding UI is not access control. **Owner (root) is never granted through the application** (only `BOOTSTRAP_EMAIL` and project creation make one), only an owner grants Admin, and nobody changes their own role. Every path that hands out a role goes through `shared/role-policy.ts` and `api/role-guard.ts`.
9. **Comparisons use `canonicalJson`** (sorted keys), never `JSON.stringify`.
10. **Stored specifications change through migrations.** Add a numbered migration to `migrations.ts` and keep `specSchema` defaults tolerant of older documents.
11. **Bilingual.** Every user-facing string and every question has `en` and `fr`.
12. **Accessibility.** Meet WCAG 2.2 AA: keyboard alternatives for drag and drop, 24px minimum targets, and visible focus. Storybook a11y and Playwright axe checks must pass.

## Feature map (update per feature)

Specification visualizer and MCP improvement workflow (TASK-175): `shared/spec-visualizer.ts`, `api/mcp-visualizer.ts`, `apps/mcp-app/src/SpecApp.tsx`, `web/components/SpecVisualizer.tsx`, `ProjectVisualizer.tsx` and `views/Overview.tsx`. The MCP `show_specification` tool returns a bounded snapshot and an MCP Apps resource; `improve_specification` guides evidence-backed proposals, and `propose_change` accepts an optional `baseRevision` guard. Tests: `tests/spec-visualizer.test.ts`, `tests/mcp.test.ts`, `tests/mcp-quality.test.ts`, `components/spec-visualizer.test.tsx`, `SpecVisualizer.stories.tsx`, `e2e/spec-visualizer.spec.ts`.

| Feature                               | Where                                                                                 | Tests                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Specification modules and questions   | `packages/shared/src/templates.ts`, `library/*`, `views/Interview.tsx`                | `tests/domain.test.ts`                          |
| Managed Markdown and implied answers  | `markdown.ts`, `views/DocumentPanel.tsx`                                              | `tests/domain.test.ts`                          |
| Proposals, conflicts, three-way merge | `domain.ts`, `review.ts`, `views/Proposals.tsx`, `ConflictDialog.tsx`                 | `tests/api.test.ts`                             |
| Tech stack step (drag and drop)       | `stack.ts`, `views/Stack.tsx`                                                         | `tests/domain.test.ts`                          |
| Technology catalog and stack picker   | `catalog.ts`, `catalog-seed.ts`, `views/Stack.tsx`; radar view retired, old catalog bookmarks redirect to Stack | `tests/api.test.ts`, `e2e/navigation.spec.ts` |
| Compact project navigation and search | `App.tsx` (top-bar search, legacy questions/catalog redirects), `views/Search.tsx`, `Workspace.tsx` (persisted outline toggle), `Overview.tsx` (Sections disclosure) | `search.test.tsx`, `navigation.test.tsx`, `e2e/navigation.spec.ts` |
| Compact exports and actionable readiness | `components/ExportPicker.tsx` (grouped dropdown), `views/Publishing.tsx`, `Readiness.tsx` (grouped blockers, review targets) | `export-picker.test.tsx`, `readiness.test.tsx`, `e2e/navigation.spec.ts`, Storybook |
| Native section conversation and quiet tools | `views/Builder.tsx` (embedded AG-UI conversation), `Workspace.tsx` (Chat/Form), `Interview.tsx` (header actions, folded help), `DocumentPanel.tsx` (preview, collapsed tools), `App.tsx` (inline proposal chat), `Settings.tsx` (AI activity), `components/BackgroundRun.tsx` | `e2e/native-chat.spec.ts`, `e2e/workspace.spec.ts`, `interview-agent.test.tsx`, `document-panel.test.tsx`, `navigation.test.tsx`, `views.stories.tsx` |
| Completeness and readiness            | `completeness.ts`, `domain.ts#readiness`, `views/Overview.tsx`, `views/Readiness.tsx` | `tests/domain.test.ts`                          |
| AI runs and generated UI              | `ai.ts`, `providers.ts`, `generated.ts`, `GeneratedUI.tsx`, `RunActivity.tsx`         | `tests/jobs.test.ts`, `isolation.test.ts`       |
| Repository and document import        | `import-rules.ts`, `import-mapping.ts`, `importer.ts`, `views/ImportView.tsx` (dialog from Overview; legacy import route supported) | `tests/import*.test.ts`, `views/navigation.test.tsx`, `e2e/import.spec.ts` |
| Overview and project integrations     | `views/Overview.tsx` (progressive details), `Settings.tsx`, `components/ProjectIntegrations.tsx` (MCP/connectors, feature gated) | `views/navigation.test.tsx`, `e2e/navigation.spec.ts`, Storybook |
| Git publishing                        | `git.ts`, `publishing.ts`, `views/Publishing.tsx`                                     | `tests/git.test.ts`                             |
| Implementation board and PR status    | `board.ts` (shared and API), `views/Board.tsx` ("Waits for", plan gaps); `.plan/tasks.md` import/export (`— After:` dependencies) | `tests/board.test.ts`, `views/board.test.tsx`, first Playwright journey |
| Task plan from a correct specification | `shared/task-plan.ts` (`breakIntoTasks`: foundations, decisions, epic per component, tests beside requirements, use cases after requirements, gaps; `readyCards`), `api/board.ts` (`createTasks`, `createTasksForBaseline`: baseline approval in `review.ts` creates the board's tasks, never deleting a card), `Card.dependsOn` and `Board.gaps` in `shared/board.ts` | `tests/task-plan.test.ts`, `tests/board.test.ts`, `tests/api.test.ts`, `e2e/workspace.spec.ts` |
| `.plan` folder export and import      | `packages/shared/src/plan-folder.ts` (paths, backlog cards, `board.json`), `apps/api/src/plan-folder.ts`, `components/PlanFolder.tsx` (Publish & handoff) | `tests/plan-folder.test.ts`, `plan-folder.test.tsx`, `integrations.test.tsx`, `e2e/plan-folder.spec.ts` |
| Fixtures                              | `scripts/generate-fixtures.ts`, `fixtures/default-project`, `fixtures/sdd-studio` (+ `.plan.zip`), `planFolderFiles` in `api/exports.ts` | `tests/fixtures.test.ts`, CI `fixtures:check` |
| Lighthouse budgets                    | `scripts/lighthouse.ts` (Playwright-driven Chrome, signed-in views), `lighthouserc.json` (lhci alternative) | CI `e2e` job |
| AI optimisation (AIO)                 | `packages/shared/src/aio.ts` (llms.txt, llms-full.txt, robots, sitemap, JSON-LD, noscript), `api/aio.ts`, `aioHtml` in `vite.config.ts`, nginx location | `tests/aio.test.ts`, `e2e/aio.spec.ts` |
| MCP quality gate                      | `api/mcp.ts` (output schemas, paging, caps, prompts, full tasks resource, `mcpToolCatalog`; task preview capped at 24,000 characters with explicit truncation), `api/mcp-tasks.ts` (read and write the existing project: `plan_tasks` refuses until a baseline is approved, `get_next_tasks`, `import_plan_tasks`, `list_proposals`, the `sdd://project/specification.md` resource, the `break_into_tasks` prompt), `docs/ai-readiness.md` | `tests/mcp-quality.test.ts` (12 rules and full-resource preservation), `tests/mcp.test.ts` |
| Structured use cases                  | `packages/shared/src/use-case.ts` (Markdown in the item body, hints), `components/UseCaseEditor.tsx` (Traceability dialog) | `tests/use-case.test.ts`, `use-case.test.tsx` |
| PRODUCT.md and DESIGN.md per project  | `packages/shared/src/agent-docs.ts`, added to the bundle in `api/exports.ts`; root `PRODUCT.md`/`DESIGN.md` for SDD Studio | `tests/agent-docs.test.ts` |
| JSON and TOON bundles                 | `packages/shared/src/bundle-formats.ts`, `POST /projects/:id/import` (`{ toon }`), `.plan/specification.toon`, Publishing import | `tests/bundles.test.ts`, `fixtures.test.ts` |
| Sidebar icon rail                     | `App.tsx` (auto-collapse 761–1100 px), `style.css` (`.app.collapsed`) | UX tour (tablet) |
| Build with AI: guided interview | `shared/interview.ts` (next question, wrap-ups, answer summaries, bilingual lines), `web/interview-agent.ts` (local AG-UI agent, no model), `components/builder/QuestionCard.tsx` (one card per question kind) and `AnswerRecord.tsx` (folded bubbles, wrap-up choices), `views/Builder.tsx` (CopilotKit, restore, controls), `LiveDocument.tsx` | `tests/interview.test.ts`, `web/interview-agent.test.tsx`, `question-card.test.tsx`, `QuestionCard.stories.tsx`, `e2e/interview.spec.ts` |
| Build with AI: the AI in the conversation | `api/builder-agent.ts` (AG-UI agent, outline, loop), `api/chat-providers.ts` (streaming tool calls), `api/local-extract.ts` (facts and suggestions for models without tools), `shared/builder-tools.ts`, `components/builder/BuilderCards.tsx` | `tests/builder-agent.test.ts`, `components/builder/builder.test.tsx`, `Builder.stories.tsx`, `e2e/builder.spec.ts` |
| Build with AI: answers you can interact with (after CopilotKit's Open Intelligent UI) | `shared/visual-answers.ts` (`show_visual`: comparison, steps, chart as validated data; `parseVisual`, `rankOptions`), `api/builder-agent.ts` (offered with tools, validated, answered at once, never a write), `components/builder/VisualAnswer.tsx` (card), `VisualComparison.tsx`, `VisualSteps.tsx`, `VisualChart.tsx`, `VisualAnswerTool.tsx` (`useVisualAnswers`), `visual-answer.css` (native components: live weights, stepper, bars with a table view; follow-ups are user messages), `views/Builder.tsx` (one hook call). No model HTML or JavaScript is run | `tests/visual-answers.test.ts`, `tests/builder-agent.test.ts`, `visual-answer.test.tsx`, `VisualAnswer.stories.tsx`, `e2e/interactive-answers.spec.ts` |
| Role policy (root and admin) | `shared/role-policy.ts`, `api/role-guard.ts` (invitations, role changes, project members, SSO), audit `role.escalation-denied` | `tests/permissions.test.ts` |
| Example data (remove example projects) | `api/example-data.ts` (provenance `example` of revision 0, admin only, audited), `components/ExampleData.tsx` (Administration) | `tests/example-data.test.ts`, `example-data.test.tsx`, `e2e/example-data.spec.ts` |
| Worker loop                           | `api/worker-loop.ts` (idle wait, error back-off, graceful stop), `worker.ts` wires timers and signals | `tests/worker-loop.test.ts` |
| Minimal path to a correct spec        | `shared/essentials.ts` (the 15 essential questions, `essentialIdsFor` per project type, `specLevels`), `Spec.level` (default `complete`, migration 008), `moduleQuestions` (the one place `required` follows the level), `domain.ts#sectionNeedsReview`/`readiness`, `api/review.ts` (`reviewAll` on baseline approval: reviews, approves and creates tasks atomically), `api/idea-draft.ts` (`POST /projects/:id/draft`: one sentence, or the description, → one AI run for the essentials → a proposal), `components/NewProject.tsx` (Essentials by default), `Overview.tsx` ("Draft the essentials with AI"), `Readiness.tsx` ("Review all and approve"), `Settings.tsx` (level) | `tests/essentials.test.ts`, `tests/minimal-spec.test.ts`, `tests/migrations.test.ts`, `new-project.test.tsx`, `overview-draft.test.tsx`, `readiness.test.tsx`, `e2e/minimal-spec.spec.ts` |
| Apple HIG review and system settings  | `docs/ux-review.md` (findings, deviations), `style.css` (`--control-line` for control edges, `prefers-contrast: more`, phone frame: Dashboard/Settings in the Views menu), `web/appearance.ts` (light/dark follows the system unless chosen), `DESIGN.md` visual rules | `appearance.test.tsx`, UX tour (axe, targets, three widths), `pnpm test:stories` |
| Motion and feel (apple-design: springs, press, materials) | `web/motion.ts` (`spring.ui`/`snappy`/`momentum`, `rubberband`, `project`, `enterFrom`), `components/Splitter.tsx` (rubber-band past limits, springs back with release velocity), `style.css` (`:active` press feedback, dialog enter/exit keyframes on Radix `data-state`, translucent top bar with reduced-transparency fallback, size-aware heading tracking, `.theme-fade`), `appearance.ts#applyTheme`, builder cards and live document on critically damped springs, `VisualSteps` direction of travel; `playwright.config.ts` runs journeys with reduced motion | `motion.test.ts`, `splitter.test.tsx`, `appearance.test.tsx`, UX tour, Storybook a11y |
| Per-task intent and spec              | `scripts/plan-task-docs.ts` → `.plan/tasks/TASK-###/{intent,spec}.md`, CI step | `tests/plan-task-docs.test.ts` |
| User guide                            | `docs/user-guide.md` (update when a page or its main actions change)  | `tests/docs-site.test.ts` |
| Documentation website                 | `scripts/build-docs-site.ts`, `docs/user-guide.md`, `docs/administration.md`, `/docs/` in `app.ts`, nginx, `.github/workflows/docs.yml` | `tests/docs-site.test.ts` |
| Backend performance                   | `scripts/perf.ts`, `scripts/lib/test-server.ts`, `tests/performance.test.ts` | CI `e2e` job |
| Slider and matrix questions           | `template-types.ts` (`range`, `rows`), `markdown.ts` (`matrixOf`, round trip), `AnswerControl.tsx`, `library/structured.ts` (quality.11–12, security.14) | `tests/security-checklist.test.ts`, `rich-controls.test.tsx` |
| Security completeness checklist       | `security-checklist.ts` (15 ASVS/SSDF areas), `components/SecurityChecklist.tsx` (Readiness), `.plan/security-checklist.md` | `tests/security-checklist.test.ts`, `rich-controls.test.tsx` |
| Skill and agent-file exports          | `api/skill-export.ts` (`skillFiles`: valid name for any project, quoted description, contents lists, items split by type, no files for untouched sections, checklist and strictness levels; `maintainSkill`), `agentFiles` in `api/exports.ts` (`/export/skill`, `/export/agents`) | `tests/agent-exports.test.ts`, `tests/skill-audit.test.ts` |
| Skill audit (Anthropic authoring rules) | `shared/skill-audit.ts` (pure rules: name, description, body length, one-level references, contents lists, checklist, fix-and-repeat, volatile facts), `scripts/check-skills.ts` (`pnpm skills:check`, CI), `.claude/skills` and `.agents/skills` kept identical | `tests/skill-audit.test.ts` |
| Workspace dashboard                   | `api/dashboard.ts`, `views/Dashboard.tsx` (sidebar, next to Settings) | `tests/dashboard.test.ts`, `dashboard.test.tsx`, `e2e/dashboard.spec.ts` |
| Helm chart                            | `deploy/helm/sdd-studio`, `scripts/helm-check.ts`, `scripts/k8s-integration.ts` | CI `docker` job |
| Screenshot review (OpenCV, Pillow)    | `scripts/ux/image_tools.py` (crop, zoom, find, sheet, diff, inspect), `scripts/ux/review.py`, `scripts/ux/py.mjs` | `tests/python/test_image_tools.py`, CI `image-tools` job |
| OpenAPI and Swagger UI                | `openapi.ts` (every route needs a `routeDocs` entry)                                  | `tests/openapi.test.ts`                         |
| Guided tour, themes, fonts            | `components/Tour.tsx`, `tour-steps.ts`, `components/KeyboardShortcuts.tsx`, `App.tsx`, `style.css` | `components/components.test.tsx`, `e2e/workspace.spec.ts` |
| Local models (Ollama)                 | `ollama.ts` (window, status), `local-context.ts` (compact context, local format, patch cleaning), `providers.ts`, `components/OllamaStatus.tsx`, `scripts/check-ollama.ts` | `tests/ollama.test.ts`, `jobs.test.ts`, `ollama.test.tsx` |
| NVIDIA NIM provider (free hosted endpoint, self-hosted via `NIM_BASE_URL`) | `nim.ts` (URL rules, chat-model filter), `providers.ts#openaiHost` and `chat-providers.ts#openaiTurn` (one OpenAI-compatible path for OpenAI and NIM), `ai.ts` (`configured`, `endpoint`), `views/Settings.tsx` (provider card), `scripts/check-nim.ts` | `tests/nim.test.ts`, `pnpm nim:check` (needs a key) |
| Administration, search, Google        | `admin.ts`, `search.ts`, `google-auth.ts`                                             | `tests/admin-search.test.ts`                    |
| PostgreSQL persistence and section search | `apps/api/src/postgres.ts` (JSONB, blobs, pgvector), `apps/api/src/search.ts` (permission-filtered full-text and semantic section search) | `tests/search-vector.test.ts`, `tests/migrations.test.ts` |
| Sign-in, sign-up and SSO              | `sso-accounts.ts` (account rules for OIDC and Google), `app.ts` OIDC routes, `google-auth.ts`, `views/Login.tsx` | `tests/sso.test.ts`, `views/login.test.tsx`, Playwright |
| Feature flags (admin switches)        | `feature-flags.ts`, `api/features.ts` (route guard, `requireFeature`), `web/features.tsx`, `FeatureFlags.tsx` | `tests/features.test.ts`, `jobs.test.ts`, `components.test.tsx`, `e2e/governance.spec.ts` |
| Infrastructure as code                | `iac` layer/category in `schema.ts`, `stack.ts`, `library/structured.ts` (delivery.15–19), `import-rules.ts#iacFindings`, seed + migration 006 | `tests/licenses-iac.test.ts`, `migrations.test.ts`, `import-api.test.ts`, `e2e/governance.spec.ts` |
| License rules                         | `licenses.ts`, governance.8–11, `components/LicenseCheck.tsx` (Stack view), `import-rules.ts#licenseRuleFindings`, `scripts/check-licenses.ts` (`pnpm licenses:check`, CI) | `tests/licenses-iac.test.ts`, `components.test.tsx`, `e2e/governance.spec.ts` |
| Secret-file exclusion                 | `import-rules.ts#secretFile` (keys, `.env`, Terraform state/vars, kubeconfig), `git.ts` (never read, for every snapshot) | `tests/isolation.test.ts`, `import-api.test.ts` |
| Icons                                 | `web/icons.ts` (`featureIcons` typed by flag id, `layerIcons`), `components/TechIcon.tsx` (brands, category icons) | `components.test.tsx` |
| Diagrams (Kroki, UML MCP)             | `diagrams.ts`, `diagram-evidence.ts` (revision-bound evidence proposals), `shared/document-diagrams.ts` (recorded facts only), `DiagramBatch.tsx` (explicit missing-diagram batch); accepted diagrams included in `spec.md`, PRODUCT.md and DESIGN.md exports | `tests/document-diagrams.test.ts`, `tests/diagram-evidence.test.ts`, `diagram-batch.test.tsx`, Storybook |
| Metrics, observability and log redaction | `observability.ts` (registry, `metricsSummary`), `/api/metrics` in `app.ts` (`METRICS_TOKEN` or local), `admin-observability.ts`, `components/ObservabilityPanel.tsx` (Admin), `compose.observability.yaml`, `deploy/observability/*` (Prometheus, alerts, Grafana), `scripts/generate-grafana-dashboard.ts` | `tests/observability.test.ts`, `tests/admin-observability.test.ts`, `observability.test.tsx` |
| Container and CI                      | `docker/*.Dockerfile`, `compose.yaml` (+ `compose.split.yaml`, `compose.gpu.yaml`), `.github/workflows/ci.yml` | CI `docker` job, `pnpm smoke:web`               |
| Catalog categories, AWS/Azure, dev tools | `schema.ts#technologyCategories`, `development` layer in `stack.ts`, `catalog-seed.ts`, migration 007 (`syncSeedCategories`) | `tests/migrations.test.ts` |
| Naming conventions and folder layout  | `conventions.ts` (7 languages, case conversion), `components/ConventionsGuide.tsx` (Stack view), `.plan/conventions.md` in the bundle | `tests/conventions.test.ts`, `documents.test.tsx` |
| Document exports (LaTeX, HTML, SVG, PDF) | `document-render.ts`, `overview-image.ts`, `api/exports.ts`, `api/pdf-publisher.ts`, `components/OverviewImage.tsx` (PNG) | `tests/exports.test.ts` |
| Spec Kit workflow and export          | `spec-kit.ts` (phases, statuses, files), `components/SddWorkflow.tsx` (Overview), governance.12–13, `featureEffect` badges | `tests/exports.test.ts`, `documents.test.tsx` |
| OpenSpec exchange and new-work adoption | `shared/openspec-*.ts` (AST parsing, identity mapping, diagnostics, task consistency), `api/openspec.ts`, `OpenSpecExchange.tsx`, `OpenSpecExport.tsx`, `openspec-files.ts`, `scripts/check-openspec.ts`, `docs/openspec.md`; separate reviewed spec and revision-guarded board confirmations | `tests/openspec*.test.ts`, `components/openspec.test.tsx`, `OpenSpec.stories.tsx`, `e2e/openspec.spec.ts`, `pnpm openspec:check` |
| Architecture rules                    | `tests/archunit.test.ts` (ArchUnitTS), `tests/architecture.test.ts`, `scripts/export-architecture-graph.ts` | themselves |
| Local CI (act)                        | `.actrc`, `.act/*.example`, `env.ACT` and `vars.ACT_POSTGRES_PORT` in `ci.yml`, `docs/ci-local.md` | `pnpm ci:local` |
| Coverage                              | `coverage` blocks in `vitest.config.ts` and `vitest.web.config.ts` (thresholds)       | CI `checks` job                                 |
| Effects that need the latest props    | `web/hooks.ts#useLatest` (instead of disabling `exhaustive-deps`)                      | `pnpm lint` (fails on warnings)                 |

## Adding things

- **A question:** add it to the right `library/*.ts` file with `en`/`fr` text and a kind (sliders need `range`, matrices `rows` and `options`), and answer it in `example.ts` (a test fails otherwise). Check `readiness` and `completeness`, and add a stack rule in `stack.ts` if a technology implies the answer.
- **An MCP tool:** follow the 12 rules in `docs/ai-readiness.md` (start the description with "Use …", describe every input, declare an `outputSchema`, set hints), then add it to the safe list in `tests/mcp-quality.test.ts` after review.
- **A public claim:** add it to `features.ts` or the FAQ in `aio.ts`; `llms.txt`, JSON-LD and the no-JavaScript summary follow automatically.
- **A route:** register it in the feature module, add a `routeDocs` entry in `openapi.ts` (the OpenAPI test fails otherwise), enforce the role through `projectFor`, and audit privileged actions. If it belongs to an optional feature, add its pattern to that flag's `routes` in `feature-flags.ts` (the features test checks every pattern matches a real route).
- **An optional feature:** add a flag to `feature-flags.ts` (bilingual label and description, `views`, `routes`), an icon in `featureIcons`, and gate the UI with `useFeatures().on(id)`. Work that does not go through a route (worker jobs, direct calls) must call `requireFeature(id)`.
- **A UI component:** add a story under `apps/web/src/components/*.stories.tsx` and a component test if it has behaviour.
- **A stored field:** update the Zod schema with a default, add a migration, and cover old documents in a test.
