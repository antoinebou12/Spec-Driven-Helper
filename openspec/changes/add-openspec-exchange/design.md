# Design

## Context

See proposal.md for motivation. SDD Studio already has specification proposals, revision guards, .plan exchange, board merge rules and grouped exports.

## Goals / Non-Goals

**Goals:** preserve source text, identity and human review; keep imports deterministic and local; expose limitations before confirmation.

**Non-goals:** full in-app OpenSpec lifecycle, automatic synchronization, migrating old tasks, executing uploaded commands, or inferring missing scenarios.

## Decisions

- Use a Markdown AST to delimit requirements and checkbox tasks; code fences and HTML do not execute or become requirements.
- Group linked requirements by specification module, otherwise scope. Export item IDs in headers and a versioned manifest; imported mappings are validated, not trusted as approval.
- Only recorded SHALL/MUST statements and WHEN/THEN scenarios count as complete export content. Draft bundles remain downloadable with diagnostics; the application never claims CLI validation.
- Parse capability snapshots and one explicitly selected change. Match targets by validated ID, stable generated identity or unambiguous title; unresolved or duplicate targets block confirmation.
- Keep specification and board confirmation separate. Proposals preserve source documents. Task imports preserve existing dependencies, assignees and PR links.
- Reuse the import feature switch and add an OpenSpec switch. Role and revision checks stay server-side.
- Pin the CLI as a development dependency and check it in CI. Do not run it on uploaded files in production.
- .plan owns task status. OpenSpec checkboxes mirror only verified completion, with a failing consistency check for drift.

## Risks / Trade-offs

- Arbitrary prose is not necessarily valid OpenSpec: preserve it and report missing structure, rather than fabricate requirements.
- Requirement items lack a module field: use recorded item-ID references in section Markdown or answers, default to scope, and document that mapping. When several sections reference an item, the first canonical module wins.
- ZIP expansion can exhaust memory: cap compressed and expanded input while streaming, plus server-side byte limits.
- The external CLI can evolve: pin 1.14.1 and exercise complete and incomplete fixtures.

## Rollout

Default-enable the OpenSpec feature, independently switchable in Administration. No data migration. Archive this change only after verification and human review.
