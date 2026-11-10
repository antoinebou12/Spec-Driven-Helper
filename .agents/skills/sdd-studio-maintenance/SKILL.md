---
name: sdd-studio-maintenance
description: Guides adding or changing an SDD Studio feature so code, tests, OpenAPI, Storybook, AGENTS.md and the .plan records stay consistent. Use for any feature, fix or migration in this repository.
---

# SDD Studio maintenance

Copy this checklist and tick it off as you work. Skip a step only when it clearly does not apply, and say so in the summary.

```
- [ ] 1. Orient: task ID, feature map row, concurrent edits
- [ ] 2. Shared domain first
- [ ] 3. Stored data
- [ ] 4. API
- [ ] 5. Web
- [ ] 6. Verify, fix and repeat
- [ ] 7. Record
```

## Never bend

The invariants in `AGENTS.md` hold for every change: revision-guarded writes, AI output only as proposals, local-only projects never reach a cloud provider, role checks on the server, English and French for every string, WCAG 2.2 AA, PostgreSQL only. If a task seems to need breaking one, stop and ask.

## Steps

1. **Orient.** Read `.plan/tasks.md` and `.plan/expanded-scope.md` for the task ID, and the matching row of the feature map in `AGENTS.md`. Check for concurrent edits: recent modification times and running `codex` processes.
2. **Shared domain first.** Put logic that does no I/O in `packages/shared/src` and give it unit tests in `tests/domain.test.ts` (or a new `tests/<feature>.test.ts`).
3. **Stored data.** For a new field, add a Zod default in `schema.ts` and a numbered migration in `apps/api/src/migrations.ts`, and test it against an old document.
4. **API.** Enforce roles with `projectFor`, use revision guards for writes, route AI and import output to proposals, audit privileged actions, and add a `routeDocs` entry in `openapi.ts`. Test with `tests/api.test.ts` patterns (`tests/helpers.ts`).
5. **Web.** Use the primitives in `components/ui.tsx`, provide `en`/`fr` strings, keyboard alternatives and visible focus. Add a story and, for behaviour, a component test.
6. **Verify, fix and repeat.** Run every check that applies:
   - `pnpm typecheck` and `pnpm lint`
   - `pnpm test`
   - `pnpm exec vitest run --config vitest.web.config.ts`
   - for UI changes: Storybook with the a11y addon (`pnpm exec storybook build -o storybook-static && pnpm test:stories`), then `pnpm exec playwright test ux-tour` and `pnpm build && pnpm lighthouse`
   - for journeys: `pnpm test:e2e`
   - for packaging changes: `docker build -t sdd-studio:dev .`
   - after changing `.plan/`, the exporters or the example project: `pnpm plan:tasks` and `pnpm fixtures`
   - after changing a skill or the skill export: `pnpm skills:check --strict`
   - `docs/testing.md` lists every layer and where new tests go

   If a check fails, fix the cause and run it again. Do not move on, tick a task or report success while one is red; report a failure you cannot fix together with its output.
7. **Record.**
   - Tick the task in `.plan/tasks.md` only when it is verified.
   - Add an entry to `.plan/changes.md` saying what changed and how it was verified.
   - Move leftovers to `.plan/backlog.md`.
   - Update the `AGENTS.md` feature map, and `docs/` when installation or operations change.

## Use judgement

Naming inside a feature, how much interface copy to write, and which extra tests add value beyond the required layers.
