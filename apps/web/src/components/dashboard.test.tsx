import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from '../views/Dashboard';
import { sampleDashboard } from '../test/dashboard-sample';

describe('DashboardContent', () => {
  it('shows totals, what is waiting and a card per project, and opens the right view', async () => {
    const open = vi.fn();
    render(<DashboardContent data={sampleDashboard} openProject={open} />);
    expect(screen.getByText('64 %')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Waiting for you' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('project-card'))).toHaveLength(2);
    expect(screen.getByText('2 blockers')).toBeInTheDocument();
    expect(screen.getByText(/13 done · 5 in progress · 8 to do/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review proposals in Customer Request Portal' }));
    expect(open).toHaveBeenLastCalledWith('p1', 'proposals');
    await userEvent.click(screen.getByRole('button', { name: 'Complete answers in Billing API' }));
    expect(open).toHaveBeenLastCalledWith('p2', 'specification');
    await userEvent.click(screen.getByRole('button', { name: 'Resolve blockers in Billing API' }));
    expect(open).toHaveBeenLastCalledWith('p2', 'readiness');
    await userEvent.click(screen.getByRole('button', { name: 'Board Customer Request Portal' }));
    expect(open).toHaveBeenLastCalledWith('p1', 'board');
  });

  it('tells viewers the dashboard is read-only and hides the waiting list', () => {
    render(<DashboardContent data={{ ...sampleDashboard, readOnly: true, waiting: { proposalsToReview: 0, sectionsToReview: 0, openQuestions: 0, blockers: 0 } }} openProject={() => {}} />);
    expect(screen.getByRole('note')).toHaveTextContent('You can follow these projects');
    expect(screen.queryByRole('heading', { name: 'Waiting for you' })).toBeNull();
  });
});
