import type { DashboardData } from '../views/Dashboard';

/** Sample dashboard for stories and component tests. */
export const sampleDashboard: DashboardData = {
  user: { name: 'Alex', role: 'Editor' },
  totals: { projects: 2, ready: 1, withBaseline: 1, averageCompleteness: 64 },
  waiting: { proposalsToReview: 3, sectionsToReview: 5, openQuestions: 4, blockers: 2 },
  readOnly: false,
  projects: [
    { id: 'p1', name: 'Customer Request Portal', projectType: 'Web application', role: 'Admin', canEdit: true, canReview: true, revision: 42, updatedAt: '2026-09-28T10:00:00Z', completeness: 92, readiness: { ready: true, percent: 100, blockers: 0 }, security: 100, pendingProposals: 3, unknownAnswers: 0, sectionsToReview: 5, board: { backlog: 2, todo: 6, doing: 3, review: 2, done: 13 }, latestBaseline: { revision: 40, approvedAt: '2026-09-27T09:00:00Z' } },
    { id: 'p2', name: 'Billing API', projectType: 'API / service', role: 'Editor', canEdit: true, canReview: false, revision: 7, updatedAt: '2026-09-26T08:00:00Z', completeness: 36, readiness: { ready: false, percent: 40, blockers: 2 }, security: 33, pendingProposals: 0, unknownAnswers: 4, sectionsToReview: 14, board: null, latestBaseline: null },
  ],
};
