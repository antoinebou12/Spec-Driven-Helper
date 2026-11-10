import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnswerRecord, InterviewChoiceCard } from './AnswerRecord';
import { QuestionCard, type QuestionCardProps } from './QuestionCard';
import { LanguageProvider } from '../../i18n';
import { createSpec } from '../../../../../packages/shared/src/domain';
import { findQuestion, modules, moduleQuestions, type Question } from '../../../../../packages/shared/src/templates';

/**
 * A question of the guided interview as a conversation card: the control that fits the question,
 * quick replies, saving before answering, and the two bubbles it folds into.
 */
const spec = createSpec('00000000-0000-4000-8000-0000000000f5', 'Card', 'en', false, 'Web application');
const byKind = (kind: Question['kind']) => modules.flatMap((m) => moduleQuestions(m, spec)).find((q) => q.kind === kind && q.required) ?? modules.flatMap((m) => moduleQuestions(m, spec)).find((q) => q.kind === kind)!;

function setup(question: Question | undefined, props: Partial<QuestionCardProps> = {}) {
  const onSave = vi.fn().mockResolvedValue(true);
  const onRespond = vi.fn();
  const onOpenEditor = vi.fn();
  const view = render(<QuestionCard question={question} spec={spec} editable aiAvailable onSave={onSave} onRespond={onRespond} onOpenEditor={onOpenEditor} {...props} />);
  return { onSave, onRespond, onOpenEditor, ...view };
}

describe('text questions', () => {
  const q = findQuestion('discovery.1')!;

  it('saves the answer and responds when Enter is pressed, but not on Shift+Enter', async () => {
    const { onSave, onRespond } = setup(q);
    const box = screen.getByRole('textbox', { name: q.prompt.en });
    await waitFor(() => expect(box).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(box, 'Requests get lost{Shift>}{Enter}{/Shift}in email');
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(onRespond).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ state: 'answered', value: 'Requests get lost\nin email', reason: '' });
    expect(onRespond).toHaveBeenCalledWith({ action: 'answered', questionId: 'discovery.1', value: 'Requests get lost\nin email', summary: 'Requests get lost in email' });
  });

  it('does not answer when the answer could not be saved, and says so', async () => {
    const { onSave, onRespond } = setup(q, { onSave: vi.fn().mockResolvedValue(false) });
    await userEvent.type(screen.getByRole('textbox'), 'Something');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
    expect(onRespond).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    // A save that throws is the same as one that fails.
    const thrown = setup(q, { onSave: vi.fn().mockRejectedValue(new Error('offline')) });
    await userEvent.type(within(thrown.container).getByRole('textbox'), 'Again');
    await userEvent.click(within(thrown.container).getByRole('button', { name: 'Send' }));
    expect(await within(thrown.container).findByRole('alert')).toBeInTheDocument();
  });

  it('prefills an existing answer, and offers the example as a starting point', async () => {
    const answered = { sections: spec.sections.map((s) => (s.id === 'discovery' ? { ...s, answers: { 'discovery.1': { value: 'Already there', state: 'answered' as const, reason: '' } } } : s)) };
    const { container } = setup(q, { spec: answered });
    expect(within(container).getByRole('textbox')).toHaveValue('Already there');
    await userEvent.click(within(container).getByText('Why we ask'));
    await userEvent.click(within(container).getByRole('button', { name: 'Use as a starting point' }));
    expect(within(container).getByRole('textbox')).toHaveValue(q.example.en);
  });

  it('shows how far the section is', () => {
    setup(q);
    expect(screen.getByRole('progressbar', { name: /Section progress: 0 of \d+ required answers/ })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${q.label.en} · 0/\\d+`))).toBeInTheDocument();
  });
});

describe('choices and switches send at once', () => {
  it('answers a single choice with one click', async () => {
    const q = byKind('choice');
    const { onSave, onRespond } = setup(q);
    const option = q.options![1];
    await userEvent.click(screen.getByRole('button', { name: option.en }));
    await waitFor(() => expect(onRespond).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({ state: 'answered', value: option.en, reason: '' });
    expect(onRespond).toHaveBeenCalledWith(expect.objectContaining({ action: 'answered', value: option.en, summary: option.en }));
  });

  it('answers yes or no with one click', async () => {
    const q = byKind('switch');
    const { onSave } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ state: 'answered', value: 'no', reason: '' }));
  });

  it('shows options in French for a French reader', async () => {
    const q = byKind('choice');
    render(
      <LanguageProvider lang="fr">
        <QuestionCard question={q} spec={spec} editable aiAvailable onSave={vi.fn()} onRespond={vi.fn()} onOpenEditor={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('button', { name: q.options![0].fr })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer pour l’instant' })).toBeInTheDocument();
  });
});

describe('several choices, sliders and grids need a Send', () => {
  it('sends the selected options together', async () => {
    const q = byKind('multi');
    const { onSave } = setup(q);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByLabelText(q.options![0].en));
    await userEvent.click(screen.getByLabelText(q.options![2].en));
    await userEvent.click(send);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ state: 'answered', value: JSON.stringify([q.options![0].en, q.options![2].en]), reason: '' }));
  });

  it('sends a slider value with its unit', async () => {
    const q = byKind('slider');
    const { onRespond } = setup(q);
    fireEvent.change(screen.getByRole('slider'), { target: { value: String(q.range!.min + q.range!.step * 2) } });
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onRespond).toHaveBeenCalled());
    expect(onRespond.mock.calls[0][0].summary).toContain(String(q.range!.min + q.range!.step * 2));
  });

  it('sends a grid once every row is chosen', async () => {
    const q = byKind('matrix');
    const { onSave } = setup(q);
    await userEvent.click(screen.getByRole('radio', { name: `${q.rows![0].en}: ${q.options![0].en}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ state: 'answered', value: JSON.stringify({ [q.rows![0].en]: q.options![0].en }), reason: '' }));
  });
});

