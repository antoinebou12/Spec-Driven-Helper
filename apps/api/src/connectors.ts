import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { db } from './db';
import { encrypt, decrypt, audit } from './security';
import { projectFor, HttpError, createProposal } from './projects';
export const connectors = [
  {
    id: 'gitlab',
    name: 'GitLab',
    authentication: 'api-key',
    capabilities: ['read', 'publish'],
    description: 'Read repository files and explicitly create issues.',
  },
  {
    id: 'linear',
    name: 'Linear',
    authentication: 'api-key',
    capabilities: ['read', 'publish'],
    description: 'Read issues and explicitly create implementation issues.',
  },
  {
    id: 'jira',
    name: 'Jira',
    authentication: 'api-key',
    capabilities: ['read', 'publish'],
    description: 'Read and explicitly create Jira Cloud issues.',
  },
  {
    id: 'notion',
    name: 'Notion',
    authentication: 'api-key',
    capabilities: ['read'],
    description: 'Import page block content as source material.',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    authentication: 'api-key',
    capabilities: ['read'],
    description: 'Import Confluence Cloud page content.',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    authentication: 'oauth',
    capabilities: ['read'],
    description: 'Export Google Docs as plain text using an operator-supplied access token.',
  },
  {
    id: 'figma',
    name: 'Figma',
    authentication: 'api-key',
    capabilities: ['read'],
    description: 'Read design file structure and metadata.',
  },
  {
    id: 'mcp',
    name: 'MCP server',
    authentication: 'service-token',
    capabilities: ['read'],
    description:
      'Read resources from an operator-allowlisted MCP endpoint. Tool execution is disabled.',
  },
] as const;
const connectorId = z.enum([
  'gitlab',
  'linear',
  'jira',
  'notion',
  'confluence',
  'google-drive',
  'figma',
  'mcp',
]);
export function connectorOrigin(id: string, site?: string) {
  if (['jira', 'confluence'].includes(id)) {
    if (!site || !/^https:\/\/[a-z0-9-]+\.atlassian\.net$/.test(site))
      throw new HttpError(400, 'Use an https://tenant.atlassian.net site');
    return site;
  }
  if (id === 'mcp') {
    const allowed = (process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
    if (!site || !allowed.includes(new URL(site).origin) || new URL(site).protocol !== 'https:')
      throw new HttpError(400, 'MCP origin must be explicitly allowlisted by the server operator');
    return site;
  }
  return '';
}
async function fetchSource(
  url: string,
  headers: Record<string, string>,
  method = 'GET',
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new HttpError(502, `Connector request failed (${response.status})`);
  if (Number(response.headers.get('content-length')) > 1_000_000)
    throw new HttpError(413, 'Source exceeds 1 MB');
  const reader = response.body?.getReader();
  let text = '',
    bytes = 0;
  const decoder = new TextDecoder();
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) {
        await reader.cancel();
        throw new HttpError(413, 'Source exceeds 1 MB');
      }
      text += decoder.decode(value, { stream: true });
    }
  return { text, headers: response.headers };
}
async function mcp(config: any, method: string, params: unknown) {
  const base = connectorOrigin('mcp', config.site);
  const headers = {
    Authorization: `Bearer ${decrypt(config.secret)}`,
    Accept: 'application/json, text/event-stream',
  };
  const init = await fetchSource(base, headers, 'POST', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'sdd-studio', version: '0.1.0' },
    },
  });
  const session = init.headers.get('mcp-session-id');
  const nextHeaders = {
    ...headers,
    ...(session ? { 'Mcp-Session-Id': session } : {}),
    'MCP-Protocol-Version': '2025-03-26',
  };
  await fetch(base, {
    method: 'POST',
    headers: { ...nextHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  return (await fetchSource(base, nextHeaders, 'POST', { jsonrpc: '2.0', id: 2, method, params }))
    .text;
}
export async function readConnector(config: any, reference: string) {
  const key = decrypt(config.secret),
    id = config.id,
    ref = encodeURIComponent(reference);
  if (id === 'gitlab') {
    const [project, path] = reference.split(':');
    if (!project || !path) throw new HttpError(400, 'Use project-id:path/to/file');
    return (
      await fetchSource(
        `https://gitlab.com/api/v4/projects/${encodeURIComponent(project)}/repository/files/${encodeURIComponent(path)}/raw?ref=HEAD`,
        { 'PRIVATE-TOKEN': key },
      )
    ).text;
  }
  if (id === 'linear')
    return (
      await fetchSource('https://api.linear.app/graphql', { Authorization: key }, 'POST', {
        query: 'query($id:String!){issue(id:$id){id title description url state{name}}}',
        variables: { id: reference },
      })
    ).text;
  if (id === 'jira')
    return (
      await fetchSource(`${connectorOrigin(id, config.site)}/rest/api/3/issue/${ref}`, {
        Authorization: `Basic ${Buffer.from(`${config.email}:${key}`).toString('base64')}`,
      })
    ).text;
  if (id === 'notion')
    return (
      await fetchSource(`https://api.notion.com/v1/blocks/${ref}/children?page_size=100`, {
        Authorization: `Bearer ${key}`,
        'Notion-Version': '2022-06-28',
      })
    ).text;
  if (id === 'confluence')
    return (
      await fetchSource(
        `${connectorOrigin(id, config.site)}/wiki/api/v2/pages/${ref}?body-format=storage`,
        { Authorization: `Basic ${Buffer.from(`${config.email}:${key}`).toString('base64')}` },
      )
    ).text;
  if (id === 'google-drive')
    return (
      await fetchSource(
        `https://www.googleapis.com/drive/v3/files/${ref}/export?mimeType=text%2Fplain`,
        { Authorization: `Bearer ${key}` },
      )
    ).text;
  if (id === 'figma')
    return (
      await fetchSource(`https://api.figma.com/v1/files/${ref}?depth=2`, { 'X-Figma-Token': key })
    ).text;
  if (id === 'mcp') return mcp(config, 'resources/read', { uri: reference });
  throw new HttpError(400, 'Unknown connector');
}
export async function registerConnectors(app: FastifyInstance, auth: any) {
  app.get('/api/v1/projects/:id/connectors', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id);
    const configured = await db
      .collection('connectors')
      .find({ projectId: req.params.id }, { projection: { id: 1, site: 1 } })
      .toArray();
    return connectors.map((c) => ({
      ...c,
      status: configured.some((x) => x.id === c.id) ? 'configured' : 'available',
      site: configured.find((x) => x.id === c.id)?.site ?? '',
    }));
  });
  app.put('/api/v1/projects/:id/connectors/:connector', { preHandler: auth }, async (req: any) => {
    await projectFor(req.user, req.params.id, 'admin');
    const id = connectorId.parse(req.params.connector);
    const b = z
      .object({
        secret: z.string().min(1).max(10000),
        site: z.string().max(2000).optional(),
        email: z.string().email().optional(),
      })
      .parse(req.body);
    connectorOrigin(id, b.site);
    if (['jira', 'confluence'].includes(id) && !b.email)
      throw new HttpError(400, 'Atlassian email required');
    await db
      .collection('connectors')
      .updateOne(
        { projectId: req.params.id, id },
        { $set: { secret: encrypt(b.secret), site: b.site, email: b.email } },
        { upsert: true },
      );
    await audit(req.user.id, 'connector.configured', req.params.id, { connector: id });
    return { ok: true };
  });
  app.post(
    '/api/v1/projects/:id/connectors/:connector/read',
    { preHandler: auth },
    async (req: any) => {
      const p = await projectFor(req.user, req.params.id, 'edit');
      const id = connectorId.parse(req.params.connector),
        b = z
          .object({ reference: z.string().min(1).max(2000), sectionId: z.string() })
          .parse(req.body);
      const section = p.spec.sections.find((s) => s.id === b.sectionId);
      if (!section) throw new HttpError(400, 'Unknown section');
      const config = await db.collection('connectors').findOne({ projectId: p.id, id });
      if (!config) throw new HttpError(400, 'Configure this connector first');
      const content = await readConnector(config, b.reference);
      const fence = content.replaceAll('```', '[code fence]');
      const proposal = await createProposal({
        spec: p.spec,
        projectId: p.id,
        createdBy: req.user.id,
        origin: 'import',
        title: `Import source from ${id}`,
        patch: {
          sections: [
            {
              id: section.id,
              markdown: `${section.markdown.trimEnd()}

## Imported source: ${id}

Reference: ${b.reference}

\`\`\`text
${fence}
\`\`\`
`,
            },
          ],
        },
        assumptions: [
          'External source content is untrusted reference material. Review relevance, completeness, and permissions before accepting.',
        ],
      });
      await audit(req.user.id, 'connector.read', p.id, { connector: id });
      return proposal;
    },
  );
  app.post(
    '/api/v1/projects/:id/connectors/:connector/publish',
    { preHandler: auth },
    async (req: any) => {
      const p = await projectFor(req.user, req.params.id, 'edit');
      const id = z.enum(['gitlab', 'linear', 'jira']).parse(req.params.connector);
      const b = z
        .object({
          destination: z.string().min(1).max(200),
          title: z.string().min(1).max(300),
          body: z.string().max(50000),
          confirmed: z.literal(true),
        })
        .parse(req.body);
      const c = await db.collection('connectors').findOne({ projectId: p.id, id });
      if (!c) throw new HttpError(400, 'Configure this connector first');
      const key = decrypt(c.secret);
      let result;
      if (id === 'gitlab')
        result = await fetchSource(
          `https://gitlab.com/api/v4/projects/${encodeURIComponent(b.destination)}/issues`,
          { 'PRIVATE-TOKEN': key },
          'POST',
          { title: b.title, description: b.body },
        );
      else if (id === 'linear')
        result = await fetchSource(
          'https://api.linear.app/graphql',
          { Authorization: key },
          'POST',
          {
            query:
              'mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id url}}}',
            variables: { input: { teamId: b.destination, title: b.title, description: b.body } },
          },
        );
      else
        result = await fetchSource(
          `${connectorOrigin(id, c.site)}/rest/api/3/issue`,
          { Authorization: `Basic ${Buffer.from(`${c.email}:${key}`).toString('base64')}` },
          'POST',
          {
            fields: {
              project: { key: b.destination },
              summary: b.title,
              issuetype: { name: 'Task' },
              description: {
                type: 'doc',
                version: 1,
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: b.body || b.title }] },
                ],
              },
            },
          },
        );
      await audit(req.user.id, 'connector.published', p.id, {
        connector: id,
        destination: b.destination,
      });
      return { result: result.text };
    },
  );
}
