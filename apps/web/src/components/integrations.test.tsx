import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Components that talk to the API, with `api()` mocked per test. */
const api = vi.fn();
vi.mock('../api', async (original) => ({ ...(await original<typeof import('../api')>()), api: (...args: unknown[]) => api(...args) }));

const { ProviderPicker } = await import('./ProviderPicker');
const { default: McpAccess } = await import('./McpAccess');
const { default: PlanFolder } = await import('./PlanFolder');
const { default: Connectors } = await import('./Connectors');
const { ApiError } = await import('../api');

afterEach(() => api.mockReset());
const route = (table: Record<string, unknown | ((body: unknown) => unknown)>) =>
  api.mockImplementation(async (path: string, method = 'GET', body?: unknown) => {
    const key = Object.keys(table).find((k) => `${method} ${path}`.startsWith(k));
    if (!key) throw new Error(`unexpected ${method} ${path}`);
    const value = table[key];
    return typeof value === 'function' ? (value as (b: unknown) => unknown)(body) : value;
  });

describe('ProviderPicker', () => {
  const providers = [
    { id: 'openai', label: 'OpenAI', model: 'gpt-5', configured: true },
    { id: 'anthropic', label: 'Anthropic', model: 'claude-x', configured: false },
    { id: 'ollama', label: 'Ollama', model: 'gemma2:2b', configured: true },
  ];

  it('offers configured providers and picks the preferred model', async () => {
    route({ 'GET /integrations/openai/models': { models: ['gpt-4', 'gpt-5'] }, 'GET /integrations/ollama/models': { models: ['llama3'] }, 'GET /integrations': providers });
    const onChange = vi.fn();
    render(<ProviderPicker localOnly={false} onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ provider: 'openai', model: 'gpt-5' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['OpenAI', 'Ollama', 'gpt-4', 'gpt-5']);
    await userEvent.selectOptions(screen.getByLabelText('Provider'), 'ollama');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ provider: 'ollama', model: 'llama3' }));
  });

  it('never offers cloud providers to local-only projects', async () => {
    route({ 'GET /integrations/ollama/models': { models: ['llama3'] }, 'GET /integrations': providers });
    render(<ProviderPicker localOnly onChange={() => {}} />);
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ollama', 'llama3']));
  });

  it('offers NVIDIA NIM with its own models once configured, and keeps it from local-only projects', async () => {
    const withNim = [...providers, { id: 'nvidia-nim', label: 'NVIDIA NIM', model: 'openai/gpt-oss-20b', configured: true }];
    route({
      'GET /integrations/nvidia-nim/models': { models: ['mistralai/mistral-large-2-instruct', 'openai/gpt-oss-20b'] },
      'GET /integrations/ollama/models': { models: ['llama3'] },
      'GET /integrations': withNim,
    });
    const onChange = vi.fn();
    const { unmount } = render(<ProviderPicker localOnly={false} exclude={['openai']} onChange={onChange} />);
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toContain('NVIDIA NIM'));
    await userEvent.selectOptions(screen.getByLabelText('Provider'), 'nvidia-nim');
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ provider: 'nvidia-nim', model: 'openai/gpt-oss-20b' }));
    unmount();
    render(<ProviderPicker localOnly onChange={() => {}} />);
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ollama', 'llama3']));
  });

  it('explains when nothing is configured, and shows model errors', async () => {
    route({ 'GET /integrations': [] });
    const { unmount } = render(<ProviderPicker localOnly onChange={() => {}} />);
    expect(await screen.findByText(/local-only. Configure Ollama/)).toBeInTheDocument();
    unmount();
    api.mockReset();
    api.mockImplementation(async (path: string) => {
      if (path === '/integrations') return [providers[0]];
      throw new Error('Provider unreachable');
    });
    render(<ProviderPicker localOnly={false} onChange={() => {}} />);
    expect(await screen.findByText('Provider unreachable')).toBeInTheDocument();
  });
});

