import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { setupApp, type Harness } from './helpers';
import { applicableQuestions, modules } from '../packages/shared/src/templates';
import { scrubSecrets } from '../apps/api/src/observability';

let h: Harness;
beforeAll(async () => {
  process.env.APP_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:3001';
  h = await setupApp('api');
});
afterAll(async () => h?.teardown());

const answered = (value: string) => ({ value, state: 'answered', reason: '' });

describe('authentication and authorization', () => {
  it('requires authentication and rejects a foreign origin', async () => {
    const p = await h.createProject();
    expect((await h.app.inject(`/api/v1/projects/${p.id}`)).statusCode).toBe(401);
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: h.cookie, origin: 'https://evil.example' },
      payload: { name: 'Rejected' },
    });
    expect(res.statusCode).toBe(403);
  });
  it('accepts the configured local browser origins for login requests', async () => {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:3001']) {
      const response = await h.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin },
        payload: { email: 'missing@example.test', password: 'not-the-password' },
      });
      expect(response.statusCode, origin).toBe(401);
    }
  });
  it('enforces project boundaries and role permissions server-side', async () => {
    const p = await h.createProject();
    const outsider = await h.userWith('Editor');
    expect((await h.request('GET', `/projects/${p.id}`, undefined, outsider.cookie)).statusCode).toBe(403);
    expect((await h.request('GET', '/projects', undefined, outsider.cookie)).json()).toEqual([]);
    const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
    expect((await h.request('GET', `/projects/${p.id}`, undefined, viewer.cookie)).statusCode).toBe(200);
    expect((await h.patch(p.id, 0, { description: 'Denied' }, viewer.cookie)).statusCode).toBe(403);
    const reviewer = await h.userWith('Reviewer', { projectId: p.id, role: 'Reviewer' });
    expect((await h.patch(p.id, 0, { description: 'Denied' }, reviewer.cookie)).statusCode).toBe(403);
    const editor = await h.userWith('Editor', { projectId: p.id, role: 'Editor' });
    const review = await h.request('POST', `/projects/${p.id}/review/discovery`, { expectedRevision: 0 }, editor.cookie);
    expect(review.statusCode).toBe(403);
    // Editors cannot accept decisions by editing them.
    const res = await h.patch(
      p.id,
      0,
      { items: [{ id: 'ADR-001', type: 'decision', title: 'Decision', status: 'accepted' }] },
      editor.cookie,
    );
    expect(res.json().items[0].status).toBe('draft');
    const members = await h.request('POST', `/projects/${p.id}/members`, { email: viewer.user.email, role: 'Editor' }, editor.cookie);
    expect(members.statusCode).toBe(403);
  });
  it('manages workspace roles with owner-only escalation (full matrix in permissions.test.ts)', async () => {
    const admin = await h.userWith('Admin');
    const target = await h.userWith('Viewer');
    expect((await h.request('PUT', `/users/${target.user.id}/role`, { role: 'Editor' }, admin.cookie)).statusCode).toBe(200);
    expect((await h.request('PUT', `/users/${target.user.id}/role`, { role: 'Admin' }, admin.cookie)).statusCode).toBe(403);
    // Nobody changes their own role, not even the owner.
    const owner = await h.db.collection('users').findOne({ role: 'Owner' });
    expect((await h.request('PUT', `/users/${owner!.id}/role`, { role: 'Admin' })).statusCode).toBe(403);
    expect((await h.request('POST', `/users/${target.user.id}/deactivate`, {}, admin.cookie)).statusCode).toBe(200);
    expect((await h.request('GET', '/auth/me', undefined, target.cookie)).statusCode).toBe(401);
  });
});

