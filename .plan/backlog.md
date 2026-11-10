# Backlog

## Open items

- Review of generated UX concept images (TASK-014; the PDF path is verified) and a tested importer for any format other than canonical JSON.
- DOCX import for existing documents (currently Markdown, text and HTML).
- Automatic PR status polling in the worker (currently refreshed on demand and when the board opens).
- Real-time co-editing is out of scope for the core release; conflicts are resolved through the conflict view.
- License findings in readiness: a blocking license finding could become a readiness blocker once teams have tried the Stack view panel (TASK-073).
- License exceptions per project: record an accepted exception (who, why, until when) so a reviewed finding stops showing as "to review".
- IaC environment promotion: questions and board cards per environment (dev → staging → production) beyond the current workflow question (TASK-072).
- Brand icons for Open Policy Agent, Terragrunt, Kyverno, Crossplane, Kustomize, AWS CDK, CloudFormation and Bicep: Simple Icons has none, so they use the category icon.
- Try the MCP server (TASK-043) with a live coding-agent client.
- Run the workflow on GitHub Actions: coverage, the web image smoke test and the act changes have only run locally (TASK-080, 085).
- Try company SSO and Google sign-in against live providers (TASK-090); the account rules and redirects are tested with mocked claims only.
- Better default local model: `gemma2:2b` connects and follows the format but mostly answers "unknown". Measure `qwen2.5:7b` and `llama3.1:8b` with `pnpm ollama:check` and document a recommendation per hardware class (TASK-088).
- A delete or archive route for projects: live checks leave test projects in the workspace (for example "Ollama live check").
- Drive the sign-in hero from a typed availability manifest (TASK-060) so it only lists enabled features.
- Glossary and SEO/AEO metadata for the public pages (TASK-062).
- Stories for remaining views that need live API data (Workspace, Board, Publishing); Overview and Builder have view stories, and exports have a focused component story. Radar and Open Questions views are retired.
- Raise the web coverage floor (55%) by testing more components; views are covered by Playwright only.
- Spec Kit import: read an existing `.specify/` and `specs/` tree back into a proposal (the export exists, TASK-084).
- Split the Monaco editor chunk, which is still over the Vite size warning.
- Feature flags per project (currently workspace-wide) and a scheduled flag change for maintenance windows.
- Setup hints are hidden behind a generic message: the error handler in `app.ts` replaces every 5xx text with "The operation could not be completed", so "Configure an … API key in Settings", "model not available", Kroki, PDF publisher and Google sign-in setup messages never reach the person (found while testing TASK-149). Decide which curated messages may be shown (for example a flag on `HttpError`) and cover it with a test.
- NVIDIA NIM for local-only projects (TASK-149): allow a self-hosted NIM on a private address, so a project that must stay on the operator's network can use it; today local-only means Ollama only, and the address check would need to be a deliberate allow-list.
- Skill evaluations (TASK-151): Anthropic's guide asks for at least three evaluation scenarios per skill and a run on Haiku, Sonnet and Opus (a skill that suits Opus can need more detail for Haiku). `pnpm skills:check` covers the structural rules only. Write three scenarios each for `sdd-studio-maintenance`, `maintain-spec` and the generated project skill (query, files, expected behaviour), run them with the three models, and record what changed.
- Generated skill, diagrams (TASK-152): each section can carry a Mermaid diagram that the skill leaves out; adding it to the section file as a fenced `mermaid` block would give the agent the architecture as text.
- Utility script for `maintain-spec` (TASK-153): the guide prefers a validation script to prose for fragile checks. A script that verifies identifiers, links and traceability in `.plan/` (listed with the packages it needs) would replace the "check, fix and repeat" paragraph with a command; it needs a decision on Node versus no runtime dependency.
- Per-model tool support for NVIDIA NIM: the catalog does not say which models can call tools, so a model without them fails with a hint on its first turn; a remembered capability per model, or the fenced fallback Ollama uses, would avoid that (TASK-149).
- HIG review follow-ups (TASK-170, see `docs/ux-review.md`): move language, theme, display, shortcuts, docs and help into one "More" menu on phones, then raise phone targets to 44 px with a `pointer: coarse` step; stacked rows for the Requirements & decisions table below 560 px; five font-size tokens to replace about 37 sizes in `style.css` and `builder.css` (builder styles with TASK-154/155).
- Found during the HIG review: after opening a project by its address (`#/p/<id>/…`), the top bar names that project while the sidebar's project picker can still show the previously open one.
- Interactive answers, next steps (TASK-173): starter suggestions in an empty conversation ("Compare two databases for this project", "Walk me through the main request", "Chart the latency budget"); a calculator kind with named inputs and a formula from a small fixed set (sum, product, percentage), never model code; keep a visual in the document as a decision record or a diagram when the person accepts it.
- Pointer-based drag with springs (TASK-174): Board and Stack use native HTML5 drag and drop, which cannot follow the pointer 1:1 or hand its release velocity to a spring; a Pointer Events drag with momentum projection (`project()` in `web/motion.ts`) would, keeping the keyboard and menu alternatives. Also: dialogs mounted only while open (New project and others) disappear without their exit animation; keeping them mounted with `open` would let Radix play it.
- Command-line tools as a project type (TASK-168): essentials now follow the seven project types, but a command-line tool is filed as a library or a desktop application; a type of its own would drop screens and the main journey's sign-in step.
- One-page change brief (TASK-166, TASK-167): from an Essentials specification and its task plan, a short Why / What changes / Impact / Tasks document in OpenSpec's proposal and tasks vocabulary, exported through Codex's OpenSpec exchange (TASK-162) once it exists. Not built here so the two do not compete.
- The idea draft shows up only as a pending proposal and a one-line notice (TASK-166): Build with AI could open on it, with Accept all as one reviewed action; and a run that finishes without a usable answer should say so on the project, not only in AI activity.

