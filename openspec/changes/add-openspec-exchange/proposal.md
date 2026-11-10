# OpenSpec Exchange

## Why

Teams using OpenSpec need to exchange reviewed requirements and tasks with SDD Studio without replacing its canonical specification or losing the existing implementation record.

## What Changes

- Add deterministic capability exports with recorded scenarios, project context and diagnostics.
- Preview OpenSpec snapshots and change deltas, then propose specification changes or explicitly import tasks.
- Adopt OpenSpec for new repository work, with .plan task completion checked for consistency.
- Keep the existing navigation, Spec Kit exports and unfinished backlog unchanged.

## Capabilities

### New Capabilities

- `openspec-exchange`: export and safely import OpenSpec files through existing application workflows.
- `planning-consistency`: keep new OpenSpec change tasks aligned with verified .plan records.

### Modified Capabilities

None.

## Impact

Shared Markdown adapters, project API routes, Import and Export controls, developer tooling and documentation. OpenSpec is development-only; no runtime CLI, new database or lifecycle page is introduced.
