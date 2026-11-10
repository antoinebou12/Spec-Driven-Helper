import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import { setupApp, type Harness } from './helpers';

/**
 * TASK-063: PostgreSQL persistence and section search. Full-text and pgvector semantic search with a
 * deterministic fake embedding model, model/dimension consistency, stale-embedding invalidation,
 * local-only rules, permissions, and transaction-safe revisions under concurrent writes.
 */
let h: Harness;
let embedder: FastifyInstance;
const topics = ['security', 'deploy', 'test', 'data', 'user'];
/** One dimension per topic word, plus a bias; `dims` lets a test switch dimensions. */
let dims = topics.length + 1;
const vectorOf = (text: string) => {
  const lower = text.toLowerCase();
  const v = topics.map((t) => (lower.match(new RegExp(t, 'g')) ?? []).length);
  return [...v, 1].concat(Array(Math.max(0, dims - topics.length - 1)).fill(0)).slice(0, dims);
};

beforeAll(async () => {
  embedder = Fastify();
  embedder.post('/api/embed', async (req) => {
    const body = req.body as { model: string; input: string };
    return { model: body.model, embeddings: [vectorOf(body.input)] };
  });
  await embedder.listen({ host: '127.0.0.1', port: 0 });
  process.env.OLLAMA_URL = `http://127.0.0.1:${(embedder.server.address() as AddressInfo).port}`;
  h = await setupApp('search_vector');
});
afterAll(async () => {
  await h?.teardown();
  await embedder?.close();
});

const configure = async (provider: 'ollama' | 'openai', embeddingModel: string) => {
  await h.db.collection('configuration').updateOne({ id: 'runtime' }, { $set: { id: 'runtime', embeddingProvider: provider, embeddingModel } }, { upsert: true });
};
const search = (id: string, q: string, semantic = false, as?: string) => h.request('GET', `/projects/${id}/search?q=${encodeURIComponent(q)}&semantic=${semantic}`, undefined, as);

describe('full-text section search', () => {
  it('finds sections of the project only, with excerpts and ranks', async () => {
    const p = await h.createProject({ name: 'Searchable', sample: true });
    const other = await h.createProject({ name: 'Other' });
    await h.patch(other.id, 0, { sections: [{ id: 'security', answers: { 'security.2': { value: 'Zanzibar secret boundary', state: 'answered', reason: '' } } }] });
    const res = (await search(p.id, 'tenant isolation')).json();
    expect(res.mode).toBe('full-text');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0]).toMatchObject({ section_id: expect.any(String), excerpt: expect.any(String) });
    expect(res.results.every((r: { score: number }, i: number, all: { score: number }[]) => i === 0 || all[i - 1].score >= r.score)).toBe(true);
    expect((await search(p.id, 'Zanzibar')).json().results).toEqual([]);
  });
});

describe('semantic (pgvector) section search', () => {
  it('indexes embeddings and ranks the section closest in meaning', async () => {
    await configure('ollama', 'fake-embed');
    const p = await h.createProject({ name: 'Semantic', sample: true });
    const index = await h.request('POST', `/projects/${p.id}/search/index`, {});
    expect(index.json()).toEqual({ indexed: 14 });
    const res = (await search(p.id, 'security security', true)).json();
    expect(res.mode).toBe('semantic');
    expect(res.results[0].section_id).toBe('security');
    expect(res.results[0].score).toBeGreaterThan(res.results.at(-1).score);
  });

  it('never mixes vectors from another model or dimension', async () => {
    await configure('ollama', 'fake-embed');
    const p = await h.createProject({ name: 'Models', sample: true });
    await h.request('POST', `/projects/${p.id}/search/index`, {});
    await configure('ollama', 'fake-embed-v2');
    expect((await search(p.id, 'security', true)).json().results).toEqual([]);
    await h.request('POST', `/projects/${p.id}/search/index`, {});
    expect((await search(p.id, 'security', true)).json().results.length).toBe(14);
    dims = topics.length + 3; // same model name, different dimension
    try {
      expect((await search(p.id, 'security', true)).json().results).toEqual([]);
    } finally {
      dims = topics.length + 1;
    }
  });

  it('drops the embedding of a section whose text changed until it is indexed again', async () => {
    await configure('ollama', 'fake-embed');
    const p = await h.createProject({ name: 'Stale', sample: true });
    await h.request('POST', `/projects/${p.id}/search/index`, {});
    const spec = (await h.project(p.id)).spec;
    await h.patch(p.id, spec.revision, { sections: [{ id: 'testing', answers: { 'testing.1': { value: 'Rewritten test strategy', state: 'answered', reason: '' } } }] });
    const ids = (await search(p.id, 'test', true)).json().results.map((r: { section_id: string }) => r.section_id);
    expect(ids).not.toContain('testing');
    expect(ids.length).toBe(13);
    await h.request('POST', `/projects/${p.id}/search/index`, {});
    expect((await search(p.id, 'test', true)).json().results.map((r: { section_id: string }) => r.section_id)).toContain('testing');
  });

  it('keeps local-only projects on local embeddings, and respects roles', async () => {
    await configure('openai', 'text-embedding-3-small');
    const local = await h.createProject({ name: 'Local', localOnly: true });
    expect((await search(local.id, 'security', true)).statusCode).toBe(403);
    expect((await h.request('POST', `/projects/${local.id}/search/index`, {})).statusCode).toBe(403);
    await configure('ollama', 'fake-embed');
    const p = await h.createProject({ name: 'Roles', sample: true });
    const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
    const outsider = await h.userWith('Editor');
    expect((await h.request('POST', `/projects/${p.id}/search/index`, {}, viewer.cookie)).statusCode).toBe(403);
    expect((await search(p.id, 'security', false, viewer.cookie)).statusCode).toBe(200);
    expect((await search(p.id, 'security', false, outsider.cookie)).statusCode).toBe(403);
  });
});

describe('transaction-safe revisions on PostgreSQL', () => {
  it('lets exactly one of many concurrent writes from the same revision win', async () => {
    const p = await h.createProject({ name: 'Race' });
    const writes = await Promise.all(
      Array.from({ length: 8 }, (_, i) => h.patch(p.id, 0, { sections: [{ id: 'discovery', answers: { 'discovery.1': { value: `Writer ${i}`, state: 'answered', reason: '' } } }] })),
    );
    const codes = writes.map((w) => w.statusCode).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(7);
    const spec = (await h.project(p.id)).spec;
    expect(spec.revision).toBe(1);
    expect(await h.db.collection('revisions').countDocuments({ projectId: p.id, revision: 1 })).toBe(1);
  });
});
