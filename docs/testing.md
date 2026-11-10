# Testing SDD Studio

Everything below runs locally and in CI (`.github/workflows/ci.yml`). Tests that touch the database need PostgreSQL with pgvector. With Docker running, `pnpm test` starts one for you with [Testcontainers](https://testcontainers.com/) (`pgvector/pgvector:pg17`, removed after the run; see `tests/setup/postgres-container.ts`). To use an existing database instead, such as the Compose stack on port 5433 or the CI service, set `DATABASE_URL`:

```bash
export DATABASE_URL=postgresql://sdd:sdd-local-development@127.0.0.1:5433/sdd_studio
```

Set `TESTCONTAINERS=0` to require `DATABASE_URL` and never start a container (also the fast way to run a purely in-memory test file: `TESTCONTAINERS=0 pnpm exec vitest run tests/interview.test.ts`).

Each test run uses its own namespace (`sdd_test_*`) and removes it afterwards, so your own data is never touched.

Browser journeys default to ports 5174 (web), 3101 (API) and 11998 (fake Ollama). When another run owns these ports, set `E2E_WEB_PORT`, `E2E_API_PORT` and `E2E_OLLAMA_PORT` to unused ports. Do not terminate someone else's server. The Storybook axe runner requests reduced motion to check settled component colors rather than entrance-animation opacity; the a11y addon remains in error mode.

## The 15 test types

Every type below runs automatically in CI (`.github/workflows/ci.yml`) and locally with the command shown.

| # | Type | What it proves | Command | CI job |
| --- | --- | --- | --- | --- |
| 1 | Static analysis | Types, lint (zero warnings), layer import rules, formatting | `pnpm typecheck`, `pnpm lint` | checks |
| 2 | Unit | Domain rules: patches, merges, readiness, Markdown blocks, board, `.plan`, use cases, bundles | `pnpm test` | checks |
| 3 | Integration | Every API route with real PostgreSQL: roles, stale writes, proposals, imports, exports | `pnpm test` | checks |
| 4 | Contract | OpenAPI covers every route; MCP output schemas match results; bundles round-trip in JSON and TOON | `pnpm test` | checks |
| 5 | Architecture | Slices match `components.puml`; no cycles; naming; ArchUnit rules | `pnpm test` | checks |
| 6 | Security | Every non-public route needs a session; secrets encrypted; SSRF hosts fixed; audit; gitleaks, Trivy, `pnpm audit`, SBOM, licences | `pnpm test`, CI | checks, security |
| 7 | Component | UI controls, dialogs, hooks and API-backed panels in jsdom | `pnpm exec vitest run --config vitest.web.config.ts` | checks |
| 8 | End-to-end | Real user journeys in Chrome: interview → AI → baseline → board → export; conflicts; imports; flags; `.plan` round trip | `pnpm test:e2e` | e2e |
| 9 | Accessibility | axe on every Storybook story and on every view at three widths; WCAG 2.2 target size | `pnpm test:stories`, UX tour | e2e |
| 10 | Visual / UX | Screenshots of every view on desktop, tablet and phone; layout checks; contact sheets and zooms (OpenCV, Pillow) | `pnpm ux:review`, `pnpm ux:test` | e2e, image-tools |
| 11 | Web performance | Lighthouse on the production build (performance, accessibility, best practices, SEO); bundle budgets | `pnpm lighthouse`, `pnpm budgets` | e2e |
| 12 | Backend performance | Load test with latency, throughput and error budgets on realistic data; micro-benchmarks of hot paths | `pnpm perf`, `pnpm test` (`performance.test.ts`) | e2e, checks |
| 13 | Fixtures / golden | Reference projects export and re-import unchanged; generated files (fixtures, per-task `intent.md`/`spec.md`) are current | `pnpm fixtures:check`, `pnpm plan:tasks:check`, `pnpm test` | checks |
| 14 | AI quality | AIO files (llms.txt, JSON-LD, robots), the 12-rule MCP quality gate and the agent-skill rules | `pnpm test`, `pnpm test:e2e`, `pnpm skills:check --strict` | checks, e2e |
| 15 | Smoke / deployment | Container images start and serve the right headers, API and AI files; the Helm chart lints, renders and validates; it installs on Kubernetes (k3s) and signs in through the Service; docs site links resolve | `pnpm smoke:web`, `pnpm helm:check`, `pnpm k8s:test`, `pnpm docs:site` | docker, docs |

Coverage floors (below) apply to types 2–7.

## At a glance

| Layer | What it proves | Command | Where |
| --- | --- | --- | --- |
| Domain | Patches, merges, readiness, Markdown blocks, stack rules, board and `.plan` parsing | `pnpm test` | `tests/domain.test.ts`, `board.test.ts`, `plan-folder.test.ts`, … |
| API integration | Every route with real PostgreSQL: roles, stale writes, proposals, imports, exports, MCP, feature flags | `pnpm test` | `tests/api.test.ts`, `mcp.test.ts`, `features.test.ts`, … |
| Outbound integrations | Connectors, Kroki, pull-request status, publishing, with `fetch` replaced (no network) | `pnpm test` | `tests/integrations.test.ts` |
| Architecture | Layers follow `docs/architecture/components.puml`, no cycles, naming, every route needs a session | `pnpm test` | `tests/architecture.test.ts`, `archunit.test.ts`, `arch-rules.test.ts` |
| Fixtures | The default project and SDD Studio itself export and import as `.plan` folders and zips | `pnpm test`, `pnpm fixtures:check` | `tests/fixtures.test.ts`, `fixtures/` |
| Web components | Controls, dialogs and API-backed panels in jsdom | `pnpm exec vitest run --config vitest.web.config.ts` | `apps/web/src/**/*.test.tsx` |
| Storybook accessibility | Every story in light, dark and French passes axe (WCAG 2.2 AA) | `pnpm exec storybook build -o storybook-static && pnpm test:stories` | `*.stories.tsx` |
| Browser journeys | Real flows in Chrome with axe: interview → AI proposal → baseline → board → export; conflicts; imports; `.plan` round trip; feature flags | `pnpm test:e2e` | `tests/e2e/*.spec.ts` |
| UX tour | Every view on desktop and phone: axe, no sideways scrolling, no off-screen or tiny targets, no errors; screenshots | `pnpm exec playwright test ux-tour` | `tests/e2e/ux-tour.spec.ts` → `test-results/ux/` |
| Screenshot review | Contact sheets, zooms and blank-capture check on the tour screenshots (OpenCV, Pillow); the latest HIG-based review is [ux-review.md](ux-review.md) | `pnpm ux:review` | `scripts/ux/`, `tests/python/` |
| AIO | llms.txt, robots, sitemap, JSON-LD and the no-JavaScript summary: format, truthfulness, privacy; in the browser with JavaScript off | `pnpm test`, `pnpm test:e2e` | `tests/aio.test.ts`, `tests/e2e/aio.spec.ts` |
| MCP quality gate | 12 rules for agent-facing tools: naming, descriptions, described inputs, hints, output schemas, errors, size, speed, context budget, prompts, safety | `pnpm test` | `tests/mcp-quality.test.ts` (see `docs/ai-readiness.md`) |
| Agent skills | Anthropic's skill authoring rules for every skill we keep or generate: valid name and description (third person, says when, no tags), body under 500 lines, references one level deep and linked from `SKILL.md`, a contents list on references over 100 lines, a checklist and a fix-and-repeat step for multi-step skills, no volatile facts; the `.claude` and `.agents` copies stay identical. Skills another tool generates (OpenSpec's, marked `generatedBy`) are listed and skipped: that tool rewrites them and its copies differ per agent on purpose. Also audits any folder: `pnpm skills:check <folder>` | `pnpm skills:check --strict`, `pnpm test` | `tests/skill-audit.test.ts`, `scripts/check-skills.ts`, `packages/shared/src/skill-audit.ts` |
| Lighthouse | Production build: performance ≥ 85, accessibility ≥ 95, best practices ≥ 90, SEO ≥ 80, LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 300 ms on sign-in, overview, specification and board | `pnpm build && pnpm lighthouse` | `scripts/lighthouse.ts` → `lighthouse-report/` |
| Bundle budgets | Size of the JavaScript and CSS the browser downloads | `pnpm build && pnpm budgets` | `scripts/check-budgets.ts` |
| Backend load | Latency (p95), throughput and errors for reads, autosave, export, MCP and public files on the SDD Studio fixture | `pnpm perf` | `scripts/perf.ts` → `perf-report/` |
| Hot-path budgets | Readiness, patches, merges, bundles, `.plan` parsing (median time, linear scaling) | `pnpm test` | `tests/performance.test.ts` |
| Documentation site | Every page builds; internal links, anchors and images resolve | `pnpm docs:site`, `pnpm test` | `tests/docs-site.test.ts` |
| Coverage | Minimum coverage, enforced | `pnpm test:coverage`, `pnpm test:coverage:web` | `coverage/` |

