import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerControl } from './AnswerControl';
import { SecurityChecklist } from './SecurityChecklist';
import { findQuestion } from '../../../../packages/shared/src/templates';
import { createSpec } from '../../../../packages/shared/src/domain';
import { buildExampleSpec } from '../../../../packages/shared/src/example';

describe('slider answers', () => {
  it('keeps the range and the exact number in step, within bounds', () => {
    const onChange = vi.fn();
    const q = findQuestion('quality.11')!;
    render(
      <>
        <span id="q-label">{q.prompt.en}</span>
        <AnswerControl id="q" question={q} value="" onChange={onChange} />
      </>,
    );
    const range = screen.getByRole('slider');
    expect(range).toHaveAttribute('aria-valuetext', 'Not set');
    fireEvent.change(range, { target: { value: '99.5' } });
    expect(onChange).toHaveBeenLastCalledWith('99.5');
    fireEvent.change(screen.getByLabelText(/Exact value/), { target: { value: '120' } });
    expect(onChange).toHaveBeenLastCalledWith('99.99');
    fireEvent.change(screen.getByLabelText(/Exact value/), { target: { value: '12' } });
    expect(onChange).toHaveBeenLastCalledWith('95');
    expect(screen.getByText('95–99.99 %')).toBeInTheDocument();
  });
});

describe('matrix answers', () => {
  it('records one choice per row with labelled radio buttons', async () => {
    const onChange = vi.fn();
    const q = findQuestion('security.14')!;
    const { rerender } = render(<AnswerControl id="m" question={q} value="" onChange={onChange} />);
    expect(screen.getAllByRole('row')).toHaveLength(7);
    await userEvent.click(screen.getByLabelText('Personal data: Confidential'));
    expect(JSON.parse(onChange.mock.lastCall![0])).toEqual({ 'Personal data': 'Confidential' });
    rerender(<AnswerControl id="m" question={q} value={JSON.stringify({ 'Personal data': 'Confidential' })} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Backups: Internal'));
    expect(JSON.parse(onChange.mock.lastCall![0])).toEqual({ 'Personal data': 'Confidential', Backups: 'Internal' });
    expect(screen.getByLabelText('Personal data: Confidential')).toBeChecked();
  });
});

describe('SecurityChecklist', () => {
  it('shows coverage and opens missing questions', async () => {
    const open = vi.fn();
    render(<SecurityChecklist spec={createSpec('00000000-0000-4000-8000-0000000000d1', 'Empty')} onOpenQuestion={open} />);
    expect(screen.getByText(/0 of 1[45] applicable areas covered/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Answer: Threat model and trust boundaries' }));
    expect(open).toHaveBeenCalledWith('security.2');
  });

  it('shows every area covered for the complete example', () => {
    render(<SecurityChecklist spec={buildExampleSpec('00000000-0000-4000-8000-0000000000d2')} />);
    expect(screen.getAllByText('Covered').length).toBeGreaterThanOrEqual(14);
    expect(screen.queryByText('Missing')).toBeNull();
  });
});
