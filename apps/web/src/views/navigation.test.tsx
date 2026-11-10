import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSpec, readiness } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';
import { FeaturesProvider, useFeatures } from '../features';
import Settings from './Settings';
import Overview from './Overview';

const api = vi.fn();
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  api: (...args: unknown[]) => api(...args),
}));
vi.mock('./Admin', () => ({ default: () => null }));

const spec = createSpec('00000000-0000-4000-8000-000000000001', 'Test project');
const project = {
  spec,
  role: 'Owner',
  readiness: readiness(spec),
  pendingProposals: 0,
  reload: async () => {},
} as ProjectState;
const me = { id: 'owner', role: 'Owner' } as const;
beforeEach(() => {
  api
    .mockReset()
    .mockImplementation(async (path: string) =>
      path.endsWith('/mcp/tokens') ? { tokens: [] } : path.endsWith('/settings') ? null : [],
    );
});

it('opens import from Overview and routes dismissal back to Overview', async () => {
  const go = vi.fn();
  const { rerender } = render(
    <FeaturesProvider>
      <Overview project={project} go={go} />
    </FeaturesProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Import existing work' }));
  expect(go).toHaveBeenCalledWith('import');
  rerender(
    <FeaturesProvider>
      <Overview project={project} go={go} importOpen />
    </FeaturesProvider>,
  );
  // The import view is loaded on demand; a full parallel run can take longer than the default second.
  const slow = { timeout: 8000 };
  expect(await screen.findByRole('dialog', { name: 'Import existing work' }, slow)).toBeVisible();
  await screen.findByRole('tab', { name: 'Existing document' }, slow);
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(go).toHaveBeenCalledWith('overview');
}, 20_000);

it('collapses and reopens Overview sections without losing section navigation', async () => {
  const go = vi.fn();
  render(<Overview project={project} go={go} />);
  const summary = screen.getByText('Sections', { selector: 'summary' });
  const disclosure = summary.closest('details')!;
  expect(disclosure).toHaveAttribute('open');
  await userEvent.click(summary);
  expect(disclosure).not.toHaveAttribute('open');
  await userEvent.click(summary);
  expect(disclosure).toHaveAttribute('open');
  await userEvent.click(screen.getByRole('button', { name: /Business & discovery/ }));
  expect(go).toHaveBeenCalledWith('specification', { sectionId: 'discovery' });
});

it('hides import for viewers and disabled imports, including direct entry', () => {
  const { unmount } = render(
    <Overview project={{ ...project, role: 'Viewer' }} go={() => {}} importOpen />,
  );
  expect(screen.queryByRole('button', { name: 'Import existing work' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  unmount();
  render(
    <FeaturesProvider initial={{ import: false }}>
      <Overview project={project} go={() => {}} importOpen />
    </FeaturesProvider>,
  );
  expect(screen.queryByRole('button', { name: 'Import existing work' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('puts AI run diagnostics in Settings and hides the tab when AI is disabled', async () => {
  const { unmount } = render(
    <FeaturesProvider>
      <Settings project={project} me={me} notify={() => {}} />
    </FeaturesProvider>,
  );
  await userEvent.click(screen.getByRole('tab', { name: 'AI activity' }));
  expect(await screen.findByText('No AI runs yet.')).toBeVisible();
  expect(api).toHaveBeenCalledWith(`/projects/${spec.id}/jobs`);
  unmount();
  render(
    <FeaturesProvider initial={{ ai: false }}>
      <Settings project={project} me={me} notify={() => {}} />
    </FeaturesProvider>,
  );
  expect(screen.queryByRole('tab', { name: 'AI activity' })).not.toBeInTheDocument();
});

it('keeps integrations in Settings with separate feature gates', async () => {
  render(
    <FeaturesProvider initial={{ connectors: false }}>
      <Settings project={project} me={me} notify={() => {}} />
    </FeaturesProvider>,
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Integrations' }));
  expect(await screen.findByRole('heading', { name: 'Coding agents (MCP)' })).toBeVisible();
  await waitFor(() => expect(api).toHaveBeenCalledWith(`/projects/${spec.id}/mcp/tokens`));
  expect(screen.queryByRole('heading', { name: 'Connectors' })).not.toBeInTheDocument();
  expect(api.mock.calls.some(([path]) => path.endsWith('/connectors'))).toBe(false);
});

it('returns to Project when the selected integrations tab becomes unavailable', async () => {
  function Flags() {
    const { replace } = useFeatures();
    return (
      <button onClick={() => replace({ mcp: false, connectors: false })}>
        Disable integrations
      </button>
    );
  }
  render(
    <FeaturesProvider>
      <Flags />
      <Settings project={project} me={me} notify={() => {}} />
    </FeaturesProvider>,
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Integrations' }));
  await userEvent.click(screen.getByRole('button', { name: 'Disable integrations' }));
  expect(screen.queryByRole('tab', { name: 'Integrations' })).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('heading', { name: 'Coding agents (MCP)' })).not.toBeInTheDocument();
});
