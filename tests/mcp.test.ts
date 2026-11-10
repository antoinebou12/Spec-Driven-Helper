import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { randomBytes } from 'node:crypto';
import { digest } from '../apps/api/src/security';
import { setupApp, type Harness } from './helpers';

let h: Harness;
let base: string;
beforeAll(async () => {
  h = await setupApp('mcp');
  await h.app.listen({ host: '127.0.0.1', port: 0 });
  base = `http://127.0.0.1:${(h.app.server.address() as AddressInfo).port}`;
});
afterAll(async () => h?.teardown());

async function connect(token: string) {
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/api/v1/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return client;
}
const text = (result: any) => result.content[0].text as string;
const data = (result: any) => {
  expect(result.isError, text(result)).toBeFalsy();
  return JSON.parse(text(result));
};
const newToken = async (projectId: string, as?: string, body: Record<string, unknown> = {}) =>
  h.request('POST', `/projects/${projectId}/mcp/tokens`, { name: 'Claude Code', ...body }, as);
const approve = async (projectId: string) => {
  const p = await h.project(projectId);
  await h.db.collection('baselines').insertOne({ id: crypto.randomUUID(), projectId, revision: p.spec.revision, spec: p.spec, note: '', approvedBy: 'test', approvedAt: new Date().toISOString() });
};

