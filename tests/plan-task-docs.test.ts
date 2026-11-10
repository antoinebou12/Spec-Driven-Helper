import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allTaskDocs, marker, parseChanges, parseReview, parseScope, parseTasks, taskDocs } from '../scripts/plan-task-docs';

/** Every task in .plan/tasks.md has an intent.md and a spec.md built from the plan's own records. */
describe('plan task documents', () => {
  it('exist for every task and are current (run pnpm plan:tasks)', () => {
    const docs = allTaskDocs();
    expect(docs.length).toBeGreaterThan(100);
    for (const { task, intent, spec } of docs)
      for (const [file, content] of [
        ['intent.md', intent],
        ['spec.md', spec],
      ]) {
        const path = join('.plan/tasks', task.id, file);
        expect(existsSync(path), path).toBe(true);
        const current = readFileSync(path, 'utf8');
        // Hand-edited files (without the marker) are the owner's; generated ones must match.
        if (current.startsWith(marker)) expect(current, path).toBe(content);
      }
  });

  it('reads status, title, notes and area from tasks.md', () => {
    const tasks = parseTasks('## Gate 1\n\n- [x] TASK-001 Tooling: lint. _Verified with `pnpm lint`._\n- [/] TASK-002 Half\n## Gate 2\n- [ ] TASK-003 Later');
    expect(tasks).toEqual([
      { id: 'TASK-001', status: 'done', title: 'Tooling: lint.', notes: 'Verified with `pnpm lint`.', area: 'Gate 1' },
      { id: 'TASK-002', status: 'in-progress', title: 'Half', notes: '', area: 'Gate 1' },
      { id: 'TASK-003', status: 'pending', title: 'Later', notes: '', area: 'Gate 2' },
    ]);
  });

  it('links scope, review rows and change entries, including ranges', () => {
    expect(parseScope('- **TASK-060** Hero page. Sign-in.').get('TASK-060')).toBe('Hero page. Sign-in.');
    expect(parseReview('| 128 | One selector | Component test |').get('TASK-128')).toEqual({ acceptance: 'One selector', verification: 'Component test' });
    const changes = parseChanges('## 2026-09-29 — CHG-029 Review (TASK-128 through TASK-130)\n\n- x\n\n## 2026-09-28 — CHG-022 Things (TASK-061, 062)\n');
    expect(changes.get('TASK-129')).toEqual(['2026-09-29 — CHG-029 Review (TASK-128 through TASK-130)']);
    expect(changes.get('TASK-062')).toEqual(['2026-09-28 — CHG-022 Things (TASK-061, 062)']);
  });

  it('never invents acceptance criteria and names only real evidence', () => {
    const pending = taskDocs({ id: 'TASK-900', status: 'pending', title: 'Something new', notes: '', area: 'Later' });
    expect(pending.spec).toContain('Not recorded. Add acceptance criteria here before changing this task.');
    expect(pending.intent).toContain('Not delivered yet.');
    const done = taskDocs({ id: 'TASK-901', status: 'done', title: 'Search', notes: 'Tests: `tests/search.test.ts`, uses `DATABASE_URL`; `pnpm test`.', area: 'A' });
    expect(done.spec).toContain('- tests/search.test.ts');
    expect(done.spec).toContain('- pnpm test');
    expect(done.spec).not.toContain('- DATABASE_URL');
  });
});
