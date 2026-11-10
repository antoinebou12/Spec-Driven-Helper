import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp, type Harness } from './helpers';

/** Role-aware dashboard (TASK-061). */
let h: Harness;
beforeAll(async () => {
  h = await setupApp('dashboard');
});
afterAll(async () => h?.teardown());

describe('dashboard', () => {
  it('shows progress for every readable project and what waits for the owner', async () => {
    const sample = await h.createProject({ name: 'Complete example', sample: true });
    await h.createProject({ name: 'Blank' });
    await h.request('PUT', `/projects/${sample.id}/board`, { expectedRevision: 0, cards: [{ id: 'T-1', title: 'A', column: 'doing' }, { id: 'T-2', title: 'B', column: 'done' }] });
    const res = await h.request('GET', '/dashboard');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const complete = body.projects.find((p: { name: string }) => p.name === 'Complete example');
    const blank = body.projects.find((p: { name: string }) => p.name === 'Blank');
    expect(complete).toMatchObject({ role: 'Owner', canEdit: true, canReview: true, security: 100, board: { doing: 1, done: 1, todo: 0 } });
    expect(complete.completeness).toBeGreaterThan(blank.completeness);
    expect(blank.board).toBeNull();
    expect(body.totals.projects).toBeGreaterThanOrEqual(2);
    expect(body.waiting.sectionsToReview).toBeGreaterThanOrEqual(28);
    expect(body.readOnly).toBe(false);
  });

  it('is read-only for viewers and only lists their projects', async () => {
    const shared = await h.createProject({ name: 'Shared with viewer', sample: true });
    await h.createProject({ name: 'Not shared' });
    const viewer = await h.userWith('Viewer', { projectId: shared.id, role: 'Viewer' });
    const body = (await h.request('GET', '/dashboard', undefined, viewer.cookie)).json();
    expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['Shared with viewer']);
    expect(body.projects[0]).toMatchObject({ role: 'Viewer', canEdit: false, canReview: false });
    expect(body.readOnly).toBe(true);
    expect(body.waiting).toEqual({ proposalsToReview: 0, sectionsToReview: 0, openQuestions: 0, blockers: 0 });
  });

  it('counts review work only for reviewers and editing work only for editors', async () => {
    const p = await h.createProject({ name: 'Roles' });
    const reviewer = await h.userWith('Reviewer', { projectId: p.id, role: 'Reviewer' });
    const editor = await h.userWith('Editor', { projectId: p.id, role: 'Editor' });
    const r = (await h.request('GET', '/dashboard', undefined, reviewer.cookie)).json();
    const e = (await h.request('GET', '/dashboard', undefined, editor.cookie)).json();
    expect(r.waiting.sectionsToReview).toBe(14);
    expect(r.waiting.blockers).toBe(0);
    expect(e.waiting.sectionsToReview).toBe(0);
    expect(e.waiting.blockers).toBeGreaterThan(0);
    expect((await h.app.inject({ method: 'GET', url: '/api/v1/dashboard' })).statusCode).toBe(401);
  });
});
