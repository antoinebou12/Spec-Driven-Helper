# Expanded scope — 2026-09-27

This supplements the existing plan and preserves its task IDs. New tasks use TASK-060 onward.

## Product and identity

- **TASK-060** Programmatic hero/features page driven by a typed availability manifest; sign-in and sign-up with Google and configurable enterprise OIDC. Secure invitation-only default with administrator-controlled registration.
- **TASK-061** User dashboard, read-only Viewer dashboard, admin configuration, security administration, SSO status, data statistics and performance metrics.
- **TASK-062** Wealthfolio-inspired guide layout with original styling, real app screenshots, clear setup instructions and glossary. Public SEO/AEO metadata, semantic HTML, FAQ structured data, sitemap and private-route exclusions.

## Data and architecture

- **TASK-063** PostgreSQL JSONB canonical persistence and pgvector semantic search, plus permission-filtered full-text search of every document section. Preserve IDs/revisions. Updated 2026-09-28 at the user's request: SDD Studio does not provide MongoDB runtime or data-migration support; legacy data must be transformed outside the application.
- **TASK-064** Structured drag/drop architecture canvas with domains, internal/external systems, frontend/backend containers, long-running tasks, events, cron, queues, DLQs, logic, CRM, technology and design/architecture pattern blocks. Directed edges record origin, destination, data classification and contracts. Provide keyboard alternatives.
- **TASK-065** Kroki rendering and UML MCP drawing actions. User specified `antoieobu12/uml-mcp`; endpoint, credentials and allowed tools must be configurable in the admin page. Verify the repository/tool contract before enabling calls.
- **TASK-066** Document images, custom pages/sections, numbered headings, internal cross-references and external source references. Preserve sequential backend workflows, use cases, edge cases, retry/error paths and data contracts.
- **TASK-067** Rich questionnaire controls: checkbox, switch, slider, choice and matrix. GitHub specification-completeness checklist and related security requirements.

## Engineering and exports

- **TASK-068** Pre-commit hooks, Docker/Helm, container integration tests and architecture/naming/folder-boundary tests (ArchUnit/NetArchTest intent, implemented for TypeScript).
- **TASK-069** Lighthouse, accessibility and performance budgets; SBOM, secret scan, SAST/SCA/DAST and security questionnaire. Interpreted the user's “says” as these security checks.
- **TASK-070** Markdown ZIP, standalone skill and agent instruction files, implementation bundles. Maintain AGENTS.md/CLAUDE.md/Copilot and .plan records for each coherent change.

## Administration, governance and infrastructure (requested 2026-09-27)

- **TASK-071** Feature flags: a workspace Owner/Admin can switch every optional feature on or off from Administration. The server enforces the switch (routes, AI queueing, worker, sign-in options); the client hides the matching views, actions and tour steps.
- **TASK-072** Infrastructure as code as a first-class stack layer: catalog tools, import detection (tools, state backend, cloud providers, policy as code), delivery questions and stack rules.
- **TASK-073** License rules: license families for SPDX expressions, a per-project license policy (governance questions), findings for copyleft, network-copyleft, source-available, commercial and unrecorded licenses, LICENSE-file import, and a CI check of SDD Studio's own dependencies. Guidance, not legal advice.
- **TASK-074** Icon use: one icon per feature and per stack layer, brand icons for the new catalog tools, and category icons wherever technologies appear.
- **TASK-075–077** Separate API and web images, Prometheus metrics with shared log redaction, and the design document (recorded after the fact from earlier work).

## Spec-driven workflow, exports and quality (requested 2026-09-27)

- **TASK-079** Architecture rules (ArchUnitTS) for the backend and frontend, checked in the test suite.
- **TASK-080** Run the CI workflow locally in Docker with act, documented in `docs/ci-local.md`.
- **TASK-081** More catalog categories: AWS and Azure services, search, storage, identity, networking, and a development tools section and stack layer.
- **TASK-082** Naming conventions (snake_case, kebab-case, PascalCase…) and folder structure per language: TypeScript, Python, C#, C++, Java, Go, Rust.
- **TASK-083** Exports as LaTeX, printable HTML, PDF and image (SVG overview, PNG in the browser); better tables in rendered documents.
- **TASK-084** Ideas from github/spec-kit: the phase sequence from constitution to converge in the UI, the specification persistence model, spec of specs with a roadmap, a Spec Kit export, and read-only / read-write effects on optional features.
- **TASK-085–087** Test coverage for backend and frontend, the hook-dependency fixes, the import journey, the web image smoke test and stories for views.

## Local AI, deployment, sign-in and documentation (requested 2026-09-27)

