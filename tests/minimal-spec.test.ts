import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fakeOllama, setupApp, type Harness } from './helpers';
import {
  essentialCount,
  essentialIdsFor,
  essentialQuestionIds,
} from '../packages/shared/src/essentials';

/**
 * The minimal path to a correct specification, end to end through the API: the essentials level, one
 * action for a reviewer to review and approve (which creates the tasks), and one idea in, a draft out.
 */
let h: Harness;
let ollama: Awaited<ReturnType<typeof fakeOllama>>;
let jobs: typeof import('../apps/api/src/jobs');
beforeAll(async () => {
  ollama = await fakeOllama();
  process.env.OLLAMA_URL = ollama.url;
  process.env.OLLAMA_NUM_CTX = '131072';
  h = await setupApp('minimal_spec');
  jobs = await import('../apps/api/src/jobs');
});
afterAll(async () => {
  await h?.teardown();
  await ollama?.close();
});

const answer = (text: string) => ({ value: text, state: 'answered', reason: '' });
const sectionsOf = (ids: readonly string[]) => {
  const bySection = new Map<string, Record<string, unknown>>();
  for (const id of ids)
    bySection.set(id.split('.')[0], {
      ...(bySection.get(id.split('.')[0]) ?? {}),
      [id]: answer(`Answer to ${id}`),
    });
  return [...bySection].map(([id, answers]) => ({ id, answers }));
};
const requirement = {
  id: 'REQ-001',
  type: 'requirement',
  title: 'Sign in',
  status: 'accepted',
  acceptance: 'Within 2 seconds',
};
const test = { id: 'TEST-001', type: 'test', title: 'Sign-in test', status: 'accepted' };
/** A project that has every essential answer of its type and one tested requirement, but no review yet. */
async function essentialsProject(name = 'Minimal', projectType = 'Web application') {
  const p = await h.createProject({ name, level: 'essentials', projectType });
  const patched = await h.patch(p.id, p.revision, {
    sections: sectionsOf(essentialIdsFor(projectType)),
    items: [requirement, test],
    links: [{ id: 'LINK-001', from: 'TEST-001', to: 'REQ-001', kind: 'tests' }],
  });
  expect(patched.statusCode, patched.body).toBe(200);
  return { p, spec: patched.json() };
}
const approve = (projectId: string, body: Record<string, unknown>, as?: string) =>
  h.request('POST', `/projects/${projectId}/baselines`, { note: 'Minimal', ...body }, as);

