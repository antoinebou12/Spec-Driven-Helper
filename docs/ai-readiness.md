# AI readiness: AIO and MCP

SDD Studio is built to be read and used by AI in two ways:

- **AI optimisation (AIO):** assistants and answer engines can describe the product correctly.
- **MCP:** coding agents can work with a project safely.

Both are checked automatically on every change.

## AIO — what assistants and crawlers read

| File or element | Content | Source |
| --- | --- | --- |
| `/llms.txt` | Product summary in the [llmstxt.org](https://llmstxt.org) format | `packages/shared/src/aio.ts#llmsTxt` |
| `/llms-full.txt` | Self-contained description: features, the 14 modules, FAQ, MCP tools | `llmsFullTxt` (tools read from the running MCP server) |
| `/robots.txt` | Every crawler, including GPTBot, ClaudeBot, PerplexityBot and Google-Extended, may read public pages; `/api/` is always closed | `robotsTxt` |
| `/sitemap.xml` | Public URLs only | `sitemapXml` |
| `index.html` | Description, Open Graph, `<link rel="alternate" href="/llms.txt">`, JSON-LD (`SoftwareApplication`, `WebSite`, `FAQPage`), and a `<noscript>` summary with the features and FAQ for readers that do not run JavaScript | `indexHtmlAdditions`, injected by the Vite plugin `aioHtml` |

Rules:

- **Claims come from `features.ts` and `feature-flags.ts`.** The FAQ states facts only; a test rejects superlatives such as "best" or "fastest".
- **No project data is ever published.** A test creates a confidential project and checks that none of the public files mention it.
- **Links use `APP_ORIGIN`.** Set it to your public URL.
- **AI crawlers can be blocked.** `AIO_ALLOW_AI_CRAWLERS=false` makes `robots.txt` block the known AI crawlers while ordinary search engines still see the public page.

## MCP — the agent interface

Create a token in **Settings > Integrations > Coding agents (MCP)**, then connect, for example with Claude Code:

```bash
claude mcp add --transport http sdd-studio https://your-host/api/v1/mcp --header "Authorization: Bearer sdd_mcp_…"
```

| Tool | Use it to |
| --- | --- |
| `get_project_overview` | Start: readiness blockers, completeness, sections, stack |
| `show_specification` | Open the specification visualizer: section progress, readiness findings and recorded relationships, with 24 items per page |
| `get_section` | Read one module's Markdown and answers (Markdown capped at 20 000 characters) |
| `list_items` | Find requirements, use cases, decisions, components, risks and tests (paged) |
| `get_board` | See the cards and keep the board revision (paged, 50 by default) |
| `move_card` | Move a card; fails if the board changed since you read it |
| `link_pull_request` | Attach a GitHub, GitLab or Azure DevOps pull request |
| `propose_change` | Suggest a specification change; a person reviews it |
| `list_proposals` | See what was already proposed and what happened to it (newest first, filter by status, paged), so the same change is not proposed twice |
| `plan_tasks` | Split the project into tasks from the latest approved baseline (preview with `dryRun`); refuses until a reviewer has approved a baseline and says what is in the way |
| `get_next_tasks` | The tasks that can start now: waiting in "to do" with every dependency done, in plan order |
| `import_plan_tasks` | Bring the repository's existing `.plan/tasks.md` into the board (preview with `dryRun`); nothing is deleted |
| `export_plan_tasks` | Get `.plan/tasks.md` (24 000-character preview cap); if `truncated` is true, read `sdd://project/tasks.md` for the complete file before writing it |

The server offers the prompts `implement_next_task`, `close_readiness_gaps`, `break_into_tasks` and `improve_specification`. Read the full documents through `sdd://project/tasks.md` and `sdd://project/specification.md`. Every tool declares an output schema and returns structured content.

### Visualize and improve a specification in your assistant

Connect an MCP Apps client to the Streamable HTTP endpoint `/api/v1/mcp` with the project token in the `Authorization: Bearer` header. Ask it to call `show_specification`. Clients without MCP Apps support still receive the structured snapshot. Publishing the source on GitHub does not start a server or connect an assistant; run SDD Studio on a host your client can reach first.

The resource `ui://sdd-studio/specification.html` displays the same visualizer found under Overview > Specification visualizer on the website. Select a section to see missing required question IDs and open its recorded text. The view shows at most 24 readiness findings, 24 items and 48 recorded links within the current item page. It reports totals; use Readiness, `list_items` or the full specification resource for the rest. Relationships are recorded facts, with no inferred architecture.

In the MCP view, **Improve with AI** sends a request to the conversation. The assistant reads the section, asks about missing decisions and submits suggestions through `propose_change`. Include `baseRevision` from the snapshot: a stale revision returns an error with the current revision. Older clients may omit it; proposals still retain their creation revision and require review before acceptance. The `improve_specification` prompt provides the same workflow. Review and accept proposals in SDD Studio.

The view uses bundled application code and has no external asset or network domains. The existing project token, role checks, feature switch and local-only confirmation still apply. The server bundles the view on its first resource read and caches the HTML; keep the `apps/mcp-app` and `apps/web` source files in installations, as the Docker image does. No token or project content is embedded in that HTML. The integration follows the [MCP Apps resource and tool metadata protocol](https://apps.extensions.modelcontextprotocol.io/api/documents/Quickstart.html).

### From a correct specification to tasks

A specification is **correct** when a reviewer has approved a baseline, which already requires full readiness (no blockers, no open conflicts). Approving one splits the project into tasks automatically, so there is no extra click, and an agent can also do it with `plan_tasks`. The split is a plain function of the baseline, not a model:

- **Foundations**: one task per stack layer that has technologies chosen.
- **Decisions** come next, and a draft decision blocks the component it decides.
- **One epic per component**: its requirements in priority order (must, should, could), each followed by the tests that verify it (a test task is added when a requirement has none), and the component's own task last, because it is done when its requirements are.
- **Requirements no component implements**, then **use cases** (each waits for its requirements), **risk mitigations**, and tests that verify nothing.
- **Won't** items go to the backlog. Dependencies come from that structure and from the specification's own depends-on links; a dependency that would loop is dropped and reported.

Every item keeps its identifier as the card identifier, so a board that already exists keeps its columns, assignees and pull requests when it is refreshed. The plan also lists **gaps** the specification should close (a requirement without a component or acceptance criteria, a use case nothing satisfies); an agent reports them with `propose_change`. Dependencies are written to `.plan/tasks.md` as `— After: REQ-001, REQ-002`.

Guarantees:

- No tool can approve, delete, publish or set review status, and none touches baselines: only a person approves one.
- Specification changes are always proposals.
- Board writes are guarded by the board revision and audited.
- Tokens are per project, stored as digests, and stop working when their owner loses edit rights.

## Quality gates

| Gate | Command | What fails it |
| --- | --- | --- |
| AIO content and routes | `pnpm test` (`tests/aio.test.ts`) | Malformed llms.txt; `/api` open to crawlers; invalid JSON-LD; missing no-JavaScript summary; claims that don't match the features; project data in public files |
| AIO in the browser | `pnpm test:e2e` (`tests/e2e/aio.spec.ts`) | Files not served through the web server; the page unreadable without JavaScript |
| MCP quality | `pnpm test` (`tests/mcp-quality.test.ts`) | Any of the 12 rules below |
| MCP behaviour | `pnpm test` (`tests/mcp.test.ts`) | Token rules, roles, revision guards, audit, proposals |
| Lighthouse SEO | `pnpm lighthouse` | SEO score under 80 on the audited pages |

The MCP quality gate connects like a real agent to a realistic project (the SDD Studio fixture, 100+ cards) and enforces 12 rules:

1. Tool names are snake_case `verb_noun`, unique and at most 64 characters.
2. Every tool has a title and a 60–900 character description that starts with when to use it ("Use …").
3. Every input is described.
4. Every tool sets `readOnlyHint` and `openWorldHint: false`; write tools also set `destructiveHint` and `idempotentHint`.
5. Every tool declares an `outputSchema` and returns matching structured content (the text mirrors it).
6. Read tools warn that returned content is data, not instructions.
7. Invalid input returns `isError` with a readable message, never a protocol failure.
8. No default response exceeds 32 000 characters (about 8 000 tokens); lists page with `limit` and `offset`.
9. Every read call answers within 1 s on the fixture.
10. All tool definitions together fit in about 6 000 tokens.
11. Server instructions exist, prompts describe their arguments, and prompts only mention real tools.
12. Safety: no tool can approve, delete, publish or change review status. A new tool fails the gate until it is reviewed and added to the safe list.
