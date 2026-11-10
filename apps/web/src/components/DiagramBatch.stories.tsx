import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiagramBatch } from './DiagramBatch';
import { createSpec } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';

const meta: Meta<typeof DiagramBatch> = {
  title: 'Documents/Evidence diagrams',
  component: DiagramBatch,
};
export default meta;
type Story = StoryObj<typeof DiagramBatch>;
const spec = createSpec('project', 'Example');
export const Ready: Story = { args: { project: { spec } as ProjectState, sectionId: 'discovery' } };
export const LocalOnly: Story = {
  args: { project: { spec: { ...spec, localOnly: true } } as ProjectState, sectionId: 'discovery' },
};