describe('MCP tokens', () => {
  it('are created by project admins, shown once, stored as digests and revocable', async () => {
    const p = await h.createProject();
    const editor = await h.userWith('Editor', { projectId: p.id, role: 'Editor' });
    expect((await newToken(p.id, editor.cookie)).statusCode).toBe(403);
    const created = await newToken(p.id);
    expect(created.statusCode).toBe(200);
    const { token, id } = created.json();
    expect(token).toMatch(/^sdd_mcp_[a-f0-9]{64}$/);
    const listed = (await h.request('GET', `/projects/${p.id}/mcp/tokens`)).json();
    expect(listed.tokens).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(token.slice(8));
    expect(listed.tokens[0]).not.toHaveProperty('digest');
    const stored = await h.db.collection('mcpTokens').findOne({ id });
    expect(stored?.digest).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain(token);

    const client = await connect(token);
    await client.close();
    expect((await h.request('DELETE', `/projects/${p.id}/mcp/tokens/${id}`)).statusCode).toBe(200);
    await expect(connect(token)).rejects.toThrow();
    expect((await h.request('GET', `/projects/${p.id}/mcp/tokens`)).json().tokens).toHaveLength(0);
  });

  it('need explicit confirmation for local-only projects', async () => {
    const p = await h.createProject({ localOnly: true });
    const refused = await newToken(p.id);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().requiresConfirmation).toBe(true);
    expect((await newToken(p.id, undefined, { confirmLocalOnly: true })).statusCode).toBe(200);
  });

  it('reject missing, malformed and unknown tokens, and stop working when the owner loses edit rights', async () => {
    const noToken = await fetch(`${base}/api/v1/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{}' });
    expect(noToken.status).toBe(401);
    await expect(connect('sdd_mcp_' + '0'.repeat(64))).rejects.toThrow();
    await expect(connect('not-a-token')).rejects.toThrow();
    expect((await fetch(`${base}/api/v1/mcp`)).status).toBe(405);

    const p = await h.createProject();
    const admin = await h.userWith('Editor', { projectId: p.id, role: 'Admin' });
    const { token } = (await newToken(p.id, admin.cookie)).json();
    (await connect(token)).close();
    await h.db.collection('projects').updateOne({ id: p.id }, { $set: { [`members.${admin.user.id}`]: 'Viewer' } });
    await expect(connect(token)).rejects.toThrow();
  });
});

describe('MCP tools', () => {
  it('lists the project tools with read-only hints', async () => {
    const p = await h.createProject();
    const client = await connect((await newToken(p.id)).json().token);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['export_plan_tasks', 'get_board', 'get_next_tasks', 'get_project_overview', 'get_section', 'import_plan_tasks', 'link_pull_request', 'list_items', 'list_proposals', 'move_card', 'plan_tasks', 'propose_change', 'show_specification']);
    for (const name of ['get_next_tasks', 'list_proposals']) expect(tools.find((t) => t.name === name)?.annotations?.readOnlyHint, name).toBe(true);
    for (const name of ['plan_tasks', 'import_plan_tasks']) expect(tools.find((t) => t.name === name)?.annotations, name).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    expect(tools.find((t) => t.name === 'get_section')?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === 'move_card')?.annotations?.readOnlyHint).toBe(false);
    await client.close();
  });

  it('reads the specification of the token project only', async () => {
    const p = await h.createProject({ name: 'Agent readable', sample: true });
    const other = await h.createProject({ name: 'Other project' });
    const client = await connect((await newToken(p.id)).json().token);
    const overview = data(await client.callTool({ name: 'get_project_overview', arguments: {} }));
    expect(overview).toMatchObject({ id: p.id, name: 'Agent readable', level: 'complete' });
    const minimal = await h.createProject({ name: 'Agent readable essentials', level: 'essentials' });
    const essentialsClient = await connect((await newToken(minimal.id)).json().token);
    expect(data(await essentialsClient.callTool({ name: 'get_project_overview', arguments: {} }))).toMatchObject({ level: 'essentials' });
    await essentialsClient.close();
    expect(overview.sections).toHaveLength(14);
    expect(JSON.stringify(overview)).not.toContain(other.id);
    const section = data(await client.callTool({ name: 'get_section', arguments: { sectionId: 'discovery' } }));
    expect(section.questions.length).toBeGreaterThan(3);
    expect(section.markdown).toContain('sdd:answer');
    const requirements = data(await client.callTool({ name: 'list_items', arguments: { type: 'requirement' } }));
    expect(requirements.items.every((i: { type: string }) => i.type === 'requirement')).toBe(true);
    const bad = await client.callTool({ name: 'get_section', arguments: { sectionId: 'nope' } });
    expect(bad.isError).toBe(true);
    await client.close();
  });

  it('moves cards and links pull requests with revision guards and audit', async () => {
    const p = await h.createProject({ sample: true });
    await approve(p.id);
    await h.request('POST', `/projects/${p.id}/board/generate`, { expectedRevision: 0 });
    const client = await connect((await newToken(p.id)).json().token);
    const board = data(await client.callTool({ name: 'get_board', arguments: {} }));
    const cardId = board.cards[0].id;
    const moved = data(await client.callTool({ name: 'move_card', arguments: { cardId, column: 'doing', expectedRevision: board.revision } }));
    expect(moved).toMatchObject({ revision: board.revision + 1, card: { column: 'doing' } });
    const stale = await client.callTool({ name: 'move_card', arguments: { cardId, column: 'done', expectedRevision: board.revision } });
    expect(stale.isError).toBe(true);
    expect(text(stale)).toContain('currentRevision');
    const linked = data(await client.callTool({ name: 'link_pull_request', arguments: { cardId, url: 'https://github.com/acme/app/pull/3', expectedRevision: moved.revision } }));
    expect(linked.card.pullRequests).toEqual(['https://github.com/acme/app/pull/3']);
    const foreign = await client.callTool({ name: 'link_pull_request', arguments: { cardId, url: 'https://evil.example/pull/1', expectedRevision: linked.revision } });
    expect(foreign.isError).toBe(true);
    const plan = await client.callTool({ name: 'export_plan_tasks', arguments: {} });
    expect(text(plan)).toContain(`- [/] ${cardId} `);
    const audits = await h.db.collection('audit').find({ projectId: p.id, action: 'board.card-moved' }).toArray();
    expect(audits.some((a: any) => a.details?.via === 'mcp')).toBe(true);
    await client.close();
  });

  it('turns specification changes into pending proposals and never writes directly', async () => {
    const p = await h.createProject();
    const client = await connect((await newToken(p.id)).json().token);
    const before = (await h.project(p.id)).spec.revision;
    const result = data(
      await client.callTool({
        name: 'propose_change',
        arguments: {
          title: 'Record the problem statement',
          rationale: 'Found in the repository README.',
          patch: { sections: [{ id: 'discovery', status: 'reviewed', answers: { 'discovery.1': { value: 'Support staff lose track of requests.', state: 'answered', reason: '' } } }] },
        },
      }),
    );
    expect(result.status).toBe('pending');
    expect((await h.project(p.id)).spec.revision).toBe(before);
    const proposals = (await h.request('GET', `/projects/${p.id}/proposals`)).json();
    const list = Array.isArray(proposals) ? proposals : proposals.proposals;
    const stored = list.find((x: { id: string }) => x.id === result.proposalId);
    expect(stored).toMatchObject({ origin: 'agent', status: 'pending' });
    // An agent cannot propose review status.
    expect(stored.patch.sections[0]).not.toHaveProperty('status');
    const invalid = await client.callTool({ name: 'propose_change', arguments: { title: 'Bad', rationale: '', patch: { sections: [{ id: 'discovery', answers: { 'discovery.1': { value: 1 } } }] } } });
    expect(invalid.isError).toBe(true);
    await client.close();
  });
});

describe('MCP: the existing specification, and the project split into tasks', () => {
  // Token creation is rate limited (10 a minute) and is not what these tests are about, so tokens are stored directly.
  const projectWithToken = async (sample = true) => {
    const p = await h.createProject({ sample, name: 'Tasks project' });
    const token = `sdd_mcp_${randomBytes(32).toString('hex')}`;
    const owner = await h.db.collection('users').findOne({ email: 'test-owner@example.test' });
    await h.db.collection('mcpTokens').insertOne({ id: crypto.randomUUID(), projectId: p.id, name: 'Tasks tests', digest: digest(token), createdBy: owner!.id, createdAt: new Date().toISOString() });
    return { p, client: await connect(token) };
  };
  const board = async (client: Client) => data(await client.callTool({ name: 'get_board', arguments: { limit: 200 } }));
  const call = async (client: Client, name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });

  it('exposes an authenticated MCP App and rejects improvements based on stale snapshots', async () => {
    const { p, client } = await projectWithToken();
    const visual = data(await call(client, 'show_specification', {}));
    expect(visual.sections).toHaveLength(14);
    expect(visual.revision).toBe((await h.project(p.id)).spec.revision);
    const { tools } = await client.listTools();
    expect(tools.find((tool) => tool.name === 'show_specification')?._meta).toMatchObject({ ui: { resourceUri: 'ui://sdd-studio/specification.html' } });
    const resource = await client.readResource({ uri: 'ui://sdd-studio/specification.html' });
    expect(resource.contents[0].mimeType).toBe('text/html;profile=mcp-app');
    expect(resource.contents[0]._meta).toMatchObject({ ui: { csp: { connectDomains: [], resourceDomains: [] } } });
    expect((resource.contents[0] as { text: string }).text).toContain('<!doctype html>');
    expect((resource.contents[0] as { text: string }).text).not.toContain(p.id);
    await h.patch(p.id, visual.revision, { description: 'Changed during discussion' });
    const stale = await call(client, 'propose_change', { title: 'An improvement', rationale: 'Evidence', baseRevision: visual.revision, patch: { description: 'Old suggestion' } });
    expect(stale.isError).toBe(true);
    expect(text(stale)).toContain('currentRevision');
    expect(await h.db.collection('proposals').countDocuments({ projectId: p.id })).toBe(0);
    const fresh = data(await call(client, 'show_specification', {}));
    const proposed = data(await call(client, 'propose_change', { title: 'An improvement', rationale: 'Evidence', baseRevision: fresh.revision, patch: { description: 'New suggestion' } }));
    expect(proposed.status).toBe('pending');
    expect((await h.project(p.id)).spec.description).toBe('Changed during discussion');
    await client.close();
  });

  it('refuses to plan tasks until the specification is correct, and says what is in the way', async () => {
    const { p, client } = await projectWithToken(false);
    const refused = await call(client, 'plan_tasks', { dryRun: true });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toMatch(/The specification is not correct yet: \d+ blockers/);
    expect(text(refused)).toContain('close_readiness_gaps');
    expect((await h.request('GET', `/projects/${p.id}/board`)).json().board.cards).toEqual([]);
    await client.close();
  });

  it('previews the plan without saving, then creates it under the board revision, and a repeat changes nothing', async () => {
    const { p, client } = await projectWithToken();
    await approve(p.id);
    const preview = data(await call(client, 'plan_tasks', { dryRun: true }));
    expect(preview).toMatchObject({ dryRun: true, revision: 0, behindSpecification: false, summary: { epics: 4 } });
    expect(preview.addedTotal).toBeGreaterThan(20);
    expect(preview.gaps).toContain('REQ-004 is not implemented by any component.');
    expect((await board(client)).total).toBe(0);

    const missing = await call(client, 'plan_tasks', {});
    expect(missing.isError).toBe(true);
    expect(text(missing)).toContain('expectedRevision is required unless dryRun is true');
    const created = data(await call(client, 'plan_tasks', { expectedRevision: 0 }));
    expect(created).toMatchObject({ dryRun: false, revision: 1, addedTotal: preview.addedTotal, obsoleteTotal: 0 });
    expect((await board(client)).total).toBe(created.total);
    const stale = await call(client, 'plan_tasks', { expectedRevision: 0 });
    expect(stale.isError).toBe(true);
    expect(text(stale)).toContain('currentRevision');
    const repeat = data(await call(client, 'plan_tasks', { expectedRevision: 1 }));
    expect(repeat).toMatchObject({ addedTotal: 0, obsoleteTotal: 0, total: created.total });
    const audits = await h.db.collection('audit').find({ projectId: p.id, action: 'board.generated' }).toArray();
    expect(audits.some((a: any) => a.details?.via === 'mcp')).toBe(true);
    await client.close();
  });

  it('says when the specification has moved on since the baseline the tasks come from', async () => {
    const { p, client } = await projectWithToken();
    await approve(p.id);
    const spec = (await h.project(p.id)).spec;
    await h.patch(p.id, spec.revision, { description: 'Edited after the baseline' });
    expect(data(await call(client, 'plan_tasks', { dryRun: true }))).toMatchObject({ behindSpecification: true });
    await client.close();
  });

  it('lists only the tasks that are ready, and releases the rest as their dependencies are done', async () => {
    const { p, client } = await projectWithToken();
    await approve(p.id);
    data(await call(client, 'plan_tasks', { expectedRevision: 0 }));
    const first = data(await call(client, 'get_next_tasks', { limit: 50 }));
    const ready = first.tasks.map((t: { id: string }) => t.id);
    expect(ready).toContain('REQ-001');
    expect(ready).not.toContain('CMP-001');
    expect(ready).not.toContain('UC-001');
    expect(first.blocked).toBeGreaterThan(3);
    expect(first.tasks.every((t: { dependsOn: string[] }) => t.dependsOn.length === 0)).toBe(true);

    let revision = first.revision;
    for (const id of ['REQ-003', 'REQ-006']) revision = data(await call(client, 'move_card', { cardId: id, column: 'done', expectedRevision: revision })).revision;
    const next = data(await call(client, 'get_next_tasks', { limit: 50 }));
    expect(next.tasks.map((t: { id: string }) => t.id)).toContain('CMP-001');
    expect(next.tasks.map((t: { id: string }) => t.id)).not.toContain('REQ-003');
    const paged = data(await call(client, 'get_next_tasks', { limit: 2 }));
    expect(paged.tasks).toHaveLength(2);
    expect(paged.nextOffset).toBe(2);
    expect(data(await call(client, 'get_next_tasks', { limit: 2, offset: 2 })).tasks[0].id).not.toBe(paged.tasks[0].id);
    expect((await call(client, 'get_next_tasks', { limit: 500 })).isError).toBe(true);
    await client.close();
  });

  it('brings an existing .plan/tasks.md into the board: preview first, then moves, additions and dependencies', async () => {
    const { p, client } = await projectWithToken(false);
    const markdown = '## Setup\n- [x] SETUP-01 Install the toolchain\n- [/] TASK-010 Build the importer — After: SETUP-01\n- [ ] TASK-011 Write the guide — After: TASK-010 — PR: https://github.com/acme/app/pull/9\n';
    const preview = data(await call(client, 'import_plan_tasks', { markdown, dryRun: true }));
    expect(preview).toMatchObject({ dryRun: true, revision: 0, added: ['SETUP-01', 'TASK-010', 'TASK-011'], updated: [], skipped: [] });
    expect((await board(client)).total).toBe(0);
    expect((await call(client, 'import_plan_tasks', { markdown })).isError).toBe(true);

    const applied = data(await call(client, 'import_plan_tasks', { markdown, expectedRevision: 0 }));
    expect(applied).toMatchObject({ dryRun: false, revision: 1, addedTotal: 3 });
    const cards = (await board(client)).cards;
    expect(cards.find((c: { id: string }) => c.id === 'TASK-010')).toMatchObject({ column: 'doing', group: 'Setup', dependsOn: ['SETUP-01'] });
    expect(cards.find((c: { id: string }) => c.id === 'TASK-011')).toMatchObject({ pullRequests: ['https://github.com/acme/app/pull/9'] });
    // The next ready task follows from what is done, and the file round-trips through export_plan_tasks.
    expect(data(await call(client, 'get_next_tasks', {})).tasks.map((t: { id: string }) => t.id)).toEqual([]);
    expect(text(await call(client, 'export_plan_tasks', {}))).toContain('- [ ] TASK-011 Write the guide — After: TASK-010');
    const again = data(await call(client, 'import_plan_tasks', { markdown, expectedRevision: 1 }));
    expect(again).toMatchObject({ addedTotal: 0, updatedTotal: 0 });
    expect((await h.db.collection('audit').find({ projectId: p.id, action: 'board.plan-imported' }).toArray()).some((a: any) => a.details?.via === 'mcp')).toBe(true);
    await client.close();
  });

  it('lists proposals newest first with their status, and filters and pages them', async () => {
    const { p, client } = await projectWithToken(false);
    const propose = async (title: string) => {
      // Proposals are ordered by creation time, so keep them apart.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return data(await call(client, 'propose_change', { title, rationale: 'Seen in the repository.', patch: { sections: [{ id: 'discovery', answers: { 'discovery.1': { value: title, state: 'answered', reason: '' } } }] } }));
    };
    const one = await propose('First idea');
    await propose('Second idea');
    await propose('Third idea');
    const all = data(await call(client, 'list_proposals', {}));
    expect(all).toMatchObject({ total: 3, nextOffset: null });
    expect(all.proposals.map((x: { title: string }) => x.title)).toEqual(['Third idea', 'Second idea', 'First idea']);
    expect(all.proposals[0]).toMatchObject({ status: 'pending', origin: 'agent', baseRevision: 0 });
    const second = data(await call(client, 'list_proposals', { limit: 1, offset: 1 }));
    expect(second.proposals.map((x: { title: string }) => x.title)).toEqual(['Second idea']);
    expect(second.nextOffset).toBe(2);
    // A person decides; the agent can see the outcome.
    expect((await h.request('POST', `/projects/${p.id}/proposals/${one.proposalId}/accept`, {})).statusCode).toBe(200);
    expect(data(await call(client, 'list_proposals', { status: 'accepted' })).proposals.map((x: { id: string }) => x.id)).toEqual([one.proposalId]);
    expect(data(await call(client, 'list_proposals', { status: 'pending' })).total).toBe(2);
    expect((await call(client, 'list_proposals', { status: 'banana' })).isError).toBe(true);
    await client.close();
  });

  it('reads the whole existing specification as one resource, for the token project only', async () => {
    const { client } = await projectWithToken();
    const other = await h.createProject({ name: 'Somebody else’s project' });
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual(['sdd://project/specification.md', 'sdd://project/tasks.md', 'ui://sdd-studio/specification.html']);
    const document = (await client.readResource({ uri: 'sdd://project/specification.md' })).contents[0] as { text: string; mimeType: string };
    expect(document.mimeType).toBe('text/markdown');
    expect(document.text).toMatch(/^# Tasks project/);
    for (const title of ['Business & discovery', 'Architecture & ADRs', 'Governance & handoff']) expect(document.text).toContain(title);
    expect(document.text).toContain('REQ-001');
    expect(document.text).not.toContain(other.id);
    await client.close();
  });

  it('guides an agent through the split, and through the next task, with the tools that exist', async () => {
    const { client } = await projectWithToken(false);
    const { prompts } = await client.listPrompts();
    expect(prompts.map((x) => x.name).sort()).toEqual(['break_into_tasks', 'close_readiness_gaps', 'implement_next_task', 'improve_specification']);
    const split = ((await client.getPrompt({ name: 'break_into_tasks', arguments: {} })).messages[0].content as { text: string }).text;
    for (const tool of ['get_project_overview', 'get_board', 'plan_tasks', 'propose_change', 'get_next_tasks']) expect(split).toContain(tool);
    expect(split).toMatch(/Only a reviewer approves a baseline/);
    const next = ((await client.getPrompt({ name: 'implement_next_task', arguments: {} })).messages[0].content as { text: string }).text;
    expect(next).toContain('get_next_tasks');
    await client.close();
  });
});
