# SDD Studio — Product

> What we are building and why. Read with [DESIGN.md](DESIGN.md) (how) and [AGENTS.md](AGENTS.md) (how to work in this repository). Task status lives in [.plan/tasks.md](.plan/tasks.md).

## Problem

Teams start building before they agree on what to build. Design knowledge ends up scattered across chats, tickets and people's heads:

- requirements are untestable;
- decisions are unrecorded;
- AI coding agents invent what the documents leave out.

Existing tools are either blank documents (no guidance, no structure) or heavyweight suites (no Git, no agents, no self-hosting).

## Vision

A software design document that is as easy to write as an interview, and as reliable to build from as code. People own every decision. AI helps, but only through proposals that people review.

## Users

| User | Goal | Typical session |
| --- | --- | --- |
| Product owner or architect (Editor) | Turn an idea or an existing repository into a complete specification | Interview, stack, imports, AI proposals |
| Reviewer (tech lead, security) | Approve content with evidence | Proposals, readiness, baselines |
| Developer | Know exactly what to build and how it is verified | Board, `.plan/`, exports, pull requests |
| Coding agent | Implement tasks without guessing | MCP tools, `.plan/`, `AGENTS.md` |
| Administrator | Run it safely on their own infrastructure | Settings, feature flags, observability |
| Viewer | Follow progress | Overview, board (read only) |

## Goals

1. **Guided completeness.** 14 bilingual modules (English and French) that adapt to the project type. Completeness and readiness are measurable.
2. **Evidence before approval.** Requirements link to tests, decisions are ADRs, and approved baselines are immutable.
3. **Safe AI.** AI, imports and agents only propose. Local-only projects never reach the cloud.
4. **Handoff that agents understand.** `.plan/` folders, `PRODUCT.md` and `DESIGN.md`, `AGENTS.md`, JSON and TOON bundles, and MCP.
5. **Self-hosted and observable.** One Docker Compose stack on PostgreSQL, with metrics, dashboards and audit.

## Non-goals

- Replacing the issue tracker or the repository; SDD Studio links to them instead.
- Generating application code: agents do that from the specification.
- Anonymous or public projects. Workspaces are always private; only the product description is public (see [AI readiness](docs/ai-readiness.md)).

## Requirements (summary)

| Area | Must |
| --- | --- |
| Authoring | Interview, Markdown editor with managed answer blocks, diagrams, structured use cases, custom questions |
| Collaboration | Revision-guarded autosave, conflict view, proposals with three-way merge, roles (Owner, Admin, Editor, Reviewer, Viewer) |
| Knowledge | Technology catalog and stack picker with LTS versions, naming conventions, license checks |
| Brownfield | Import repositories and documents by rules or AI, always as proposals |
| Delivery | Readiness, baselines, board from baselines, pull-request status, Git publishing, `.plan` round trip, fixtures |
| Agents | MCP server with a 12-rule quality gate; `llms.txt` for assistants |
| Operations | Feature flags, observability stack, Lighthouse and accessibility budgets |

## Success measures

| Measure | Target |
| --- | --- |
| Example project readiness after the interview | Every required answer recorded; 0 blockers once sections are reviewed |
| Accessibility | WCAG 2.2 AA: axe clean on every view; Lighthouse accessibility at least 95 |
| Performance | Lighthouse performance at least 85; API p95 under 200 ms for reads (see `pnpm perf`) |
| Reliability | No silent overwrite: every stale write returns 409 |
| Agent usefulness | MCP responses under 8 000 tokens by default; every tool passes the quality gate |

## Release status

See [.plan/tasks.md](.plan/tasks.md) for verified work and [.plan/backlog.md](.plan/backlog.md) for what is next.
