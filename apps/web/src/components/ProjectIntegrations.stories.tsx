import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProjectIntegrations } from './ProjectIntegrations';
import { FeaturesProvider } from '../features';
import { createSpec } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';

const meta: Meta<typeof ProjectIntegrations> = {
  title: 'Settings/Project integrations',
  component: ProjectIntegrations,
  decorators: [
    (Story) => (
      <FeaturesProvider initial={{ connectors: false }}>
        <Story />
      </FeaturesProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;
export const ReadOnlyAgentAccess: Story = {
  args: {
    project: {
      spec: createSpec('00000000-0000-4000-8000-000000000001', 'Example'),
      role: 'Viewer',
    } as ProjectState,
    notify: () => {},
  },
};