describe('the essentials level', () => {
  it('is chosen when a project is created, defaults to complete for the API, and changes readiness', async () => {
    const complete = await h.createProject({ name: 'Default' });
    const essentials = await h.createProject({ name: 'Essentials', level: 'essentials' });
    expect([complete.level, essentials.level]).toEqual(['complete', 'essentials']);
    expect((await h.project(complete.id)).readiness.total).toBe(60);
    expect((await h.project(essentials.id)).readiness.total).toBe(15);
    // The example project is complete whatever is asked.
    const sample = await h.createProject({ name: 'Example', sample: true, level: 'essentials' });
    expect(sample.level).toBe('complete');
    expect((await h.request('POST', '/projects', { name: 'Bad', level: 'tiny' })).statusCode).toBe(
      400,
    );
  });

  it('changes with a patch, and loses no answer going to complete and back', async () => {
    const { p, spec } = await essentialsProject('Switch');
    const before = (await h.project(p.id)).readiness;
    expect(before).toMatchObject({ total: 15, complete: 15 });
    const complete = await h.patch(p.id, spec.revision, { level: 'complete' });
    expect(complete.json().level).toBe('complete');
    const after = (await h.project(p.id)).readiness;
    expect(after).toMatchObject({ total: 60, complete: 15 });
    expect(after.ready).toBe(false);
    const back = await h.patch(p.id, complete.json().revision, { level: 'essentials' });
    expect(back.json().level).toBe('essentials');
    expect(
      back.json().sections.flatMap((s: { answers: object }) => Object.keys(s.answers)).length,
    ).toBe(15);
  });

  it('changes with the rest of the project settings in one save, as the Settings page sends it', async () => {
    const { p, spec } = await essentialsProject('Settings save');
    const saved = await h.patch(p.id, spec.revision, {
      name: spec.name,
      description: spec.description,
      projectType: spec.projectType,
      language: spec.language,
      localOnly: false,
      level: 'complete',
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().level).toBe('complete');
    expect((await h.project(p.id)).spec.level).toBe('complete');
  });
});

describe('review all and approve', () => {
  it('reviews the sections that need it, approves the baseline and creates the tasks in one action', async () => {
    const { p, spec } = await essentialsProject('One click');
    // Without it, the sections are still waiting for a review.
    const plain = await approve(p.id, { expectedRevision: spec.revision });
    expect(plain.statusCode).toBe(409);
    expect(plain.json().blockers.filter((b: string) => /review required/.test(b))).toHaveLength(9);

    const done = await approve(p.id, { expectedRevision: spec.revision, reviewAll: true });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json().tasks).toMatchObject({ added: 2 });
    const after = (await h.project(p.id)).spec;
    expect(
      after.sections
        .filter((s: { status: string }) => s.status === 'reviewed')
        .map((s: { id: string }) => s.id),
    ).toEqual([
      'discovery',
      'scope',
      'workflows',
      'architecture',
      'data',
      'security',
      'technology',
      'testing',
      'delivery',
    ]);
    expect(after.sections.filter((s: { status: string }) => s.status !== 'reviewed')).toHaveLength(
      5,
    );
    expect(
      (await h.request('GET', `/projects/${p.id}/board`))
        .json()
        .board.cards.map((c: { id: string }) => c.id),
    ).toEqual(['REQ-001', 'TEST-001']);
    const audits = await h.db.collection('audit').find({ projectId: p.id }).toArray();
    expect(
      audits.filter((a: any) => a.action === 'section.reviewed' && a.details?.via === 'review-all'),
    ).toHaveLength(9);
    expect(audits.some((a: any) => a.action === 'baseline.approved')).toBe(true);
    // The baseline is the revision after the reviews, and it is immutable like any other.
    const baseline = await h.db.collection('baselines').findOne({ projectId: p.id });
    expect(baseline).toMatchObject({ revision: after.revision });
  });

  it('writes nothing when the approval would be refused', async () => {
    const p = await h.createProject({ name: 'Not ready', level: 'essentials' });
    const refused = await approve(p.id, { expectedRevision: p.revision, reviewAll: true });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().blockers.some((b: string) => /required answers remain/.test(b))).toBe(
      true,
    );
    const spec = (await h.project(p.id)).spec;
    expect(spec.revision).toBe(p.revision);
    expect(spec.sections.every((s: { status: string }) => s.status !== 'reviewed')).toBe(true);
    expect(await h.db.collection('baselines').countDocuments({ projectId: p.id })).toBe(0);
  });

  it('is for reviewers, and a stale revision is refused like any write', async () => {
    const { p, spec } = await essentialsProject('Guarded');
    const editor = await h.userWith('Editor', { projectId: p.id, role: 'Editor' });
    expect(
      (await approve(p.id, { expectedRevision: spec.revision, reviewAll: true }, editor.cookie))
        .statusCode,
    ).toBe(403);
    const stale = await approve(p.id, { expectedRevision: spec.revision - 1, reviewAll: true });
    expect(stale.statusCode).toBe(409);
    expect(await h.db.collection('baselines').countDocuments({ projectId: p.id })).toBe(0);
  });

  it('asks a library for its own essentials, not the sign-in and environments of a web application', async () => {
    const kind = 'Library / SDK';
    const wrong = await h.createProject({
      name: 'Wrong list',
      level: 'essentials',
      projectType: kind,
    });
    expect((await h.project(wrong.id)).readiness.total).toBe(essentialCount(kind));
    const answered = await h.patch(wrong.id, wrong.revision, {
      sections: sectionsOf(essentialQuestionIds),
    });
    const refused = await approve(wrong.id, {
      expectedRevision: answered.json().revision,
      reviewAll: true,
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().blockers.some((b: string) => /2 required answers remain/.test(b))).toBe(
      true,
    );

    const { p, spec } = await essentialsProject('Library', kind);
    const done = await approve(p.id, { expectedRevision: spec.revision, reviewAll: true });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json().tasks).toMatchObject({ added: 2 });
    expect((await h.project(p.id)).readiness).toMatchObject({ ready: true, total: 15 });
  });

  it('also works at the complete level, where every section needs its required answers first', async () => {
    const p = await h.createProject({ name: 'Complete refused' });
    const refused = await approve(p.id, { expectedRevision: p.revision, reviewAll: true });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().blockers.some((b: string) => /60 required answers remain/.test(b))).toBe(
      true,
    );
  });
});

