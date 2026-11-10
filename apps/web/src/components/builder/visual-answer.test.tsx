import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../i18n';
import { VisualAnswerCard } from './VisualAnswer';

/** Interactive answers in the conversation: data from the AI, drawn and made interactive by the app. */
const comparison = {
  kind: 'comparison',
  title: 'Database for the request store',
  options: ['PostgreSQL', 'MongoDB'],
  criteria: [
    { name: 'Team knows it', weight: 3 },
    { name: 'Flexible documents', weight: 1 },
  ],
  cells: [
    [{ score: 5, note: 'Used daily' }, { score: 2 }],
    [{ score: 3 }, { score: 5 }],
  ],
  basis: 'Estimate from what you said about the team.',
};
const steps = {
  kind: 'steps',
  title: 'How a request is submitted',
  steps: [
    { title: 'Sign in', actor: 'Customer' },
    { title: 'Describe the issue', detail: 'Attach files if needed.' },
    { title: 'Submit' },
  ],
};
const chart = {
  kind: 'chart',
  title: 'Latency budget',
  unit: 'ms',
  bars: [
    { label: 'API', value: 120 },
    { label: 'Database', value: 260 },
  ],
  target: 200,
  targetLabel: 'SLO',
};

describe('VisualAnswerCard', () => {
  it('ranks a comparison by its weights, re-ranks when a weight changes, and sends the decision as a message', async () => {
    const onFollowUp = vi.fn();
    render(<VisualAnswerCard args={{ visual: comparison }} onFollowUp={onFollowUp} />);
    expect(
      screen.getByRole('heading', { name: 'Database for the request store' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Interactive answer')).toBeInTheDocument();
    expect(
      screen.getByText(/Best fit with these weights: PostgreSQL \(88\/100\)/),
    ).toBeInTheDocument();
    const ranking = screen.getByRole('list', { name: 'Weighted ranking' });
    expect(within(ranking).getAllByRole('listitem')[0]).toHaveAccessibleName(/PostgreSQL: 88\/100/);

    // "Team knows it" no longer matters: MongoDB wins on flexibility.
    const weight = screen.getByRole('slider', { name: /Team knows it/ });
    expect(weight).toHaveAttribute('aria-valuetext', 'Critical');
    fireEvent.change(weight, { target: { value: '0' } });
    expect(
      screen.getByText(/Best fit with these weights: MongoDB \(100\/100\)/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Record MongoDB as the decision' }));
    expect(onFollowUp).toHaveBeenCalledWith(
      'Record MongoDB as our choice for “Database for the request store”. What mattered: Team knows it (Ignore), Flexible documents (Low).',
    );

    // The scores, with their notes, are a table away; the estimate says where it comes from.
    await userEvent.click(screen.getByRole('radio', { name: 'Scores' }));
    expect(screen.getByRole('table')).toHaveTextContent('Used daily');
    expect(screen.getAllByLabelText('5 out of 5')).toHaveLength(2);
    expect(screen.getByText('Estimate from what you said about the team.')).toBeInTheDocument();
  });

  it('offers no decision while options are tied, and none to someone who cannot edit', () => {
    const { unmount } = render(
      <VisualAnswerCard args={{ visual: comparison }} onFollowUp={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('slider', { name: /Team knows it/ }), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /Flexible documents/ }), {
      target: { value: '0' },
    });
    expect(screen.getByText(/Tied at 0\/100/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as the decision/ })).not.toBeInTheDocument();
    unmount();
    render(<VisualAnswerCard args={{ visual: comparison }} />);
    expect(screen.queryByRole('button', { name: /as the decision/ })).not.toBeInTheDocument();
  });

  it('steps through a walkthrough, plays it to the end, and offers the steps for the document', async () => {
    vi.useFakeTimers();
    try {
      const onFollowUp = vi.fn();
      render(<VisualAnswerCard args={{ visual: steps }} onFollowUp={onFollowUp} />);
      expect(screen.getByText('Step 1 of 3 · Sign in')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
      expect(screen.getByText('Attach files if needed.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
      expect(screen.getByRole('button', { name: /Submit/ })).toHaveAttribute(
        'aria-current',
        'step',
      );
      // At the end, Play replays from the start and stops by itself.
      fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
      expect(screen.getByText('Step 1 of 3 · Sign in')).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(2200);
      });
      expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(2200);
      });
      await act(async () => {
        vi.advanceTimersByTime(2200);
      });
      expect(screen.getByText(/Step 3 of 3/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Use these steps in the document' }));
      expect(onFollowUp).toHaveBeenCalledWith(
        'Use these steps for “How a request is submitted”: 1. Sign in 2. Describe the issue 3. Submit',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('draws a chart with values in text, the limit, and a table view', async () => {
    render(<VisualAnswerCard args={{ visual: chart }} />);
    const bars = screen.getByRole('list', { name: 'Latency budget' });
    expect(within(bars).getAllByRole('listitem')[1]).toHaveAccessibleName(
      'Database: 260 ms, above the limit',
    );
    expect(screen.getByText('SLO: 200 ms')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Table' }));
    expect(screen.getByRole('table')).toHaveTextContent('Database260');
  });

  it('shows a placeholder while the data streams, and nothing for data it cannot draw', () => {
    const { rerender, container } = render(
      <VisualAnswerCard args={{ visual: { kind: 'chart' } }} running />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Preparing an interactive answer…');
    rerender(<VisualAnswerCard args={{ visual: { kind: 'html', html: '<script>x</script>' } }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('speaks French', () => {
    render(
      <LanguageProvider lang="fr">
        <VisualAnswerCard args={{ visual: comparison }} onFollowUp={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByText('Réponse interactive')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retenir PostgreSQL comme décision' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Meilleur choix avec ces poids/)).toBeInTheDocument();
  });
});
