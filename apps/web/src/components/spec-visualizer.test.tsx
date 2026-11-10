import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { createSpec } from '../../../../packages/shared/src/domain';
import { specVisual } from '../../../../packages/shared/src/spec-visualizer';
import { SpecVisualizer } from './SpecVisualizer';

it('selects a section with keyboard controls and requests an improvement only on click', async () => {
  const user = userEvent.setup();
  const data = specVisual(createSpec('visualizer', '<script>unsafe</script>'));
  const improve = vi.fn();
  const open = vi.fn();
  render(<SpecVisualizer data={data} onImprove={improve} onSection={open} />);
  expect(document.querySelector('script')).toBeNull();
  const first = screen.getByRole('button', { name: new RegExp(data.sections[0].title) });
  first.focus();
  await user.keyboard('{Enter}');
  expect(first).toHaveAttribute('aria-pressed', 'true');
  expect(improve).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Improve with AI' }));
  expect(improve).toHaveBeenCalledWith(data.sections[0].id);
  await user.click(screen.getByRole('button', { name: 'Open section' }));
  expect(open).toHaveBeenCalledWith(data.sections[0].id);
});

it('filters items and uses server pagination boundaries', async () => {
  const user = userEvent.setup();
  const data = {
    ...specVisual(createSpec('visualizer', 'Example')),
    items: [
      { id: 'REQ-1', title: 'Sign in', type: 'requirement' },
      { id: 'REQ-2', title: 'Export', type: 'requirement' },
    ],
    total: 25,
    nextOffset: 24,
  };
  const page = vi.fn();
  render(<SpecVisualizer data={data} onPage={page} />);
  await user.type(screen.getByRole('textbox', { name: 'Filter this page' }), 'sign');
  expect(screen.getByText('Sign in')).toBeInTheDocument();
  expect(screen.queryByText('Export')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(page).toHaveBeenCalledWith(24);
});
