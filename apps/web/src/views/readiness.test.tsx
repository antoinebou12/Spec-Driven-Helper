import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildExampleSpec } from '../../../../packages/shared/src/example';
import { createSpec, readiness, sectionNeedsReview } from '../../../../packages/shared/src/domain';
import { essentialQuestionIds } from '../../../../packages/shared/src/essentials';
import type { Spec } from '../../../../packages/shared/src/schema';
import type { ProjectState } from '../state';
import { api } from '../api';
import Readiness from './Readiness';

vi.mock('../api', () => ({ api: vi.fn(async () => []) }));
const spec = buildExampleSpec('00000000-0000-4000-8000-000000000001');
const project = { spec, role: 'Owner', readiness: readiness(spec) } as ProjectState;
afterEach(() => vi.mocked(api).mockClear());

it('folds review blockers and focuses the section review without approving it', async () => {
  render(<Readiness project={project} notify={() => {}} />);
  const summary = screen.getByText('Sections not reviewed');
  expect(summary.closest('details')).not.toHaveAttribute('open');
  await userEvent.click(summary);
  await userEvent.click(screen.getByRole('link', { name: 'Review discovery' }));
  expect(document.getElementById('section-review-discovery')).toHaveFocus();
  expect(screen.getByRole('button', { name: /Approve revision/ })).toBeDisabled();
});

it('does not offer approval or section-review writes to editors', () => {
  render(<Readiness project={{ ...project, role: 'Editor' }} notify={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Mark reviewed' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Approve revision/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Review all and approve' })).not.toBeInTheDocument();
});

/** An essentials project with its 15 answers and one tested requirement; only the reviews are missing. */
function essentialsProject(over: Partial<Spec> = {}, role = 'Owner') {
  const s: Spec = { ...createSpec('00000000-0000-4000-8000-0000000000a1', 'Minimal', 'en', false, 'Web application'), level: 'essentials', ...over };
  for (const id of essentialQuestionIds) s.sections.find((x) => x.id === id.split('.')[0])!.answers[id] = { value: `Answer to ${id}`, state: 'answered', reason: '' };
  s.items = [{ id: 'REQ-001', type: 'requirement', title: 'Sign in', body: '', status: 'accepted', acceptance: 'Within 2 seconds', owner: '', needsReview: false }, { id: 'TEST-001', type: 'test', title: 'Test', body: '', status: 'accepted', acceptance: '', owner: '', needsReview: false }];
  s.links = [{ id: 'LINK-1', from: 'TEST-001', to: 'REQ-001', kind: 'tests' }];
  return { spec: s, project: { spec: s, role, readiness: readiness(s), reload: vi.fn(async () => {}), accept: vi.fn() } as unknown as ProjectState };
}

it('counts only the sections that need a review at the essentials level', () => {
  const { project: p } = essentialsProject();
  render(<Readiness project={p} notify={() => {}} />);
  expect(screen.getByText('0/9')).toBeInTheDocument();
  const table = screen.getByRole('region', { name: 'Section reviews table' });
  expect(within(table).getAllByText('Not required')).toHaveLength(5);
  expect(within(table).getAllByRole('button', { name: /Mark reviewed/ })).toHaveLength(9);
});

it('offers one action to review everything and approve when reviews are all that is left', async () => {
  const { spec: s, project: p } = essentialsProject();
  const notify = vi.fn();
  vi.mocked(api).mockImplementation(async (path: string, method?: string) => (method === 'POST' ? { tasks: { added: 2, gaps: ['REQ-001 is not implemented by any component.'] } } : []));
  render(<Readiness project={p} notify={notify} />);
  expect(screen.getByRole('button', { name: /Approve revision/ })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Review all and approve' }));
  await waitFor(() => expect(notify).toHaveBeenCalled());
  expect(vi.mocked(api)).toHaveBeenCalledWith(`/projects/${s.id}/baselines`, 'POST', { expectedRevision: 0, note: '', reviewAll: true });
  expect(p.reload).toHaveBeenCalled();
  expect(notify.mock.calls[0][0]).toContain('2 tasks were created on the board, with 1 gaps to look at');
  expect(sectionNeedsReview(s, 'quality')).toBe(false);
});

it('does not offer it when something besides reviews is missing, when it is not needed, or to editors', () => {
  // A required answer is missing: reviewing cannot make the project ready.
  const missing = essentialsProject();
  delete missing.spec.sections.find((x) => x.id === 'scope')!.answers['scope.1'];
  missing.project.readiness = readiness(missing.spec);
  const first = render(<Readiness project={missing.project} notify={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Review all and approve' })).not.toBeInTheDocument();
  first.unmount();
  // Already reviewed: the ordinary approval is the one action.
  const reviewed = essentialsProject();
  for (const s of reviewed.spec.sections) if (sectionNeedsReview(reviewed.spec, s.id)) s.status = 'reviewed';
  reviewed.project.readiness = readiness(reviewed.spec);
  const second = render(<Readiness project={reviewed.project} notify={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Review all and approve' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Approve revision/ })).toBeEnabled();
  second.unmount();
  // Editors cannot review or approve.
  render(<Readiness project={essentialsProject({}, 'Editor').project} notify={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Review all and approve' })).not.toBeInTheDocument();
});
