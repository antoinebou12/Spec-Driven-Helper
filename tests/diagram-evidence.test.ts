import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { setupApp, type Harness } from './helpers';

let h: Harness;
beforeAll(async () => {
  h = await setupApp('diagram_evidence');
});
afterAll(async () => h?.teardown());
afterEach(() => vi.restoreAllMocks());

async function prepared() {
  const p = await h.createProject({ localOnly: false });
  await h.patch(p.id, 0, {
    sections: [
      {
        id: 'discovery',
        answers: { 'discovery.1': { state: 'answered', value: 'Teams lose requests', reason: '' } },
      },
    ],
  });
  await h.db
    .collection('configuration')
    .updateOne(
      { id: 'runtime' },
      { $set: { umlMcpUrl: 'https://renderer.example/mcp', umlAllowedTools: ['generate_uml'] } },
      { upsert: true },
    );
  vi.spyOn(Client.prototype, 'connect').mockResolvedValue(undefined);
  vi.spyOn(Client.prototype, 'close').mockResolvedValue(undefined);
  const list = vi
    .spyOn(Client.prototype, 'listTools')
    .mockResolvedValue({
      tools: [
        {
          name: 'generate_uml',
          inputSchema: { type: 'object' },
          annotations: { readOnlyHint: true },
        },
      ],
    });
  const call = vi
    .spyOn(Client.prototype, 'callTool')
    .mockResolvedValue({ content: [], structuredContent: { success: true } });
  const generate = (extra = {}, cookie = h.cookie) =>
    h.request(
      'POST',
      `/projects/${p.id}/diagrams/evidence`,
      { sectionId: 'discovery', baseRevision: 1, confirm: true, ...extra },
      cookie,
    );
  return { p, list, call, generate };
}

it('renders once, creates a reviewable diagram proposal and never writes the spec', async () => {
  const { p, call, generate } = await prepared();
  const response = await generate();
  expect(response.statusCode, response.body).toBe(200);
  const id = response.json().proposalId;
  expect(response.json().status).toBe('pending');
  const proposal = await h.db.collection('proposals').findOne({ id });
  expect(proposal!.baseRevision).toBe(1);
  expect(proposal!.patch.sections[0].diagram).toContain('Teams lose requests');
  expect((await h.project(p.id)).spec.sections[0].diagram).toBe('');
  expect((await generate()).json().proposalId).toBe(id);
  expect(call).toHaveBeenCalledTimes(1);
  expect(call.mock.calls[0][0]).toMatchObject({
    name: 'generate_uml',
    arguments: { diagram_type: 'mermaid', output_format: 'png' },
  });
});

it('enforces role, confirmation, source revision and local-only policy before network calls', async () => {
  const { p, call, generate } = await prepared();
  const viewer = await h.userWith('Viewer', { projectId: p.id, role: 'Viewer' });
  expect((await generate({}, viewer.cookie)).statusCode).toBe(403);
  expect((await generate({ confirm: false })).statusCode).toBe(400);
  expect((await generate({ baseRevision: 0 })).statusCode).toBe(409);
  const local = await h.createProject({ localOnly: true });
  expect(
    (
      await h.request('POST', `/projects/${local.id}/diagrams/evidence`, {
        sectionId: 'discovery',
        baseRevision: 0,
        confirm: true,
      })
    ).statusCode,
  ).toBe(403);
  expect(call).not.toHaveBeenCalled();
});

it('rejects unsafe tools and failed renders without creating proposals', async () => {
  const { p, list, call, generate } = await prepared();
  list.mockResolvedValueOnce({
    tools: [{ name: 'generate_uml', inputSchema: { type: 'object' } }],
  });
  expect((await generate()).statusCode).toBe(403);
  expect(call).not.toHaveBeenCalled();
  call.mockResolvedValueOnce({ content: [], structuredContent: { success: false } });
  expect((await generate()).statusCode).toBe(502);
  expect(await h.db.collection('proposals').countDocuments({ projectId: p.id })).toBe(0);
  expect((await generate({ sectionId: 'scope' })).json().status).toBe('empty');
});

it('refuses a result when the document changes during rendering', async () => {
  const { p, call, generate } = await prepared();
  call.mockImplementationOnce(async () => {
    await h.patch(p.id, 1, { description: 'Updated during the request' });
    return { content: [], structuredContent: { success: true } };
  });
  expect((await generate()).statusCode).toBe(409);
  expect(await h.db.collection('proposals').countDocuments({ projectId: p.id })).toBe(0);
});