describe('revision-safe editing', () => {
  it('accepts only one of two concurrent writes and returns a conflict view', async () => {
    const p = await h.createProject();
    const write = (value: string) => h.patch(p.id, 0, { description: value });
    const results = await Promise.all([write('one'), write('two')]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const conflict = results.find((r) => r.statusCode === 409)!.json().conflict;
    expect(conflict.currentRevision).toBe(1);
    expect(conflict.overlapping).toBe(true);
    expect(conflict.conflicts[0].path).toBe('description');
  });
  it('rejects stale writes even when they do not overlap, and says so', async () => {
    const p = await h.createProject();
    await h.patch(p.id, 0, { sections: [{ id: 'discovery', answers: { 'discovery.1': answered('Theirs') } }] });
    const stale = await h.patch(p.id, 0, { sections: [{ id: 'discovery', answers: { 'discovery.2': answered('Mine') } }] });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().conflict).toMatchObject({ overlapping: false, conflicts: [] });
    const current = (await h.project(p.id)).spec;
    expect(current.sections[0].answers['discovery.2']).toBeUndefined();
  });
  it('rejects protected metadata and never grants review status through edits', async () => {
    const p = await h.createProject();
    expect((await h.patch(p.id, 0, { revision: 999 })).statusCode).toBe(400);
    const res = await h.patch(p.id, 0, { sections: [{ id: 'scope', markdown: 'x', status: 'reviewed' }] });
    expect(res.statusCode).toBe(200);
    expect(res.json().sections.every((s: any) => s.status === 'draft')).toBe(true);
  });
  it('records author, provenance and changed paths for every revision', async () => {
    const p = await h.createProject();
    await h.patch(p.id, 0, { description: 'Tracked' });
    const history = (await h.request('GET', `/projects/${p.id}/history`)).json();
    expect(history[0]).toMatchObject({ revision: 1, provenance: { origin: 'manual' }, authorName: 'Workspace owner' });
    expect(history[0].changes).toEqual([{ path: 'description', kind: 'changed' }]);
    const r0 = (await h.request('GET', `/projects/${p.id}/revisions/0`)).json();
    expect(r0.spec.description).toBe('');
  });
});

describe('Markdown and structured answers', () => {
  it('mirrors answers into the document and proposes answers implied by Markdown edits', async () => {
    const p = await h.createProject();
    let spec = (await h.patch(p.id, 0, { sections: [{ id: 'discovery', answers: { 'discovery.1': answered('Original problem') } }] })).json();
    expect(spec.sections[0].markdown).toContain('Original problem');
    // Free-text edits outside answer blocks are plain document edits.
    spec = (await h.patch(p.id, spec.revision, { sections: [{ id: 'discovery', markdown: spec.sections[0].markdown + '\nNotes.' }] })).json();
    expect((await h.request('GET', `/projects/${p.id}/proposals`)).json()).toHaveLength(0);
    const edited = spec.sections[0].markdown.replace('Original problem', 'Problem rewritten in Markdown');
    spec = (await h.patch(p.id, spec.revision, { sections: [{ id: 'discovery', markdown: edited }] })).json();
    expect(spec.sections[0].answers['discovery.1'].value).toBe('Original problem');
    const [proposal] = (await h.request('GET', `/projects/${p.id}/proposals`)).json();
    expect(proposal.origin).toBe('manual');
    expect(proposal.patch.sections[0].answers['discovery.1'].value).toBe('Problem rewritten in Markdown');
    const accepted = await h.request('POST', `/projects/${p.id}/proposals/${proposal.id}/accept`);
    expect(accepted.json().sections[0].answers['discovery.1'].value).toBe('Problem rewritten in Markdown');
  });
});

