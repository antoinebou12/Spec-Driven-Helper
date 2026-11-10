import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp, type Harness } from './helpers';

/** Removing example data: only projects created from the example go, with what they own; audit stays. */
let h: Harness;
beforeAll(async () => {
  h = await setupApp('example_data');
});
afterAll(async () => {
  await h?.teardown();
});

describe('example projects', () => {
  it('lists and removes only example projects, with their data, after an explicit confirmation', async () => {
    const example = await h.createProject({ name: 'Example', sample: true });
    const mine = await h.createProject({ name: 'Real work' });
    await h.patch(example.id, 0, { sections: [{ id: 'discovery', answers: { 'discovery.1': { value: 'Edited example', state: 'answered', reason: '' } } }] });
    await h.db.collection('proposals').insertOne({ id: 'p-example', projectId: example.id, status: 'pending' });
    await h.db.collection('jobs').insertOne({ id: 'j-example', projectId: example.id, kind: 'chat', status: 'completed', createdAt: new Date().toISOString() });

    const listed = (await h.request('GET', '/admin/example-projects')).json();
    expect(listed.map((p: { id: string }) => p.id)).toEqual([example.id]);
    expect(listed[0]).toMatchObject({ name: expect.any(String), revision: 1 });

    expect((await h.request('DELETE', '/admin/example-projects', {})).statusCode).toBe(400);
    const res = await h.request('DELETE', '/admin/example-projects', { confirm: true });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ removed: 1 });

    expect(await h.db.collection('projects').countDocuments({ id: example.id })).toBe(0);
    for (const name of ['revisions', 'proposals', 'jobs']) expect(await h.db.collection(name).countDocuments({ projectId: example.id }), name).toBe(0);
    expect(await h.db.collection('projects').countDocuments({ id: mine.id })).toBe(1);
    expect(await h.db.collection('revisions').countDocuments({ projectId: mine.id })).toBe(1);
    expect(await h.db.collection('audit').countDocuments({ action: 'admin.example-projects-removed' })).toBe(1);
    expect((await h.request('GET', '/admin/example-projects')).json()).toEqual([]);
    expect((await h.request('DELETE', '/admin/example-projects', { confirm: true })).json()).toEqual({ removed: 0, projects: [] });
  });

  it('is for administrators only', async () => {
    const editor = await h.userWith('Editor');
    expect((await h.request('GET', '/admin/example-projects', undefined, editor.cookie)).statusCode).toBe(403);
    expect((await h.request('DELETE', '/admin/example-projects', { confirm: true }, editor.cookie)).statusCode).toBe(403);
  });
});
