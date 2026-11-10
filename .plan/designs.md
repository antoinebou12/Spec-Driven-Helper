# Design decisions

## ADR-001 — Canonical structured document

PostgreSQL JSONB stores versioned documents containing structured answers and editable Markdown blocks; pgvector supports semantic section search. This supersedes the original MongoDB choice (TASK-063); no MongoDB runtime or migration is maintained. Markdown changes do not silently rewrite answers. Git is an exchange and publication mechanism; external edits become reviewed proposals.

## ADR-002 — Application boundary

React/Vite + shadcn-style Radix primitives, Monaco and Mermaid in the browser. Fastify owns validation, RBAC and mutations. Shared Zod contracts produce JSON Schema. Durable PostgreSQL-backed jobs run in a separate worker. Self-hosting takes precedence over the Sites hosting starter.

## ADR-003 — Review before application

AI returns a proposal tied to a base revision. Accepted patches use optimistic concurrency. Approved baselines are immutable. Agent sessions have no direct publishing authority.

## ADR-004 — Workspace visual language

Navy navigation rail, neutral document canvas, blue primary actions, precise typography and restrained borders. Interview and document share the main view; progress and references remain visible without marketing content.

## ADR-005 — .plan records

Maintain plan, tasks, backlog, designs and changes on every coherent implementation change. Export the same convention to generated project bundles. Netlift alignment awaits the repository reference.

## ADR-006 - Compact project navigation (2026-09-29)

Keep distinct editing workflows, not duplicate status pages. Retire the radar and Open Questions destinations while preserving catalog data, specification questions and old bookmarks. Place current-project search in the top bar, imports over Overview, and MCP/connectors in Settings. Use native disclosures for optional detail and a grouped select with explicit Download for export formats. Persist outline visibility without leaving empty layout columns. Readiness actions navigate to review targets but do not grant approval or change role checks. TASK-128 through TASK-135 record the acceptance and verification.