- **TASK-088** Connect to the real Ollama and test it: window-aware requests, a compact context for small models, structured output, safe cleaning of model answers, an admin connection check and a live check script.
- **TASK-089** Better Docker Compose: hardening, health checks, optional profiles for Ollama and the PDF publisher; split-image and GPU variants.
- **TASK-090–091** Sign-in and sign-up pages with a hero, and SSO (Google and company OIDC) on both, with one set of account rules on the server.
- **TASK-092** README badges, hero, documentation index and screenshots.
- **TASK-093** PDF export through a running publisher, found and fixed while checking the `pdf` profile.

## UX, security and operations follow-up (requested 2026-09-28; status in tasks.md)

- **TASK-111–112** Simplify project and page experiences with concise summaries and progressive detail, reduce repeated copy and oversized imagery, and add project detail plus RBAC/revision-guarded bulk workflows.
- **TASK-113–115** Consolidate settings/navigation, enforce optional-page visibility through existing feature flags, assess retiring the technology radar without removing the catalog/stack, streamline import into a focused dialog or guided view, and expose a bilingual design-system index linking Storybook stories, tests and a11y checks.
- **TASK-116** Contextual inline AI assistance for the selected section. Preserve proposal review, RBAC and local-only provider isolation.
- **TASK-117–118** Add optional self-hosted SMTP notifications and 2FA with secure recovery/auditing, then specify and implement the organization → team → project hierarchy without weakening existing Owner/Admin/Editor/Reviewer/Viewer checks. Document defaults and role inheritance.
- **TASK-119** Improve Ollama/model health, capabilities, structured-output handling, errors and operator guidance; use repeatable tests rather than assuming a model is reliable.
- **TASK-120–121** Improve Admin observability for API, AI jobs and ingestion; offer authenticated Grafana access and validated Compose/config exports for Prometheus/Grafana/traces. Define OLAP needs before choosing a product or adding resource-heavy services.
- **TASK-122** Add Microsoft Teams only after the connector contract, scopes, explicit-write semantics and bilingual/feature-flag behavior are tested.
- **TASK-123–124** Add focused frontend/backend/documentation agent skills and deployment/use-case/architecture diagrams with link-checked operating guides.
- **TASK-125** Deferred optional AWS starter-stack design. AWS must not become the default stack or be selected automatically.

First implementation batch: TASK-111 simplifies Overview with progressive detail; TASK-113 moves MCP and connectors into Settings while respecting existing feature flags; TASK-114 opens repository/document import over Overview and preserves direct import links. The remaining scope of partially completed tasks stays open in `tasks.md`.

## Annotated browser review (2026-09-29)

TASK-128 through TASK-135 cover the eight comments individually: grouped export dropdown, actionable Readiness, retirement of radar and Open Questions pages, collapsible Specification and Overview sections, top-bar search, and fuller guides. See [browser-review.md](browser-review.md) for acceptance and verification. The technology catalog and specification questions remain supported. Old page bookmarks must resolve to their replacement; feature flags and API permissions remain enforced.

## Native conversation review (2026-09-29)

- **TASK-144** Comments 1-3: replace the modal AI request path with the existing CopilotKit/AG-UI conversation in the current view. Preserve project/question context, streaming, cancellation, conversation history, local-only provider filtering, feature gates and explicit proposal acceptance. Do not create a second chat engine.
- **TASK-145** Comments 4-5: place question help/example and AI icons in the header, progressively disclose hints/examples/team guidance and remove the duplicate short label. Preserve draft autosave, unknown/not-applicable states, validation and keyboard access in English and French.
- **TASK-146** Comment 1: keep Proposals focused on review. Put durable AI run status/events and cancellation in Settings > AI activity, retaining server permissions and the AI feature switch. Conversation activity remains in the conversation.
- **TASK-147** Comment 6: Specification opens in Chat mode by default. Reuse the local guided interview, answer cards and server AI handoff. Keep an explicit Form mode, outline navigation and document preview. Verify direct editing, proposal acceptance, disabled AI, narrow layouts and accessible controls.

- **TASK-148** Follow-up comments on document header/tools and the crowded workspace: preserve the visible filename/status, default to Preview, collapse the document toolbar, shorten visible controls to one word where meaningful, and retain descriptive accessible names/tooltips and autosave. Verify keyboard expansion, edit/preview switching and mobile overflow.

## NVIDIA NIM provider (2026-10-01)

