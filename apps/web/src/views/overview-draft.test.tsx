import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSpec, readiness, sectionNeedsReview } from '../../../../packages/shared/src/domain';
import { essentialIdsFor } from '../../../../packages/shared/src/essentials';
import type { Spec } from '../../../../packages/shared/src/schema';
import type { ProjectState } from '../state';
import { FeaturesProvider } from '../features';
import Overview from './Overview';

/** The Overview asks the AI for the essentials again, from the sentence the project was created with. */
const api = vi.fn();
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  api: (...args: unknown[]) => api(...args),
}));
afterEach(() => api.mockReset());

const draftButton = { name: 'Draft the essentials with AI' };
const answer = (id: string) =>
  ({ value: `Answer to ${id}`, state: 'answered', reason: '' }) as const;
function stateOf(over: Partial<Spec> = {}, role = 'Owner', answered = false, reviewed = 0) {
  const spec: Spec = {
    ...createSpec('00000000-0000-4000-8000-0000000000c1', 'Portal', 'en', false, 'Web application'),
    level: 'essentials',
    description: 'A portal where customers follow their service requests.',
    ...over,
  };
  if (answered)
    for (const id of essentialIdsFor(spec.projectType))
      spec.sections.find((s) => s.id === id.split('.')[0])!.answers[id] = answer(id);
  spec.sections
    .filter((s) => sectionNeedsReview(spec, s.id))
    .slice(0, reviewed)
    .forEach((s) => (s.status = 'reviewed'));
  return {
    spec,
    role,
    readiness: readiness(spec),
    pendingProposals: 0,
    reload: async () => {},
  } as ProjectState;
}
const show = (project: ProjectState, notify = vi.fn(), features: Record<string, boolean> = {}) => {
  render(
    <FeaturesProvider initial={features}>
      <Overview project={project} go={() => {}} notify={notify} />
    </FeaturesProvider>,
  );
  return notify;
};

describe('Overview: draft the essentials with AI', () => {
  it('asks again without the sentence, and says the draft is on its way', async () => {
    api.mockResolvedValue({ queued: true, jobId: 'j1', questions: 15 });
    const project = stateOf();
    const notify = show(project);
    await userEvent.click(screen.getByRole('button', draftButton));
    // No sentence is sent: the server uses the project description.
    expect(api.mock.calls).toEqual([[`/projects/${project.spec!.id}/draft`, 'POST']]);
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'The AI is drafting the 15 essential answers. They arrive as a proposal to review.',
      ),
    );
    expect(screen.getByRole('button', draftButton)).toBeEnabled();
  });

  it('says why there is no draft, or what went wrong', async () => {
    api.mockResolvedValueOnce({ queued: false, reason: 'No AI model is chosen yet.' });
    const notify = show(stateOf());
    await userEvent.click(screen.getByRole('button', draftButton));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('No draft: No AI model is chosen yet.'),
    );
    api.mockRejectedValueOnce(new Error('Too many requests'));
    await userEvent.click(screen.getByRole('button', draftButton));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Too many requests'));
    expect(screen.getByRole('button', draftButton)).toBeEnabled();
  });

  it('is offered only to editors, with the AI on, a sentence, and essentials still open', () => {
    show(stateOf());
    expect(screen.getByRole('button', draftButton)).toBeVisible();
    cleanup();
    const hidden: [string, ProjectState, Record<string, boolean>?][] = [
      ['a viewer', stateOf({}, 'Viewer')],
      ['AI switched off', stateOf(), { ai: false }],
      ['no description', stateOf({ description: '' })],
      ['a blank description', stateOf({ description: '  ' })],
      ['every essential answered', stateOf({}, 'Owner', true)],
    ];
    for (const [why, project, features] of hidden) {
      show(project, vi.fn(), features);
      expect(screen.queryByRole('button', draftButton), why).not.toBeInTheDocument();
      cleanup();
    }
  });

  it('follows the project type: a library is done once its own essentials are answered', () => {
    const library = stateOf({ projectType: 'Library / SDK' });
    // The web-application answers do not close a library's essentials.
    for (const id of ['discovery.1', 'security.3'])
      library.spec!.sections.find((s) => s.id === id.split('.')[0])!.answers[id] = answer(id);
    show(library);
    expect(screen.getByRole('button', draftButton)).toBeVisible();
  });
});

describe('Overview: reviews at the essentials level', () => {
  it('counts only the sections that need a review, and stops asking once they are reviewed', () => {
    show(stateOf({}, 'Owner', true, 8));
    expect(screen.getByText('8/9')).toBeVisible();
    expect(screen.getByText('Review the completed sections')).toBeVisible();
    cleanup();
    show(stateOf({}, 'Owner', true, 9));
    expect(screen.getByText('9/9')).toBeVisible();
    expect(screen.queryByText('Review the completed sections')).not.toBeInTheDocument();
  });
});