describe('tables open in a dialog', () => {
  it('fills the table in a dialog and sends it', async () => {
    const q = findQuestion('discovery.3')!;
    const { onSave, onRespond } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Fill in the table' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: `${q.columns![0].en} 1` }), 'Head of support');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onRespond).toHaveBeenCalled());
    expect(JSON.parse(onSave.mock.calls[0][0].value)[0][0]).toBe('Head of support');
    expect(onRespond.mock.calls[0][0].summary).toBe('1 row');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can be cancelled, and sends nothing while empty', async () => {
    const q = findQuestion('discovery.3')!;
    const { onSave } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Fill in the table' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('points requirements to the full editor, where they become traceable items', async () => {
    const q = byKind('requirements');
    const { onOpenEditor } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Turn rows into traceable requirements' }));
    expect(onOpenEditor).toHaveBeenCalled();
  });
});

describe('other ways to answer', () => {
  const q = findQuestion('discovery.1')!;

  it('skips without saving anything', async () => {
    const { onSave, onRespond } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onRespond).toHaveBeenCalledWith({ action: 'skipped', questionId: 'discovery.1' });
  });

  it('records "not sure yet" as an unknown answer', async () => {
    const { onSave, onRespond } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Not sure yet' }));
    await waitFor(() => expect(onRespond).toHaveBeenCalledWith({ action: 'unknown', questionId: 'discovery.1' }));
    expect(onSave).toHaveBeenCalledWith({ state: 'unknown', value: '', reason: '' });
  });

  it('asks for a reason before marking a question as not applicable', async () => {
    const { onSave, onRespond } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Doesn’t apply' }));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Why does this not apply?' }), 'Internal tool');
    await userEvent.click(confirm);
    await waitFor(() => expect(onRespond).toHaveBeenCalledWith({ action: 'not-applicable', questionId: 'discovery.1', reason: 'Internal tool' }));
    expect(onSave).toHaveBeenCalledWith({ state: 'not-applicable', value: '', reason: 'Internal tool' });
  });

  it('can go back from the reason to answering', async () => {
    setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Doesn’t apply' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('textbox', { name: q.prompt.en })).toBeInTheDocument();
  });

  it('asks the AI for a suggestion only when there is one, and only for people who can edit', async () => {
    const { onRespond, unmount } = setup(q);
    await userEvent.click(screen.getByRole('button', { name: 'Suggest with AI' }));
    expect(onRespond).toHaveBeenCalledWith({ action: 'ask-ai', questionId: 'discovery.1' });
    unmount();
    setup(q, { aiAvailable: false });
    expect(screen.queryByRole('button', { name: 'Suggest with AI' })).toBeNull();
  });

  it('is read-only for people who cannot edit, but still lets them move on', async () => {
    const { onRespond } = setup(q, { editable: false });
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Not sure yet' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Doesn’t apply' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Suggest with AI' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onRespond).toHaveBeenCalledWith({ action: 'skipped', questionId: 'discovery.1' });
  });
});