- **TASK-149** Add `nvidia-nim` beside OpenAI, Anthropic, Ollama and Claude Agent. It speaks the OpenAI chat protocol, so proposals (`generate`), model listing and the streaming tool-calling conversation reuse one OpenAI-compatible path with a different base URL and key. Default host is the free hosted API Catalog; `NIM_BASE_URL` points at a self-hosted NIM (no key needed, URL checked, no embedded credentials). The key is stored like the other provider keys (encrypted, write-only, never returned or logged). NIM is a network provider: local-only projects keep refusing everything except Ollama, even when NIM is self-hosted (private-network NIM for local-only projects is backlog). Hosted free-tier rate limits (429) are retryable.
- **TASK-150** `pnpm nim:check` mirrors `pnpm ollama:check`: lists models, streams one reply and checks one tool call against the real endpoint. It needs a key, so it is the only live verification path and is reported as not run unless someone runs it.

## Skill best practices (2026-10-01)

Source: the video "Everything You Know About Skills IS OUTDATED" (Simon Scrapes), which walks through Anthropic's [skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): content lists on long references, matching instruction strictness to how fragile the task is (degrees of freedom), testing on every model, one-level-deep references (deeper ones get previewed with `head -100`), copyable checklists, validate-and-repeat loops, and explicit dependencies.

