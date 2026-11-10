# Specification records (.plan)

This folder is generated from an SDD Studio specification and kept in the repository so people and coding agents share one source of truth.

| Path | Purpose |
| --- | --- |
| `specification.json` | Canonical, lossless bundle (`format: sdd-studio`, `version: 1`). Import it into SDD Studio to review changes. |
| `manifest.json` | Revision, generation time and SHA-256 of every exported file. |
| `spec/NN-<module>.md` | One document per specification module. Answer blocks (`<!-- sdd:answer … -->`) mirror structured answers. |
| `diagrams/<module>.mmd` | Mermaid source for module diagrams. |
| `decisions/ADR-###.md` | Architecture decision records. |
| `traceability.md` | Links between requirements, use cases, decisions, components, risks and tests. |
| `readiness.md` | Readiness blockers and warnings at export time. |
| `plan.md` | Scope and delivery plan. |
| `tasks.md` | Implementation tasks with requirement and test identifiers. |
| `backlog.md` | Open questions, unresolved decisions and deferred work. |
| `designs.md` | Design and architecture decisions. |
| `changes.md` | Chronological change record. |

## Rules

- Read `plan.md`, `tasks.md`, `backlog.md`, `designs.md` and `changes.md` before implementation.
- Update every affected record in the same change. Preserve identifiers.
- Edits to `spec/` documents are imported into SDD Studio as proposals and reviewed before they become part of the specification. Never edit `specification.json` by hand.