describe('imports, proposals and round trips', () => {
  it('stages JSON imports as proposals, rejects stale acceptance, and rebases non-overlapping ones', async () => {
    const p = await h.createProject();
    const exported = (await h.request('GET', `/projects/${p.id}/export/json`)).json();
    exported.spec.sections[0].markdown = 'Imported markdown';
    exported.spec.description = 'Imported description';
    const staged = await h.request('POST', `/projects/${p.id}/import`, exported);
    expect(staged.statusCode).toBe(200);
    expect(staged.json().changes.map((c: any) => c.path)).toContain('sections.discovery.markdown');
    expect((await h.project(p.id)).spec.sections[0].markdown).not.toBe('Imported markdown');
    await h.patch(p.id, 0, { description: 'Newer local edit' });
    const accept = () => h.request('POST', `/projects/${p.id}/proposals/${staged.json().id}/accept`);
    const stale = await accept();
    expect(stale.statusCode).toBe(409);
    expect(stale.json().conflict.currentRevision).toBe(1);
    // The import also changes the description, which was edited locally since: overlapping.
    const rebase = await h.request('POST', `/projects/${p.id}/proposals/${staged.json().id}/rebase`);
    expect(rebase.statusCode).toBe(409);
    expect(rebase.json().conflict.conflicts.map((c: any) => c.path)).toContain('description');
  });
  it('rebases and accepts a stale proposal whose fields were not touched since', async () => {
    const p = await h.createProject();
    const exported = (await h.request('GET', `/projects/${p.id}/export/json`)).json();
    exported.spec.sections[1].markdown = 'Imported scope';
    const staged = (await h.request('POST', `/projects/${p.id}/import`, exported)).json();
    await h.patch(p.id, 0, { sections: [{ id: 'quality', diagram: 'graph TD\n  A-->B' }] });
    expect((await h.request('POST', `/projects/${p.id}/proposals/${staged.id}/rebase`)).statusCode).toBe(200);
    const accepted = await h.request('POST', `/projects/${p.id}/proposals/${staged.id}/accept`);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().sections[1].markdown).toBe('Imported scope');
    const history = (await h.request('GET', `/projects/${p.id}/history`)).json();
    expect(history[0].provenance).toMatchObject({ origin: 'import', proposalId: staged.id });
  });
  it('preserves answers, documents, identifiers and references across export and import', async () => {
    const created = await h.createProject({ name: 'Round trip', sample: true });
    const original = (await h.project(created.id)).spec;
    const exported = (await h.request('GET', `/projects/${created.id}/export/json`)).json();
    // Simulate a different workspace receiving the file.
    await h.db.collection('projects').deleteOne({ id: created.id });
    await h.db.collection('revisions').deleteMany({ projectId: created.id });
    const imported = await h.request('POST', '/projects/import', exported);
    expect(imported.statusCode).toBe(200);
    const restored = (await h.project(created.id)).spec;
    for (const key of ['id', 'name', 'items', 'links', 'technologyIds', 'technologyDecisions', 'projectType'])
      expect(restored[key], key).toEqual(original[key]);
    restored.sections.forEach((s: any, i: number) => {
      const o = original.sections[i];
      expect({ ...s, status: undefined }).toEqual({ ...o, status: undefined });
      expect(s.status).toBe('draft');
    });
    expect((await h.request('POST', '/projects/import', exported)).statusCode).toBe(409);
  });
});

