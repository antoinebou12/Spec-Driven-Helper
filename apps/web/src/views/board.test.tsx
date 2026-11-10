import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { buildExampleSpec } from '../../../../packages/shared/src/example';
import { boardSchema } from '../../../../packages/shared/src/board';
import { breakIntoTasks } from '../../../../packages/shared/src/task-plan';
import type { ProjectState } from '../state';

/** The board after the project was split into tasks: what a card waits for, and the gaps the plan found. */
const api = vi.fn();
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  api: (...args: unknown[]) => api(...args),
}));
const { default: Board } = await import('./Board');

const spec = buildExampleSpec('00000000-0000-4000-8000-000000000001');
const project = { spec, role: 'Owner' } as ProjectState;
const plan = breakIntoTasks(spec);
const load = (done: string[] = [], gaps = plan.gaps) =>
  api.mockResolvedValue({
    board: boardSchema.parse({
      projectId: spec.id,
      revision: 1,
      gaps,
      updatedAt: '',
      cards: plan.cards.map((c) => (done.includes(c.id) ? { ...c, column: 'done' } : c)),
    }),
    latestBaseline: { id: 'b1', revision: 1, approvedAt: '2026-10-02T10:00:00Z' },
  });
const card = (id: string) =>
  screen.getByText(id, { selector: 'code' }).closest('li') as HTMLElement;

afterEach(() => api.mockReset());

describe('Board after the project is split into tasks', () => {
  it('says what a waiting card is waiting for, and nothing for a card that can start', async () => {
    load();
    render(<Board project={project} notify={() => {}} />);
    await screen.findByText('CMP-001', { selector: 'code' });
    expect(within(card('CMP-001')).getByText('Waits for REQ-003, REQ-006')).toBeInTheDocument();
    expect(within(card('UC-001')).getByText('Waits for REQ-001')).toBeInTheDocument();
    expect(within(card('REQ-001')).queryByText(/Waits for/)).not.toBeInTheDocument();
  });

  it('stops saying it once what the card waits for is done', async () => {
    load(['REQ-003', 'REQ-006']);
    render(<Board project={project} notify={() => {}} />);
    await screen.findByText('CMP-001', { selector: 'code' });
    expect(within(card('CMP-001')).queryByText(/Waits for/)).not.toBeInTheDocument();
    expect(within(card('UC-002')).queryByText(/Waits for/)).not.toBeInTheDocument();
    expect(within(card('UC-001')).getByText('Waits for REQ-001')).toBeInTheDocument();
  });

  it('lists the gaps the plan found in the specification, and shows no panel when there are none', async () => {
    load();
    const { unmount } = render(<Board project={project} notify={() => {}} />);
    const panel = (
      await screen.findByRole('heading', { name: 'Gaps the task plan found in the specification' })
    ).closest('section') as HTMLElement;
    expect(
      within(panel).getByText('REQ-004 is not implemented by any component.'),
    ).toBeInTheDocument();
    expect(within(panel).getByText('CMP-004 implements no requirement.')).toBeInTheDocument();
    unmount();
    load([], []);
    render(<Board project={project} notify={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('CMP-001', { selector: 'code' })).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('heading', { name: /Gaps the task plan found/ }),
    ).not.toBeInTheDocument();
  });

  it('explains that approving a baseline creates the tasks when there is no baseline yet', async () => {
    api.mockResolvedValue({
      board: boardSchema.parse({ projectId: spec.id, revision: 0, updatedAt: '', cards: [] }),
      latestBaseline: null,
    });
    render(<Board project={project} notify={() => {}} />);
    expect(await screen.findAllByText(/Approve(ing)? a baseline/)).not.toHaveLength(0);
    expect(screen.getByText(/splits the project into ordered tasks/)).toBeInTheDocument();
  });
});
