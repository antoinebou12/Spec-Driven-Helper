import type { PlanImportSummary } from '../components/PlanFolder';

/** Sample import preview for the .plan folder story and component test. */
export const samplePlanSummary: PlanImportSummary = {
  recognised: ['.plan/specification.json', '.plan/board.json', '.plan/spec/01-discovery.md'],
  skipped: ['.plan/notes/random.txt: not imported (no matching data)'],
  specification: { source: '.plan/specification.json', changes: 42 },
  board: { from: 'board.json', added: ['REQ-001', 'REQ-002'], updated: ['TASK-003'], revision: 3 },
  preview: true,
};