describe('review, readiness and baselines', () => {
  it('gates baselines on readiness and keeps approved snapshots immutable and exportable', async () => {
    const p = await h.createProject();
    let spec = (await h.project(p.id)).spec;
    const premature = await h.request('POST', `/projects/${p.id}/baselines`, { expectedRevision: spec.revision, note: 'Too soon' });
    expect(premature.statusCode).toBe(409);
    expect(premature.json().blockers.length).toBeGreaterThan(0);
    spec = (
      await h.patch(p.id, spec.revision, {
        sections: modules.map((m) => ({
          id: m.id,
          answers: Object.fromEntries(
            applicableQuestions(m, 'Web application')
              .filter((q) => q.required)
              .map((q) => [q.id, answered('Verified evidence')]),
          ),
        })),
        items: [
          { id: 'REQ-001', type: 'requirement', title: 'R', status: 'accepted', acceptance: 'Within 2 seconds' },
          { id: 'TEST-001', type: 'test', title: 'T', status: 'accepted' },
        ],
        links: [{ id: 'LINK-001', from: 'TEST-001', to: 'REQ-001', kind: 'tests' }],
      })
    ).json();
    for (const m of modules) {
      const result = await h.request('POST', `/projects/${p.id}/review/${m.id}`, { expectedRevision: spec.revision });
      expect(result.statusCode, m.id).toBe(200);
      spec = result.json();
    }
    expect((await h.project(p.id)).readiness.ready).toBe(true);
    const approved = await h.request('POST', `/projects/${p.id}/baselines`, { expectedRevision: spec.revision, note: 'Verified' });
    expect(approved.statusCode).toBe(200);
    // The specification is correct once a reviewer approves it, so the project is split into tasks at once.
    expect(approved.json().tasks).toMatchObject({ added: 2, obsolete: 0, total: 2, gaps: ['REQ-001 is not implemented by any component.'] });
    const board = (await h.request('GET', `/projects/${p.id}/board`)).json().board;
    expect(board.cards.map((c: any) => [c.id, c.group, c.column])).toEqual([['REQ-001', 'Requirements without a component', 'todo'], ['TEST-001', 'Requirements without a component', 'todo']]);
    expect((await h.db.collection('audit').findOne({ projectId: p.id, action: 'board.generated' }))?.details).toMatchObject({ via: 'baseline', added: 2 });
    await h.patch(p.id, spec.revision, { description: 'Changed after approval' });
    const baseline = await h.db.collection('baselines').findOne({ id: approved.json().id });
    expect(baseline!.spec.description).not.toBe('Changed after approval');
    const exported = await h.request('GET', `/projects/${p.id}/baselines/${approved.json().id}/export/json`);
    expect(exported.json().spec.revision).toBe(spec.revision);
    const zip = await h.request('GET', `/projects/${p.id}/baselines/${approved.json().id}/export/zip`);
    expect(zip.headers['content-type']).toBe('application/zip');
  });
  it('flags items downstream of a change until a reviewer clears them', async () => {
    const p = await h.createProject({ sample: true, name: 'Example' });
    const spec = (await h.project(p.id)).spec;
    const req = spec.items.find((i: any) => i.id === 'REQ-002');
    const changed = (await h.patch(p.id, spec.revision, { items: [{ ...req, acceptance: 'Returns 404 within 200 ms' }] })).json();
    expect(changed.items.find((i: any) => i.id === 'TEST-002').needsReview).toBe(true);
    const editor = await h.userWith('Editor', { projectId: p.id, role: 'Editor' });
    const denied = await h.request('POST', `/projects/${p.id}/items/TEST-002/review`, { expectedRevision: changed.revision }, editor.cookie);
    expect(denied.statusCode).toBe(403);
    const cleared = await h.request('POST', `/projects/${p.id}/items/TEST-002/review`, { expectedRevision: changed.revision });
    expect(cleared.json().items.find((i: any) => i.id === 'TEST-002').needsReview).toBe(false);
  });
});