describe('one idea in, a draft out', () => {
  const draft = (projectId: string, idea: string, as?: string) =>
    h.request('POST', `/projects/${projectId}/draft`, { idea }, as);
  const chooseModel = () => h.request('PUT', '/integrations/ollama', { model: 'fake-model' });

  it('says why when no AI model is chosen, and writes nothing', async () => {
    await h.db.collection('integrations').deleteMany({});
    const p = await h.createProject({ name: 'No AI', level: 'essentials' });
    const res = await draft(p.id, 'A portal where customers follow their service requests.');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      queued: false,
      reason: expect.stringContaining('No AI model is chosen yet'),
    });
    expect(await h.db.collection('jobs').countDocuments({ projectId: p.id })).toBe(0);
  });

  it('queues one run for the essential questions only, and the result is a proposal for review', async () => {
    await chooseModel();
    const p = await h.createProject({ name: 'Drafted', level: 'essentials' });
    const idea = 'A portal where customers follow their service requests.';
    const res = await draft(p.id, idea);
    expect(res.json()).toMatchObject({ queued: true, questions: 15 });
    ollama.respond({
      title: 'Draft from one sentence',
      patch: {
        sections: [
          {
            id: 'discovery',
            answers: {
              'discovery.1': {
                value: 'Customers cannot follow their requests.',
                state: 'answered',
                reason: '',
              },
              'discovery.4': {
                value: '',
                state: 'unknown',
                reason: 'The sentence does not say who the users are.',
              },
            },
          },
        ],
      },
      assumptions: ['Only the sentence was used.'],
      sources: [],
    });
    expect(await jobs.runOnce()).toBe(true);
    const prompt = ollama.calls
      .at(-1)
      .messages.map((m: { content: string }) => m.content)
      .join('\n');
    expect(prompt).toContain(idea);
    for (const id of essentialQuestionIds) expect(prompt, id).toContain(id);
    expect(prompt).not.toContain('quality.1:');
    const proposals = (await h.request('GET', `/projects/${p.id}/proposals`)).json();
    const list = Array.isArray(proposals) ? proposals : proposals.proposals;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: 'pending', title: 'Draft from one sentence' });
    // Nothing was written: the answers wait for a person.
    expect((await h.project(p.id)).spec.revision).toBe(p.revision);
    expect(
      (await h.db.collection('audit').findOne({ projectId: p.id, action: 'ai.run-queued' }))
        ?.details,
    ).toMatchObject({ purpose: 'draft' });
  });

  it('asks again from the project description, for the essentials of its type, without retyping', async () => {
    await chooseModel();
    const idea = 'A shared library that parses supplier invoices for finance teams.';
    const p = await h.createProject({
      name: 'Again',
      level: 'essentials',
      projectType: 'Library / SDK',
      description: `  ${idea}  `,
    });
    const res = await h.request('POST', `/projects/${p.id}/draft`, {});
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ queued: true, questions: essentialCount('Library / SDK') });
    ollama.respond({
      title: 'Draft from the description',
      patch: {
        sections: [
          {
            id: 'discovery',
            answers: {
              'discovery.1': { value: 'Finance retypes invoices.', state: 'answered', reason: '' },
            },
          },
        ],
      },
      assumptions: [],
      sources: [],
    });
    expect(await jobs.runOnce()).toBe(true);
    const prompt = ollama.calls
      .at(-1)
      .messages.map((m: { content: string }) => m.content)
      .join('\n');
    expect(prompt).toContain(idea);
    expect(prompt).toContain('The project type is Library / SDK.');
    for (const id of essentialIdsFor('Library / SDK')) expect(prompt, id).toContain(`- ${id}:`);
    // A library is not asked how people sign in, nor for its environments.
    expect(prompt).not.toContain('- security.3:');
    expect(prompt).not.toContain('- delivery.1:');
    expect((await h.project(p.id)).spec.revision).toBe(p.revision);
  });

  it('prefers a sentence in the request to the description, and refuses when there is neither', async () => {
    await chooseModel();
    const bare = await h.createProject({ name: 'Bare', level: 'essentials' });
    const none = await h.request('POST', `/projects/${bare.id}/draft`, {});
    expect(none.statusCode).toBe(400);
    expect(none.json().error).toContain('Write a sentence about the project first');
    expect(await h.db.collection('jobs').countDocuments({ projectId: bare.id })).toBe(0);
    // The request's own sentence wins and needs no description.
    expect(
      (await draft(bare.id, 'A portal where customers follow their service requests.')).json(),
    ).toMatchObject({ queued: true });
  });

  it('keeps local-only projects on the local model and explains when there is none', async () => {
    await h.db.collection('integrations').deleteMany({});
    await h.request('PUT', '/integrations/openai', {
      model: 'gpt-x',
      secret: 'sk-not-a-real-key-1234567890',
    });
    const local = await h.createProject({
      name: 'Local only',
      level: 'essentials',
      localOnly: true,
    });
    const res = await draft(local.id, 'A private notes app for the clinic.');
    expect(res.json()).toMatchObject({
      queued: false,
      reason: expect.stringContaining('local-only'),
    });
    expect(await h.db.collection('jobs').countDocuments({ projectId: local.id })).toBe(0);
  });

  it('turns a refusal into an answer, and rejects viewers and empty ideas', async () => {
    await h.db.collection('integrations').deleteMany({});
    await h.request('PUT', '/integrations/ollama', { model: 'fake-model' });
    await h.request('PUT', '/admin/features', { features: { ai: false } });
    try {
      const p = await h.createProject({ name: 'Switch off', level: 'essentials' });
      expect((await draft(p.id, 'An idea long enough to try.')).json()).toMatchObject({
        queued: false,
        reason: expect.stringMatching(/disabled|off/i),
      });
    } finally {
      await h.request('PUT', '/admin/features', { features: { ai: true } });
    }
    const p = await h.createProject({ name: 'Roles', level: 'essentials' });
    const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
    expect((await draft(p.id, 'An idea long enough to try.', viewer.cookie)).statusCode).toBe(403);
    // The route allows 10 requests a minute, and this file asks 9 times: keep it below that.
    expect((await draft(p.id, 'ab')).statusCode).toBe(400);
  });
});
