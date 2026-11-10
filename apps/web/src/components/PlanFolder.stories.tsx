import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlanImportPreview } from './PlanFolder';
import { samplePlanSummary } from '../test/plan-sample';

const meta: Meta<typeof PlanImportPreview> = { title: 'Publishing/.plan import preview', component: PlanImportPreview };
export default meta;
type Story = StoryObj<typeof PlanImportPreview>;

export const SpecificationAndBoard: Story = { args: { summary: samplePlanSummary } };
export const NothingToImport: Story = {
  args: { summary: { ...samplePlanSummary, specification: { source: null, changes: 0 }, board: { from: null, added: [], updated: [], revision: 0 }, skipped: [] } },
};
