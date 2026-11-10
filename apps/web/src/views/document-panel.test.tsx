import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentPanel } from './DocumentPanel';
import { createSpec } from '../../../../packages/shared/src/domain';
import { modules } from '../../../../packages/shared/src/templates';
import type { ProjectState } from '../state';

vi.mock('../components/Editors', () => ({ MarkdownEditor: () => <div>Markdown editor</div> }));

it('keeps the filename and status visible while document tools start collapsed', async () => {
  const spec = createSpec('doc', 'Document');
  const project = { spec, save: vi.fn() } as unknown as ProjectState;
  render(<DocumentPanel module={modules[0]} section={spec.sections[0]} project={project} editable />);
  expect(screen.getByText('discovery.md')).toBeVisible();
  expect(screen.getByText('Draft')).toBeVisible();
  expect(screen.queryByRole('tab', { name: 'Edit' })).not.toBeInTheDocument();
  const tools = screen.getByRole('button', { name: 'Document tools' });
  expect(tools).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(tools);
  await userEvent.click(screen.getByRole('tab', { name: 'Edit' }));
  expect(await screen.findByText('Markdown editor')).toBeVisible();
  await userEvent.click(tools);
  expect(tools).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Markdown editor')).not.toBeInTheDocument();
  expect(project.save).not.toHaveBeenCalled();
});
