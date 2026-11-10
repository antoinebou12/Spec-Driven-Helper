# Implementation plan

SDD Studio is a self-hosted TypeScript workspace (React/Vite, Fastify, PostgreSQL with pgvector, durable worker) that turns a project idea into a reviewed, traceable specification, an implementation bundle for coding agents, and a delivery board.

## Delivery gates

1. **Specification workspace** — shared schemas, 14 bilingual adaptive modules, canonical JSON, revision-safe edits with conflict view, interview, Markdown/Monaco, history with diffs, JSON import/export, complete example project.
2. **AI-assisted core** — provider adapters (OpenAI, Anthropic, Ollama, isolated Claude Agent), generated UI, proposal review, traceability, catalog/radar, Mermaid, readiness, Git/GitHub publish and three-way import, implementation bundle.
3. **Guided start and structured input** — drag-and-drop technology stack before the interview, versioned catalog (LTS/latest) with icons, switch and multi-select questions, first-run tour, completeness visuals, AI- and rule-generated questions, font and theme preferences.
4. **Brownfield import** — existing repository and document import, rule-based (visible rules) and AI-assisted, always as proposals.
5. **Delivery** — Kanban board created from the approved baseline, `.plan` task import/export, pull-request progress (GitHub, GitLab, Azure DevOps), MCP server for agent project management, OpenAPI/Swagger UI.
6. **Professional publishing and connectors** — PDF/LaTeX, XML/TOON, image review, scaffolding, GitLab/Linear/Jira/Notion/Confluence/Drive/Figma/MCP connectors (preview today).

## Quality gates

Every feature ships with: domain/unit tests (Vitest), API tests against real PostgreSQL, frontend component tests (Vitest + Testing Library), Storybook stories for new components, Playwright journeys for user-visible flows with axe checks, updated agent instructions (AGENTS.md / CLAUDE.md / Copilot), and updated `.plan` records.

CI runs lint, format check, typecheck, unit/integration tests against PostgreSQL, Playwright, Storybook build, dependency audit and secret scanning.

## Acceptance scenarios (from the product brief)

- Interview in English or French, edit Markdown, accept an AI proposal, approve a baseline, export it. ✅ Playwright
- JSON export/import preserves identifiers and references. ✅ API test
- Unauthorized access, stale edits, unsafe generated UI and secret exposure are rejected. ✅ API/domain tests
- Unavailable providers, malformed output, canceled runs and worker restarts leave no partial accepted changes. ✅ jobs tests
- Conflicting Git edits import without losing either version. ✅ Git test (local bare repository)
- Claude Agent cannot modify the host workspace or bypass review. ✅ policy + fake runner tests
- Radar history, requirement-to-test links, keyboard navigation and accessibility. ✅ API/Playwright
- XML/TOON output and PDF inspection (publishing milestone) — partial; PDF not visually verified.
