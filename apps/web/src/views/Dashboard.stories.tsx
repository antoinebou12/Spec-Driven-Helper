import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardContent } from './Dashboard';
import { sampleDashboard } from '../test/dashboard-sample';

const meta: Meta<typeof DashboardContent> = { title: 'Views/Dashboard', component: DashboardContent, args: { openProject: () => {} } };
export default meta;
type Story = StoryObj<typeof DashboardContent>;

export const EditorAndReviewer: Story = { args: { data: sampleDashboard } };
export const ReadOnlyViewer: Story = {
  args: { data: { ...sampleDashboard, readOnly: true, waiting: { proposalsToReview: 0, sectionsToReview: 0, openQuestions: 0, blockers: 0 }, projects: sampleDashboard.projects.map((p) => ({ ...p, role: 'Viewer', canEdit: false, canReview: false })) } },
};
