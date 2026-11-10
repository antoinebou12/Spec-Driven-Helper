import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagramBatch } from './DiagramBatch';
import { createSpec } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';

const api = vi.fn().mockResolvedValue({ status: 'pending' });
vi.mock('../api', () => ({ api: (...args: unknown[]) => api(...args) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const project = (localOnly = false) => {
  const spec = createSpec('project', 'Test', 'en', localOnly);
  spec.localOnly = localOnly;
  spec.sections[0].answers['discovery.1'] = {
    state: 'answered',
    value: 'Lost requests',
    reason: '',
  };
  return { spec } as ProjectState;
};
it('waits for an explicit action and keeps generated output pending review', async () => {
  render(<DiagramBatch project={project()} sectionId="discovery" />);
  expect(api).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText('Generate', { selector: 'summary' }));
  await userEvent.click(screen.getByRole('button', { name: 'Generate' }));
  await waitFor(() =>
    expect(screen.getByText('Awaiting review', { exact: false })).toBeInTheDocument(),
  );
  expect(api).toHaveBeenCalledWith('/projects/project/diagrams/evidence', 'POST', {
    sectionId: 'discovery',
    baseRevision: 0,
    confirm: true,
  });
});
it('blocks local-only rendering', async () => {
  render(<DiagramBatch project={project(true)} sectionId="discovery" />);
  await userEvent.click(screen.getByText('Generate', { selector: 'summary' }));
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  expect(api).not.toHaveBeenCalled();
});
