import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { setupApp, type Harness } from './helpers';

/**
 * Outbound integrations (connectors, Kroki, pull-request status) with `fetch` stubbed: each test
 * checks the request SDD Studio would send and how it handles the answer. No network is used.
 */
let h: Harness;
beforeAll(async () => {
  h = await setupApp('integrations');
});
afterAll(async () => h?.teardown());
afterEach(() => vi.restoreAllMocks());

type Call = { url: string; init: RequestInit };
function stubFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    return respond(url, init);
  });
  return calls;
}
const headerOf = (call: Call, name: string) => new Headers(call.init.headers as HeadersInit).get(name);
const approve = async (projectId: string) => {
  const p = await h.project(projectId);
  await h.db.collection('baselines').insertOne({ id: crypto.randomUUID(), projectId, revision: p.spec.revision, spec: p.spec, note: '', approvedBy: 'test', approvedAt: new Date().toISOString() });
};

describe('connectors', () => {
  it('lists connectors, and only project admins configure them with encrypted secrets', async () => {
    const p = await h.createProject();
    const list = (await h.request('GET', `/projects/${p.id}/connectors`)).json();
    expect(list.map((c: { id: string }) => c.id)).toEqual(expect.arrayContaining(['gitlab', 'linear', 'jira', 'notion', 'confluence', 'google-drive', 'figma', 'mcp']));
    expect(list.every((c: { status: string }) => c.status === 'available')).toBe(true);

    const editor = await h.userWith('Editor', { projectId: p.id, role: 'Editor' });
    expect((await h.request('PUT', `/projects/${p.id}/connectors/gitlab`, { secret: 'glpat-secret' }, editor.cookie)).statusCode).toBe(403);
    expect((await h.request('PUT', `/projects/${p.id}/connectors/gitlab`, { secret: 'glpat-secret' })).statusCode).toBe(200);
    const stored = await h.db.collection('connectors').findOne({ projectId: p.id, id: 'gitlab' });
    expect(stored?.secret).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain('glpat-secret');
    expect((await h.request('GET', `/projects/${p.id}/connectors`)).json().find((c: { id: string }) => c.id === 'gitlab').status).toBe('configured');

    // Atlassian sites must be *.atlassian.net over HTTPS, with an account email.
    expect((await h.request('PUT', `/projects/${p.id}/connectors/jira`, { secret: 'x', site: 'https://evil.example', email: 'a@b.test' })).statusCode).toBe(400);
    expect((await h.request('PUT', `/projects/${p.id}/connectors/jira`, { secret: 'x', site: 'https://acme.atlassian.net' })).statusCode).toBe(400);
    // MCP resources only from operator-allowlisted origins.
    expect((await h.request('PUT', `/projects/${p.id}/connectors/mcp`, { secret: 'x', site: 'https://mcp.example' })).statusCode).toBe(400);
    expect((await h.request('PUT', `/projects/${p.id}/connectors/unknown`, { secret: 'x' })).statusCode).toBe(400);
  });

  it('reads each source with its own URL and credentials, as an untrusted proposal', async () => {
    const p = await h.createProject();
    const configure = (id: string, extra: Record<string, string> = {}) => h.request('PUT', `/projects/${p.id}/connectors/${id}`, { secret: `${id}-key`, ...extra });
    for (const id of ['gitlab', 'linear', 'notion', 'google-drive', 'figma']) await configure(id);
    await configure('jira', { site: 'https://acme.atlassian.net', email: 'me@acme.test' });
    await configure('confluence', { site: 'https://acme.atlassian.net', email: 'me@acme.test' });
    const calls = stubFetch(() => new Response('Source text\n```\nrm -rf /\n```'));
    const read = (id: string, reference: string) => h.request('POST', `/projects/${p.id}/connectors/${id}/read`, { reference, sectionId: 'discovery' });

    const gitlab = await read('gitlab', 'group/app:docs/README.md');
    expect(gitlab.statusCode).toBe(200);
    expect(gitlab.json()).toMatchObject({ origin: 'import', status: 'pending', title: 'Import source from gitlab' });
    const markdown = gitlab.json().patch.sections[0].markdown as string;
    expect(markdown).toContain('## Imported source: gitlab');
    // Fences in the source cannot close the code block and inject Markdown.
    expect(markdown).toContain('[code fence]');
    expect(markdown.match(/```/g)).toHaveLength(2);

    for (const [id, ref] of [['linear', 'ENG-1'], ['jira', 'ENG-2'], ['notion', 'page-id'], ['confluence', '123'], ['google-drive', 'doc-id'], ['figma', 'file-key']] as const)
      expect((await read(id, ref)).statusCode, id).toBe(200);

    const byHost = Object.fromEntries(calls.map((c) => [new URL(c.url).host, c]));
    expect(calls[0].url).toBe('https://gitlab.com/api/v4/projects/group%2Fapp/repository/files/docs%2FREADME.md/raw?ref=HEAD');
    expect(headerOf(calls[0], 'PRIVATE-TOKEN')).toBe('gitlab-key');
    expect(headerOf(byHost['api.linear.app'], 'Authorization')).toBe('linear-key');
    expect(JSON.parse(String(byHost['api.linear.app'].init.body)).variables).toEqual({ id: 'ENG-1' });
    expect(headerOf(byHost['api.notion.com'], 'Authorization')).toBe('Bearer notion-key');
    expect(headerOf(byHost['www.googleapis.com'], 'Authorization')).toBe('Bearer google-drive-key');
    expect(headerOf(byHost['api.figma.com'], 'X-Figma-Token')).toBe('figma-key');
    const atlassian = calls.filter((c) => c.url.startsWith('https://acme.atlassian.net/'));
    expect(atlassian.map((c) => new URL(c.url).pathname)).toEqual(['/rest/api/3/issue/ENG-2', '/wiki/api/v2/pages/123']);
    expect(headerOf(atlassian[0], 'Authorization')).toBe(`Basic ${Buffer.from('me@acme.test:jira-key').toString('base64')}`);
    // Redirects are refused so a source cannot bounce the request elsewhere.
    expect(calls.every((c) => c.init.redirect === 'error')).toBe(true);
    // Nothing reached the specification.
    expect((await h.project(p.id)).spec.revision).toBe(0);
  });

  it('refuses bad references, unconfigured connectors, oversized and failing sources', async () => {
    const p = await h.createProject();
    await h.request('PUT', `/projects/${p.id}/connectors/gitlab`, { secret: 'k' });
    stubFetch(() => new Response('x'));
    const read = (id: string, reference: string, sectionId = 'discovery') => h.request('POST', `/projects/${p.id}/connectors/${id}/read`, { reference, sectionId });
    expect((await read('gitlab', 'missing-colon')).statusCode).toBe(400);
    expect((await read('gitlab', 'a:b', 'nope')).statusCode).toBe(400);
    expect((await read('figma', 'key')).json().error).toMatch(/Configure this connector first/);
    vi.restoreAllMocks();
    stubFetch(() => new Response('x'.repeat(1_100_000)));
    expect((await read('gitlab', 'a:b')).statusCode).toBe(413);
    vi.restoreAllMocks();
    stubFetch(() => new Response('down', { status: 500 }));
    expect((await read('gitlab', 'a:b')).statusCode).toBe(502);
  });

  it('creates issues only with explicit confirmation', async () => {
    const p = await h.createProject();
    await h.request('PUT', `/projects/${p.id}/connectors/gitlab`, { secret: 'k' });
    await h.request('PUT', `/projects/${p.id}/connectors/linear`, { secret: 'lin' });
    const calls = stubFetch(() => new Response(JSON.stringify({ web_url: 'https://gitlab.com/g/p/-/issues/1' })));
    const publish = (id: string, extra: Record<string, unknown> = {}) =>
      h.request('POST', `/projects/${p.id}/connectors/${id}/publish`, { destination: 'g/p', title: 'Implement REQ-001', body: 'Details', ...extra });
    expect((await publish('gitlab')).statusCode).toBe(400);
    expect((await publish('gitlab', { confirmed: false })).statusCode).toBe(400);
    expect(calls).toHaveLength(0);
    expect((await publish('gitlab', { confirmed: true })).statusCode).toBe(200);
    expect(calls[0]).toMatchObject({ url: 'https://gitlab.com/api/v4/projects/g%2Fp/issues', init: { method: 'POST' } });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ title: 'Implement REQ-001', description: 'Details' });
    expect((await publish('linear', { confirmed: true })).statusCode).toBe(200);
    expect(JSON.parse(String(calls[1].init.body)).variables.input).toMatchObject({ teamId: 'g/p', title: 'Implement REQ-001' });
    expect((await publish('notion', { confirmed: true })).statusCode).toBe(400);
    const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
    expect((await h.request('POST', `/projects/${p.id}/connectors/gitlab/publish`, { destination: 'g/p', title: 't', body: '', confirmed: true }, viewer.cookie)).statusCode).toBe(403);
  });
});

describe('publishing and starter repository', () => {
  it('queues reports and images only when allowed, and generates a starter from the baseline', async () => {
    const previous = process.env.PUBLISHER_URL;
    delete process.env.PUBLISHER_URL;
    const p = await h.createProject({ sample: true });
    expect((await h.request('GET', `/projects/${p.id}/publishing`)).json()).toMatchObject({ pdfConfigured: false, assets: [] });
    expect((await h.request('POST', `/projects/${p.id}/publishing`, { kind: 'pdf' })).statusCode).toBe(503);
    expect((await h.request('POST', `/projects/${p.id}/publishing`, { kind: 'image' })).statusCode).toBe(400);
    const queued = await h.request('POST', `/projects/${p.id}/publishing`, { kind: 'image', prompt: 'Architecture sketch' });
    expect(queued.statusCode).toBe(200);
    expect(await h.db.collection('jobs').findOne({ id: queued.json().id })).toMatchObject({ kind: 'image', provider: 'openai', status: 'queued' });
    const local = await h.createProject({ localOnly: true });
    expect((await h.request('POST', `/projects/${local.id}/publishing`, { kind: 'image', prompt: 'x' })).statusCode).toBe(400);

    expect((await h.request('GET', `/projects/${p.id}/scaffold`)).statusCode).toBe(409);
    await approve(p.id);
    const starter = await h.app.inject({ method: 'GET', url: `/api/v1/projects/${p.id}/scaffold`, headers: { cookie: h.cookie } });
    expect(starter.statusCode).toBe(200);
    expect(starter.headers['content-type']).toContain('application/zip');
    const zip = await JSZip.loadAsync(starter.rawPayload);
    const names = Object.keys(zip.files);
    expect(names.length).toBeGreaterThan(5);
    expect(names.some((n) => /package\.json$/.test(n))).toBe(true);
    if (previous) process.env.PUBLISHER_URL = previous;
  });
});

describe('Kroki diagrams', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const render = (projectId: string, source = 'graph TD; A-->B', extra: Record<string, unknown> = {}) =>
    h.request('POST', `/projects/${projectId}/diagrams/kroki`, { type: 'mermaid', source, confirm: true, ...extra });

  it('needs a configured endpoint and never renders for local-only projects', async () => {
    const p = await h.createProject();
    await h.db.collection('configuration').deleteMany({ id: 'runtime' });
    expect((await render(p.id)).statusCode).toBe(503);
    await h.db.collection('configuration').updateOne({ id: 'runtime' }, { $set: { id: 'runtime', krokiUrl: 'https://kroki.example' } }, { upsert: true });
    const local = await h.createProject({ localOnly: true });
    expect((await render(local.id)).statusCode).toBe(403);
    expect((await render(p.id, 'x', { confirm: false })).statusCode).toBe(400);
  });

  it('refuses includes and remote resources, renders PNG only, and bounds the response', async () => {
    const p = await h.createProject();
    await h.db.collection('configuration').updateOne({ id: 'runtime' }, { $set: { id: 'runtime', krokiUrl: 'https://kroki.example' } }, { upsert: true });
    for (const source of ['!include https://evil/x.puml', 'A --> B : http://evil', 'skinparam image = x', 'url(file:///etc/passwd)'])
      expect((await render(p.id, source)).statusCode, source).toBe(400);
    const calls = stubFetch(() => new Response(png));
    const ok = await render(p.id);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ mime: 'image/png', data: png.toString('base64') });
    expect(calls[0].url).toBe('https://kroki.example');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ diagram_type: 'mermaid', output_format: 'png' });
    vi.restoreAllMocks();
    stubFetch(() => new Response('<svg/>'));
    expect((await render(p.id)).statusCode).toBe(502);
    vi.restoreAllMocks();
    stubFetch(() => new Response(Buffer.concat([png, Buffer.alloc(2_100_000)])));
    expect((await render(p.id)).statusCode).toBe(413);
  });

  it('needs a configured UML MCP endpoint for UML tools', async () => {
    const p = await h.createProject();
    expect((await h.request('GET', `/projects/${p.id}/diagrams/uml/tools`)).statusCode).toBe(503);
    const local = await h.createProject({ localOnly: true });
    expect((await h.request('GET', `/projects/${local.id}/diagrams/uml/tools`)).statusCode).toBe(403);
  });
});

describe('pull-request status route', () => {
  it('reads statuses for linked pull requests and sends the GitHub token only to its own repository', async () => {
    const p = await h.createProject();
    await h.request('PUT', `/projects/${p.id}/board`, {
      expectedRevision: 0,
      cards: [
        { id: 'T-1', title: 'Own repo', column: 'review', pullRequests: ['https://github.com/acme/app/pull/1'] },
        { id: 'T-2', title: 'Other repo', column: 'todo', pullRequests: ['https://github.com/other/lib/pull/2'] },
      ],
    });
    const { encrypt } = await import('../apps/api/src/security');
    await h.db.collection('git').insertOne({ projectId: p.id, provider: 'github', repository: 'acme/app', branch: 'main', secret: encrypt('ghp-token') });
    const calls = stubFetch((url) =>
      new Response(JSON.stringify(url.includes('/pulls/') && !url.includes('reviews') ? { title: 'PR', state: 'open', draft: false, merged: false, head: { sha: 'abc' } } : url.includes('reviews') ? [] : { check_runs: [] })),
    );
    const res = await h.request('POST', `/projects/${p.id}/board/pull-requests`, {});
    expect(res.statusCode).toBe(200);
    expect(res.json().statuses).toHaveLength(2);
    const own = calls.filter((c) => c.url.includes('/repos/acme/app/'));
    const other = calls.filter((c) => c.url.includes('/repos/other/lib/'));
    expect(own.every((c) => headerOf(c, 'Authorization') === 'Bearer ghp-token')).toBe(true);
    expect(other.every((c) => headerOf(c, 'Authorization') === null)).toBe(true);
  });
});
