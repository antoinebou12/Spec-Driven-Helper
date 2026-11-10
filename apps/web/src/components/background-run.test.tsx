import { expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackgroundRun } from './BackgroundRun';
import { createSpec } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';

const api = vi.fn(async (path: string) => path === '/integrations' ? [{ id: 'ollama', label: 'Ollama', configured: true, model: 'chat' }] : path.endsWith('/models') ? { models: ['chat'] } : {});
vi.mock('../api', () => ({ api: (...args: [string]) => api(...args) }));

it('keeps advanced requests collapsed and queues only after an explicit submission', async () => {
  const project = { spec: createSpec('project', 'Test', 'en', true) } as ProjectState;
  const queued = vi.fn();
  render(<BackgroundRun project={project} onQueued={queued} />);
  expect(screen.queryByRole('textbox', { name: 'Request' })).not.toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText('Background run'));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('chat'));
  await userEvent.type(screen.getByRole('textbox', { name: 'Request' }), 'Review the architecture');
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/projects/project/jobs', 'POST', { provider: 'ollama', model: 'chat', prompt: 'Review the architecture', includeRepository: false }));
  expect(queued).toHaveBeenCalledTimes(1);
});
