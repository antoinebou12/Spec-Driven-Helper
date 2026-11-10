# Copilot instructions for SDD Studio

Follow [AGENTS.md](../AGENTS.md) at the repository root: layout, commands, invariants and the feature map live there.

Key rules for suggestions:

- TypeScript strict; Zod schemas in `packages/shared/src/schema.ts` are the source of truth for data shapes.
- Specification writes must carry `baseRevision` and go through `saveSpec` or proposals. AI and import output always becomes a proposal.
- Check roles on the server with `projectFor(user, id, action)`. Every new route needs a `routeDocs` entry in `apps/api/src/openapi.ts`.
- User-facing text is bilingual (`en` and `fr`). Controls are keyboard-accessible and meet WCAG 2.2 AA.
- Compare values with `canonicalJson`. Never execute model-generated code, and never force-push.
- The database is PostgreSQL. Do not add MongoDB code.