describe('answered cards and missing questions', () => {
  const q = findQuestion('discovery.1')!;

  it('fold into the question and the answer', () => {
    const { rerender } = render(<AnswerRecord question={q} result={{ action: 'answered', questionId: q.id, summary: 'Requests get lost' }} />);
    expect(screen.getByText(q.prompt.en)).toBeInTheDocument();
    expect(screen.getByText('Requests get lost')).toHaveAttribute('data-action', 'answered');
    const say = (result: Parameters<typeof AnswerRecord>[0]['result']) => rerender(<AnswerRecord question={q} result={result} />);
    say({ action: 'skipped', questionId: q.id });
    expect(screen.getByText('Skipped for now')).toBeInTheDocument();
    say({ action: 'unknown', questionId: q.id });
    expect(screen.getByText('Unknown for now')).toBeInTheDocument();
    say({ action: 'ask-ai', questionId: q.id });
    expect(screen.getByText('Asked the AI for a suggestion')).toBeInTheDocument();
    say({ action: 'not-applicable', questionId: q.id, reason: 'Internal' });
    expect(screen.getByText('Does not apply: Internal')).toBeInTheDocument();
    // A result restored without a summary is worked out from the value.
    say({ action: 'answered', questionId: q.id, value: 'From the value' });
    expect(screen.getByText('From the value')).toBeInTheDocument();
    rerender(<AnswerRecord question={undefined} result={{ action: 'skipped', questionId: 'gone.1' }} />);
    expect(screen.getByText('gone.1')).toBeInTheDocument();
  });

  it('show the record instead of the controls once a result exists', () => {
    setup(q, { result: { action: 'answered', questionId: q.id, summary: 'Done' } });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('let the conversation continue when the question is no longer in the specification', async () => {
    const { onRespond } = setup(undefined);
    expect(screen.getByText('This question is no longer in the specification')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onRespond).toHaveBeenCalledWith({ action: 'skipped', questionId: '' });
  });
});

describe('what next?', () => {
  it('offers the wrap-up choices, then shows the one that was picked', async () => {
    const onPick = vi.fn();
    const options = [
      { key: 'go-optional' as const, label: 'Answer the optional questions' },
      { key: 'stop' as const, label: 'I’m done for now' },
    ];
    const { rerender } = render(<InterviewChoiceCard options={options} onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'I’m done for now' }));
    expect(onPick).toHaveBeenCalledWith('stop', 'I’m done for now');
    rerender(<InterviewChoiceCard options={options} result={{ key: 'go-optional' }} onPick={onPick} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Answer the optional questions')).toBeInTheDocument();
    // A result whose options are gone falls back to its own label.
    rerender(<InterviewChoiceCard options={[]} result={{ key: 'stay', label: 'Stay here' }} onPick={onPick} />);
    expect(screen.getByText('Stay here')).toBeInTheDocument();
  });
});