describe('McpAccess', () => {
  it('lists, creates (shown once with a Claude Code command) and revokes tokens', async () => {
    let tokens = [{ id: 't1', name: 'CI agent', createdAt: '2026-09-27T10:00:00Z', createdBy: 'u' }];
    const notify = vi.fn();
    route({
      'GET /projects/p1/mcp/tokens': () => ({ tokens }),
      'POST /projects/p1/mcp/tokens': (body: any) => {
        tokens = [...tokens, { id: 't2', name: body.name, createdAt: '2026-09-28T10:00:00Z', createdBy: 'u' }];
        return { id: 't2', name: body.name, createdAt: '2026-09-28T10:00:00Z', token: 'sdd_mcp_abc', endpoint: '/api/v1/mcp' };
      },
      'DELETE /projects/p1/mcp/tokens/t1': () => {
        tokens = tokens.filter((t) => t.id !== 't1');
        return { revoked: true };
      },
    });
    render(<McpAccess projectId="p1" admin localOnly={false} notify={notify} />);
    expect(await screen.findByText('CI agent')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Create token/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('sdd_mcp_abc')).toBeInTheDocument();
    expect(within(dialog).getByText(/claude mcp add --transport http sdd-studio .*Bearer sdd_mcp_abc/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke CI agent' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Token “CI agent” revoked.'));
    expect(screen.queryByText('CI agent')).not.toBeInTheDocument();
  });

  it('requires the local-only confirmation and hides management from non-admins', async () => {
    route({ 'GET /projects/p1/mcp/tokens': { tokens: [] } });
    const { unmount } = render(<McpAccess projectId="p1" admin localOnly notify={() => {}} />);
    const create = await screen.findByRole('button', { name: /Create token/ });
    expect(create).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(create).toBeEnabled();
    unmount();
    render(<McpAccess projectId="p1" admin={false} localOnly={false} notify={() => {}} />);
    expect(screen.getByText(/owners and admins create tokens/)).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('explains a refused creation', async () => {
    route({ 'GET /projects/p1/mcp/tokens': { tokens: [] } });
    api.mockImplementationOnce(async () => ({ tokens: [] })).mockImplementationOnce(async () => {
      throw new ApiError('Too many tokens', 409);
    });
    render(<McpAccess projectId="p1" admin localOnly={false} notify={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: /Create token/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tokens');
  });
});

describe('PlanFolder', () => {
  const summary = {
    recognised: ['.plan/tasks.md'],
    skipped: [],
    specification: { source: null, changes: 0 },
    board: { from: 'markdown', added: ['T-1'], updated: [], revision: 4 },
    preview: true,
  };

  it('previews a chosen folder, then imports with the board revision from the preview', async () => {
    const calls: unknown[] = [];
    route({ 'POST /projects/p1/plan-folder/import': (body: any) => (calls.push(body), body.preview ? summary : { ...summary, preview: false, proposalId: null, board: { ...summary.board, revision: 5 } }) });
    const notify = vi.fn();
    render(<PlanFolder projectId="p1" editable notify={notify} />);
    const file = Object.assign(new File(['- [ ] T-1 Task'], 'tasks.md'), { text: async () => '- [ ] T-1 Task', arrayBuffer: async () => new TextEncoder().encode('- [ ] T-1 Task').buffer });
    await userEvent.upload(screen.getByLabelText('Import a .plan folder'), file);
    expect(await screen.findByText(/1 new and 0 updated cards from markdown/)).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ preview: true, files: { '.plan/tasks.md': '- [ ] T-1 Task' } });
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('.plan imported: 1 cards added, 0 updated.'));
    expect(calls[1]).toMatchObject({ preview: false, expectedBoardRevision: 4 });
  });

  it('shows an error when the selection holds no .plan files, and hides import for viewers', async () => {
    render(<PlanFolder projectId="p1" editable notify={() => {}} />);
    const image = Object.assign(new File(['x'], 'logo.png'), { arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer });
    await userEvent.upload(screen.getByLabelText('Import a .plan zip'), image, { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('No .plan files found');
    expect(api).not.toHaveBeenCalled();
    render(<PlanFolder projectId="p2" editable={false} notify={() => {}} />);
    expect(screen.getAllByRole('link', { name: /Export .plan folder/ })).toHaveLength(2);
    expect(screen.getAllByLabelText('Import a .plan zip')).toHaveLength(1);
  });
});

describe('Connectors', () => {
  const list = [
    { id: 'gitlab', name: 'GitLab', description: 'Read files', capabilities: ['read', 'publish'], status: 'available', site: '' },
    { id: 'jira', name: 'Jira', description: 'Issues', capabilities: ['read', 'publish'], status: 'configured', site: 'https://acme.atlassian.net' },
  ];

  it('configures a connector and imports a source as a proposal', async () => {
    const calls: [string, string, unknown][] = [];
    api.mockImplementation(async (path: string, method = 'GET', body?: unknown) => {
      calls.push([method, path, body]);
      return method === 'GET' ? list : { ok: true };
    });
    const notify = vi.fn();
    render(<Connectors projectId="p1" admin editable notify={notify} onError={() => {}} />);
    const gitlab = (await screen.findByText('GitLab')).closest('.list-row') as HTMLElement;
    expect(within(gitlab).getByRole('button', { name: 'Import' })).toBeDisabled();
    await userEvent.click(within(gitlab).getByRole('button', { name: 'Configure' }));
    await userEvent.type(screen.getByLabelText(/Credential/), 'glpat-x');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Save|Configure|Submit/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Connector configured.'));
    expect(calls.find(([m]) => m === 'PUT')).toEqual(['PUT', '/projects/p1/connectors/gitlab', { secret: 'glpat-x', site: undefined, email: undefined }]);

    const jira = screen.getByText('Jira').closest('.list-row') as HTMLElement;
    await userEvent.click(within(jira).getByRole('button', { name: 'Import' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Source identifier'), 'ENG-1');
    await userEvent.click(within(dialog).getByRole('button', { name: /Import|Save|Submit/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Source imported as a proposal for review.'));
    expect(calls.find(([, p]) => p.endsWith('/read'))?.[2]).toMatchObject({ reference: 'ENG-1' });
  });

  it('reports failures through onError', async () => {
    api.mockRejectedValueOnce(new Error('Connectors unavailable'));
    const onError = vi.fn();
    render(<Connectors projectId="p1" admin editable notify={() => {}} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Connectors unavailable'));
  });
});