## Catalog data

Seeded technology versions and support notes reflect the state known in mid-2026. Each entry links to its official source and endoflife.date; reviewers should confirm dates before relying on them.

Do not display planned connectors as connected or claim later capabilities are implemented.

## Prioritization notes (2026-09-28)

- TASK-111 remaining: apply the concise summary/detail pattern to Stack, Providers, Admin and Audit; project detail views and image sizing beyond Overview.
- TASK-113 remaining: consolidate other settings groups and optional destinations. MCP and connectors now live in Settings > Integrations; radar/Open Questions retirement and top-bar search are tracked individually in TASK-130/131/134.
- TASK-115 and TASK-112 remain unstarted: design-system discovery and bulk editing are separate follow-ups to the first navigation/import batch.

The planned tasks TASK-111–125 are captured in `tasks.md` and `expanded-scope.md`. Sequence UX/navigation and import discovery before broader surface additions; complete RBAC and revision semantics before bulk editing, organization hierarchy, inline AI or Teams writes. Define SMTP and 2FA threat/recovery behavior before enabling account security features. Keep AWS starter-stack work deferred, and do not select an OLAP product until data volume, retention, privacy and operations requirements are known.

## UX follow-ups from the 2026-09-28 review (TASK-095)

- Specification outline truncates section names ("Business & disco…", "Architecture & AD…"); consider wrapping or a wider outline.
- Technology stack page is very long (catalog, layers, stack answers, license check, conventions); collapse the license and conventions cards by default.
- The top-bar badge "100% · rev. 0" is cryptic; spell out "100% answered · revision 0" or add a tooltip.
- Views show a bare "Loading…" while a lazy chunk loads; use a skeleton of the view layout.
- `components/Connectors.tsx` is English only (labels, messages, mode names); translate it (AGENTS.md invariant 11).
- Visual regression: `image_tools.py diff` works, but committed baselines would change with every example project name and date; mask dynamic text before gating CI on screenshot diffs.

## New ideas (2026-09-28)

- **Document diagrams (TASK-156):** semantic sequence/deployment/use-case generation using full Markdown context, diagram freshness after edits and opt-in unattended regeneration. Current scope is deterministic evidence maps from canonical answers, explicitly requested and reviewed. Do not claim every repository Markdown file is automatically illustrated.

- **Baseline diff view:** compare two baselines section by section, with changed answers, items and decisions highlighted, for release notes and audits.
- **Traceability graph:** interactive graph of requirements → use cases → components → tests, with gaps (untested requirements, orphan components) shown in colour.
- **Specification linter:** explainable checks for vague requirements ("fast", "user-friendly"), missing units, untestable acceptance criteria; suggestions as proposals.
- **Import OpenAPI and AsyncAPI files** into the Data & APIs module (endpoints, events, schemas) and link them to components.
- **Two-way tracker sync:** board cards to and from Jira, Linear, GitLab and Azure Boards, with conflict rules like the specification's.
- **STRIDE threat model generator** from the architecture and data modules, producing risk items and security requirements as proposals.
- **Project templates:** regulated (HIPAA, PCI DSS, ISO 27001), mobile, data platform, internal tool; each with its own questions and readiness rules.
- **Readiness and completeness trends:** history charts per project; a workspace dashboard for Viewers (part of TASK-061).
- **Presence:** see who is editing which section, to avoid conflicts before they happen.
- **Mermaid diagrams rendered as SVG in the docs site and exports**, without client JavaScript.
- **More languages** beyond English and French, with a translation-completeness test.
- **Cost and capacity estimate** from the stack, non-functional requirements and expected users.

