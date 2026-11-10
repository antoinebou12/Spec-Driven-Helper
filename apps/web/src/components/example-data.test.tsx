import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExampleDataPanel } from './ExampleData';

const projects = [{ id: 'a', name: 'Customer Request Portal', revision: 3, updatedAt: '2026-09-28T10:00:00.000Z' }];

describe('example data panel', () => {
  it('asks for confirmation before removing, then reports the result', async () => {
    const onRemove = vi.fn().mockRejectedValueOnce(new Error('Administrator access required')).mockResolvedValue({ removed: 1 });
    render(<ExampleDataPanel projects={projects} onRemove={onRemove} />);
    expect(screen.getByText('Customer Request Portal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Remove example projects/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('cannot be undone');
    expect(onRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Administrator access required');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1 example project removed.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can be cancelled, and has nothing to remove when there are no examples', async () => {
    const onRemove = vi.fn();
    const { rerender } = render(<ExampleDataPanel projects={projects} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /Remove example projects/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onRemove).not.toHaveBeenCalled();
    rerender(<ExampleDataPanel projects={[]} onRemove={onRemove} />);
    expect(screen.getByText('No example projects.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove example projects/ })).toBeNull();
    rerender(<ExampleDataPanel projects={null} onRemove={onRemove} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