describe('catalog, radar and guidance', () => {
  it('keeps server-maintained radar movement history', async () => {
    const id = crypto.randomUUID();
    const entry = {
      id,
      name: 'Deno',
      version: '2',
      quadrant: 'Platforms',
      ring: 'Assess',
      owner: 'Platform',
      rationale: 'Evaluate',
      license: 'MIT',
      support: '',
      tags: [],
      alternatives: [],
      references: [],
      reviewDate: '2027-01-01',
      decisionIds: [],
      history: [{ ring: 'Adopt', at: '2000-01-01', by: 'forged' }],
    };
    await h.request('PUT', `/catalog/${id}`, entry);
    await h.request('PUT', `/catalog/${id}`, { entry: { ...entry, ring: 'Trial' }, note: 'Pilot succeeded' });
    await h.request('PUT', `/catalog/${id}`, { ...entry, ring: 'Trial', rationale: 'No move' });
    const stored = (await h.request('GET', '/catalog')).json().find((t: any) => t.id === id);
    expect(stored.history.map((x: any) => x.ring)).toEqual(['Assess', 'Trial']);
    expect(stored.history[1].note).toBe('Pilot succeeded');
    expect(stored.history.some((x: any) => x.by === 'forged')).toBe(false);
  });
  it('lists the IaC tools and accepts the iac category and layer for team entries', async () => {
    const catalog = (await h.request('GET', '/catalog')).json();
    const iac = catalog.filter((t: any) => t.category === 'iac').map((t: any) => t.name);
    expect(iac).toEqual(expect.arrayContaining(['Terraform', 'OpenTofu', 'Pulumi', 'Helm', 'Ansible']));
    const id = crypto.randomUUID();
    const entry = {
      id,
      name: 'Spacelift',
      version: '',
      category: 'iac',
      layers: ['iac'],
      quadrant: 'Tools',
      ring: 'Assess',
      owner: 'Platform',
      license: 'Commercial',
      rationale: 'Evaluate for drift detection',
      support: '',
      tags: [],
      alternatives: [],
      references: [],
      reviewDate: '2027-01-01',
      decisionIds: [],
      history: [],
    };
    expect((await h.request('PUT', `/catalog/${id}`, entry)).statusCode).toBe(200);
    expect((await h.request('GET', '/catalog')).json().find((t: any) => t.id === id)).toMatchObject({ category: 'iac', layers: ['iac'] });
    expect((await h.request('PUT', `/catalog/${crypto.randomUUID()}`, { ...entry, category: 'terraform-ish' })).statusCode).toBe(400);
  });
  it('lets administrators add team guidance to modules and questions', async () => {
    const res = await h.request('PUT', '/guidance/security.2', { text: 'Use the STRIDE worksheet in Confluence.' });
    expect(res.statusCode).toBe(200);
    expect((await h.request('PUT', '/guidance/unknown.9', { text: 'x' })).statusCode).toBe(404);
    const viewer = await h.userWith('Viewer');
    expect((await h.request('PUT', '/guidance/security', { text: 'x' }, viewer.cookie)).statusCode).toBe(403);
    expect((await h.request('GET', '/guidance', undefined, viewer.cookie)).json()[0].key).toBe('security.2');
  });
});

describe('secrets and operations', () => {
  it('encrypts provider and Git secrets and never returns them', async () => {
    const res = await h.request('PUT', '/integrations/openai', { model: 'test-model', secret: 'sk-not-a-real-api-key-123456' });
    expect(res.statusCode).toBe(200);
    const stored = await h.db.collection('integrations').findOne({ id: 'openai' });
    expect(stored!.secret).not.toContain('sk-not-a-real');
    const list = await h.request('GET', '/integrations');
    expect(list.body).not.toContain('sk-not-a-real');
    expect(list.body).not.toContain(stored!.secret);
    const p = await h.createProject();
    await h.request('PUT', `/projects/${p.id}/git`, { provider: 'github', repository: 'acme/spec', token: 'ghp_notarealtoken1234567890abcd' });
    const git = await h.request('GET', `/projects/${p.id}/git`);
    expect(git.body).not.toContain('ghp_');
    const audit = JSON.stringify(await h.db.collection('audit').find().toArray());
    expect(audit).not.toContain('sk-not-a-real');
    expect(audit).not.toContain('ghp_notarealtoken');
    expect(scrubSecrets('token ghp_abcdefghijklmnopqrstuv and https://user:pass@host/x')).not.toMatch(/ghp_|pass@/);
  });
  it('blocks cloud providers for local-only projects', async () => {
    const p = await h.createProject({ localOnly: true });
    const res = await h.request('POST', `/projects/${p.id}/jobs`, { provider: 'openai', model: 'x', prompt: 'Test' });
    expect(res.statusCode).toBe(403);
  });
  it('exposes health and local-only metrics', async () => {
    expect((await h.app.inject('/api/health')).json()).toEqual({ status: 'ok' });
    const metrics = await h.app.inject({ url: '/api/metrics', remoteAddress: '127.0.0.1' });
    expect(metrics.body).toContain('sdd_http_requests_total');
    expect((await h.app.inject({ url: '/api/metrics', remoteAddress: '10.0.0.8' })).statusCode).toBe(403);
  });
});