- **TASK-151** Make those rules checkable instead of remembered. `shared/skill-audit.ts` returns findings with a severity (errors fail `pnpm skills:check`, CI and the tests; warnings are advice). It applies to this repository's skills and to every skill SDD Studio generates. Testing on Haiku, Sonnet and Opus and writing three evaluations per skill are not automatable here and stay in the backlog.
- **TASK-152** The exported project skill is a product feature, so it must be valid for any project name (a name containing "Claude" or markup produced an invalid skill), keep the description free of volatile facts such as the revision, give every long reference a contents list, avoid references that point to other references, skip files for sections nobody has answered yet, and tell the agent which items are binding (accepted requirements and decisions, security, conventions) and which call for judgement.
- **TASK-153** The two skills that ship with the work (this repository's `sdd-studio-maintenance` and the `maintain-spec` skill inside every export) get the checklist and fix-and-repeat patterns. The `.claude` and `.agents` copies of the repository skill had already drifted apart; the check keeps them identical.

## Document conversation and diagrams (2026-10-01)

- **TASK-154** Repeated outline selections must not append the same question. Navigation is not a skipped answer; reopening a saved answer is explicit. Preserve answer history, review and deterministic next-question logic.
- **TASK-155** The Specification conversation fills its panel at desktop and mobile sizes. Use a compact, readable composer with a useful minimum height, bounded growth and short localized copy. Keep document tools folded and the filename visible.
- **TASK-156** MCP is a renderer, not a Markdown reasoning engine. Produce deterministic evidence maps from recorded answers and section labels, with no invented relationships. A user may request the current section or all missing diagrams; the configured renderer must be allowlisted and read-only. Each successful result becomes a reviewable proposal tied to its source revision. Report per-section failures, retain existing diagrams, and prevent duplicates for unchanged inputs. Accepted diagrams accompany generated specification, product and design documents. Never call external renderers for local-only projects. Deeper semantic diagrams and unattended refresh are separate follow-ups.

## Automatic task breakdown and agent access (2026-10-02)

Request: add MCP to read and write the existing project, and split the project into tasks automatically once the specification is correct.

- **Correct** means a reviewer approved a baseline, which already requires full readiness (no blockers, no open conflicts). Nothing else counts, and an agent can never approve one.
- **TASK-157** One deterministic function, not a model: foundations from the stack, one epic per component, requirements by priority, tests beside what they verify, use cases after their requirements, "won't" in the backlog, and a list of gaps. Every item keeps its identifier as the card identifier, so boards that already exist keep their columns, assignees and pull requests; only grouping, order and `dependsOn` are refreshed. Derived cards (a missing test, a stack setup) have their own identifiers and are marked obsolete, never deleted, when their source disappears.
- **TASK-158** Baseline approval calls the same function and merges the result into the board without deleting anything. A board that changed at the same moment (revision conflict) is retried once; if it still conflicts the approval stands and the Board's refresh action is the way to catch up.
- **TASK-159** MCP additions stay inside the quality gate (names, "Use …" descriptions, hints, output schemas, size budget, no approve/delete/baseline tools): a resource with the whole specification, `list_proposals`, `get_next_tasks`, `import_plan_tasks` (the existing `.plan/tasks.md` into the board, with a preview) and `plan_tasks`. Specification content still changes only through proposals.

## OpenSpec exchange and adoption (2026-10-07)

- **TASK-160** Pin OpenSpec 1.14.1 as a development dependency. Initialize Codex, Claude Code and Copilot without replacing maintenance instructions. Start only `add-openspec-exchange`; do not migrate the existing backlog. Every OpenSpec task references a .plan task and matches its verified completion. CLI structural validation is not implementation verification; archive requires review.
- **TASK-161** Parse Markdown through an AST. Support capability snapshots and selected change deltas (added, modified, removed, renamed); require unambiguous targets and preserve acceptance text. Reject unsafe paths, duplicates after normalization, secret files, oversized input and malformed mappings. Imported instructions remain data.
- **TASK-162** Export stable capability paths with requirement identifiers and recorded scenarios. Include spec.md, PRODUCT.md, DESIGN.md, task handoff and versioned source mapping. Diagnostics precede download; incomplete bundles are draft, never falsely validated. Validate complete fixtures with the pinned CLI.
- **TASK-163** Preview imports without writes. Specification changes become proposals, with revision and role checks. Board imports require a separate explicit action and expected board revision; retain PR links, dependencies and identities. Do not import approval or baseline claims. Enforce feature gates, audit and OpenAPI.
- **TASK-164** Add OpenSpec to existing Import and Export controls, with change selection and concise bilingual diagnostics. Verify keyboard use, responsive layout, component tests, stories and browser journeys; document limits. Full in-app lifecycle and automatic synchronization remain deferred.

## Minimal path to a correct specification (2026-10-07)

Request: make creating a spec minimal. Asked which meaning, the answer was all four: an Essentials level, one idea in and a draft out, fewer clicks to approve, and an OpenSpec-style minimal change.

- **TASK-165** One stored field, one place that follows it. `Spec.level` is `essentials` or `complete` (default `complete`, so every earlier project and the example keep today's bar; migration 008 persists it). `moduleQuestions` is the only place `required` follows the level, so readiness, completeness and the interview change without knowing about it. The 15 essentials are named once in `shared/essentials.ts`; custom questions keep the flag their author gave them. At the essentials level only sections that hold a required question need a review. Nothing is deleted when the level changes. The new-project dialog defaults to Essentials; the API default stays Complete so existing callers do not change.
- **TASK-166** The idea is the "What are you building?" sentence. It becomes the description, and one AI run (through the same checks as any run: feature switch, local-only rule, budgets, provider) drafts only the essential answers as a proposal, with "unknown" where the sentence says nothing. A refusal comes back as an answer with its reason, never as a failure, and nothing is written directly.
- **TASK-167** `reviewAll` on baseline approval reviews every section that needs it and has its required answers, then approves. It checks readiness on the would-be-reviewed specification first, so a refused approval writes nothing. The one-click button appears only when reviews are all that is left.
- **The OpenSpec-style change** is not a separate task. OpenSpec's own "propose" flow (describe what you want, get a proposal with tasks) is the combination of the three above: one sentence, a drafted Essentials specification, one approval, and the tasks. Codex's OpenSpec exchange (TASK-160 to TASK-164) deliberately invents no active change; it will export an Essentials specification like any other. A one-page change brief generated from an Essentials specification could be added there later (backlog).
- **TASK-168** (2026-10-09) The essentials follow the project type through `essentialIdsFor`: swaps only, each to a question that applies to the type and is already required at the complete level, with the same nine sections under review (15 or 16 questions per type).
- **TASK-169** (2026-10-09) The draft can be asked for again from Overview; with no sentence sent, the project description is the sentence. No new stored field.

## Acceptance

- **TASK-175** Publish the existing workspace to `antoinebou12/Spec-Driven-Helper`, preserving its initial license and history. Expose the same interactive specification progress and recorded relationships in Overview and an authenticated MCP Apps resource. Page large responses, retain plain structured content for other clients, and never embed secrets or project data in the HTML. Explicit improvement requests go to the assistant conversation; suggestions remain proposals. Accept a source revision on proposals and refuse stale snapshots. Keep bilingual controls, keyboard access, local-only confirmation, project permissions and the MCP feature gate. Verify protocol contracts, browser interactions, accessibility and existing checks; document the running-server requirement separately from source publication.

Verify database migration without data loss; transaction-safe revisions; RBAC on search/assets/admin; vector model/dimension consistency; Google/OIDC callback/session behavior; reproducible landing content; graph validation and contract direction; renderer network restrictions; guide screenshots; export structure; container/Helm checks; Lighthouse reports and documented budgets. Live credentials and unspecified servers remain explicitly unverified.

## Dependencies and defaults

Keep React/Vite, Fastify, TypeScript, Monaco and the existing UI flows. PostgreSQL is the sole supported SDD Studio database; no MongoDB runtime, service or migration is maintained. Generic OpenTelemetry auto-instrumentation may contain unused MongoDB instrumentation modules; this is not MongoDB database support. Existing external database volumes are not deleted by application changes. Never silently send local-only content to cloud embeddings. Google and enterprise SSO require operator credentials. Netlift reference is still unavailable; preserve current .plan history. Planned work above is not implemented until its task is verified and checked off.