## Coverage floors

The thresholds are floors: a change that lowers coverage below them fails CI. Raise them when coverage grows.

| Suite | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Backend and domain (`vitest.config.ts`) | 90 % | 80 % | 92 % | 90 % |
| Web (`vitest.web.config.ts`) | 80 % | 80 % | 68 % | 80 % |

## Accessibility is checked four ways

1. **Components:** Storybook's a11y addon runs axe on every story in error mode.
2. **Every screen:** the UX tour runs axe on all 12 views, on desktop and on phone.
3. **Journeys:** the main journeys run axe at key steps (workspace, readiness, board, imports).
4. **Lighthouse:** audits the sign-in page and signed-in views with a minimum accessibility score of 95.

The UX tour also enforces WCAG 2.2 target size (24 × 24 px; a label counts for its checkbox) and keeps controls on screen at 390 px wide.

## Fixtures

`fixtures/` holds two reference projects as `.plan` Markdown folders and zips (see `fixtures/README.md`):

- **Default project:** the complete example project (Customer Request Portal), with a board in progress.
- **SDD Studio itself:** this repository analysed by the same import rules users run, with its board read from `.plan/tasks.md` and `.plan/backlog.md`.

Run `pnpm fixtures` after changing `.plan/` or the exporters. `pnpm fixtures:check`, run in CI, fails when the fixtures are stale.

## Adding a test

- **A domain rule:** add a case to the matching `tests/*.test.ts` file; no database is needed.
- **A route:**
  - use `setupApp` from `tests/helpers.ts`, which gives a real app, real PostgreSQL and a signed-in owner;
  - use `userWith(role, …)` for other roles;
  - check the forbidden cases as well as the happy path.
- **An outbound call:** use `stubFetch` in `tests/integrations.test.ts` and assert the URL, the headers and that redirects are refused.
- **A component:** add a `*.test.tsx` next to it, and mock `../api` as in `components/integrations.test.tsx`. Add a story as well.
- **A screen or flow:** add a journey in `tests/e2e/` using `signIn`, `nav` and `expectAccessible` from `tests/e2e/helpers.ts`. New views are picked up by the UX tour once they are added to its `views` list.
