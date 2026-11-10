import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';

export type Harness = Awaited<ReturnType<typeof setupApp>>;

/** Real PostgreSQL, real Fastify app, isolated namespace per test file. */
export async function setupApp(label: string) {
  const dbName = `sdd_test_${label}_${Date.now()}`;
  process.env.DATABASE_NAMESPACE = dbName;
  process.env.BOOTSTRAP_EMAIL = 'test-owner@example.test';
  process.env.BOOTSTRAP_PASSWORD = 'test-only-password-123';
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.LOG_LEVEL ??= 'silent';
  const database = await import('../apps/api/src/db');
  await database.connect();
  await (await import('../apps/api/src/migrations')).migrate();
  const security = await import('../apps/api/src/security');
  await security.bootstrap();
  const app: FastifyInstance = await (await import('../apps/api/src/app')).buildApp();
  const db = database.db;
  const client = database.client;
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'test-owner@example.test', password: 'test-only-password-123' },
  });
  if (login.statusCode !== 200) throw new Error(`Login failed: ${login.body}`);
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const request = (method: string, url: string, payload?: unknown, as = cookie) =>
    app.inject({ method: method as any, url: `/api/v1${url}`, headers: { cookie: as }, payload: payload as any });
  /** Creates a workspace user with a session cookie; optionally adds project membership. */
  const userWith = async (role: string, projectRole?: { projectId: string; role: string }) => {
    const user = { id: crypto.randomUUID(), email: `${crypto.randomUUID()}@example.test`, name: role, role };
    await db.collection('users').insertOne(user);
    if (projectRole)
      await db
        .collection('projects')
        .updateOne({ id: projectRole.projectId }, { $set: { [`members.${user.id}`]: projectRole.role } });
    return { user, cookie: `sdd_session=${await security.session(user.id)}` };
  };
  const createProject = async (payload: Record<string, unknown> = {}) => {
    const res = await request('POST', '/projects', { name: 'Test project', ...payload });
    if (res.statusCode !== 200) throw new Error(res.body);
    return res.json();
  };
  const project = async (id: string) => (await request('GET', `/projects/${id}`)).json();
  const patch = (id: string, expectedRevision: number, body: unknown, as = cookie) =>
    request('PATCH', `/projects/${id}`, { expectedRevision, patch: body }, as);
  const teardown = async () => {
    await app.close();
    if (db.databaseName === dbName) await db.dropDatabase();
    await client.close();
  };
  return { app, db, client, cookie, request, userWith, createProject, project, patch, teardown };
}

/** A fake Ollama-compatible provider whose responses are scripted per test. */
export async function fakeOllama() {
  const script: ((body: any) => Promise<{ status: number; body: unknown }>)[] = [];
  const calls: any[] = [];
  const server = Fastify();
  server.get('/api/tags', async () => ({ models: [{ name: 'fake-model' }] }));
  server.post('/api/chat', async (req, reply) => {
    calls.push(req.body);
    const next = script.shift();
    if (!next) return reply.code(500).send({ error: 'no scripted response' });
    const r = await next(req.body);
    return reply.code(r.status).send(r.body);
  });
  await server.listen({ port: 0, host: '127.0.0.1' });
  const url = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
  return {
    url,
    calls,
    respond: (content: unknown, delayMs = 0) =>
      script.push(async () => {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        return {
          status: 200,
          body: {
            message: { content: typeof content === 'string' ? content : JSON.stringify(content) },
            prompt_eval_count: 100,
            eval_count: 50,
          },
        };
      }),
    fail: (status: number) => script.push(async () => ({ status, body: { error: 'unavailable' } })),
    close: () => server.close(),
  };
}

