import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UseCaseEditor } from './UseCaseEditor';

describe('UseCaseEditor', () => {
  it('builds the Markdown from the fields and clears hints as they are filled', async () => {
    const onChange = vi.fn();
    render(<UseCaseEditor value="" onChange={onChange} />);
    expect(screen.getByRole('list', { name: 'Suggestions' }).children).toHaveLength(5);
    await userEvent.type(screen.getByLabelText('Actor'), 'Customer');
    await userEvent.type(screen.getByLabelText(/Main flow/), 'Opens a request{enter}Submits it');
    expect(onChange).toHaveBeenLastCalledWith('**Actor:** Customer\n\n### Main flow\n\n1. Opens a request\n2. Submits it');
    expect(screen.getByRole('list', { name: 'Suggestions' }).children).toHaveLength(3);
  });

  it('keeps older free text until the author converts it', async () => {
    const onChange = vi.fn();
    render(<UseCaseEditor value={'Customer opens a request\nSystem stores it'} onChange={onChange} />);
    expect(screen.getByLabelText('Description')).toHaveValue('Customer opens a request\nSystem stores it');
    await userEvent.click(screen.getByRole('button', { name: 'Convert to template' }));
    expect(onChange).toHaveBeenLastCalledWith('### Main flow\n\n1. Customer opens a request\n2. System stores it');
    expect(screen.getByLabelText(/Main flow/)).toHaveValue('Customer opens a request\nSystem stores it');
  });
});
