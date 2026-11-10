import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../i18n';

/** The new-project dialog: essentials by default, and one sentence asks the AI for a draft. */
const api = vi.fn();
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  api: (...args: unknown[]) => api(...args),
}));
const { NewProject } = await import('./NewProject');

afterEach(() => api.mockReset());
const setup = (draft: unknown = { queued: true, jobId: 'j1', questions: 15 }) => {
  api.mockImplementation(async (path: string) => (path.endsWith('/draft') ? draft : { id: 'p1' }));
  const onCreated = vi.fn();
  const notify = vi.fn();
  render(<NewProject lang="en" onClose={() => {}} onCreated={onCreated} notify={notify} />);
  return { onCreated, notify };
};
const create = async (name = 'Portal', idea = '') => {
  await userEvent.type(screen.getByLabelText('Project name'), name);
  if (idea) await userEvent.type(screen.getByLabelText(/What are you building/), idea);
  await userEvent.click(screen.getByRole('button', { name: /Create project/ }));
};
const body = (index = 0) => api.mock.calls[index][2] as Record<string, unknown>;

describe('New project', () => {
  it('offers the essentials level first and creates the project at that level', async () => {
    const { onCreated } = setup();
    expect(screen.getByRole('radio', { name: /Essentials/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Complete/ })).not.toBeChecked();
    expect(screen.getByText(/Essentials asks 15 core questions/)).toBeInTheDocument();
    await create();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('p1', false));
    expect(api).toHaveBeenCalledTimes(1);
    expect(body()).toMatchObject({ name: 'Portal', level: 'essentials', sample: false });
  });

  it('says how many core questions the chosen project type asks, and creates that type', async () => {
    setup();
    expect(screen.getByText(/Essentials asks 15 core questions/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Project type'), 'Mobile application');
    expect(screen.getByText(/Essentials asks 16 core questions/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /16 core questions are required/ })).toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText('Project type'), 'Library / SDK');
    expect(screen.getByText(/Essentials asks 15 core questions/)).toBeInTheDocument();
    await create();
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(body()).toMatchObject({ projectType: 'Library / SDK', level: 'essentials' });
  });

  it('creates the project at the complete level when asked', async () => {
    setup();
    await userEvent.click(screen.getByRole('radio', { name: /Complete/ }));
    await create();
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(body()).toMatchObject({ level: 'complete' });
  });

  it('asks for a draft from one sentence, and says it is on its way', async () => {
    const { onCreated, notify } = setup();
    await create('Portal', 'A portal where customers follow their requests.');
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.mock.calls[1]).toEqual([
      '/projects/p1/draft',
      'POST',
      { idea: 'A portal where customers follow their requests.' },
    ]);
    expect(notify).toHaveBeenCalledWith(
      'The AI is drafting the 15 essential answers. They arrive as a proposal to review.',
    );
  });

  it('says why there is no draft, and still creates the project', async () => {
    const { onCreated, notify } = setup({ queued: false, reason: 'No AI model is chosen yet.' });
    await create('Portal', 'An idea long enough.');
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith('No draft: No AI model is chosen yet.');
  });

  it('creates the project even when the draft request fails', async () => {
    api.mockImplementation(async (path: string) => {
      if (path.endsWith('/draft')) throw new Error('boom');
      return { id: 'p1' };
    });
    const onCreated = vi.fn();
    const notify = vi.fn();
    render(<NewProject lang="en" onClose={() => {}} onCreated={onCreated} notify={notify} />);
    await create('Portal', 'An idea long enough.');
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('p1', false));
    expect(notify).toHaveBeenCalledWith(
      'The project was created, but the draft could not be requested.',
    );
  });

  it('asks for no draft without a sentence', async () => {
    const { onCreated } = setup();
    await create('Portal');
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('hides the choice for the example project, which is always complete, and asks for no draft', async () => {
    const { onCreated } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /complete example project/ }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Create project/ }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('p1', true));
    expect(api).toHaveBeenCalledTimes(1);
    expect(body()).toMatchObject({ sample: true });
  });

  it('speaks French', async () => {
    api.mockResolvedValue({ id: 'p1' });
    render(
      <LanguageProvider lang="fr">
        <NewProject lang="fr" onClose={() => {}} onCreated={() => {}} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('radio', { name: /L’essentiel/ })).toBeChecked();
    expect(screen.getByText(/Une phrase suffit/)).toBeInTheDocument();
    expect(screen.getByText(/L’essentiel pose 15 questions clés/)).toBeInTheDocument();
  });
});
