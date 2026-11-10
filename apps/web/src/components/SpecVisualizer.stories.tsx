import type { Meta, StoryObj } from '@storybook/react-vite';
import { createSpec } from '../../../../packages/shared/src/domain';
import { buildExampleSpec } from '../../../../packages/shared/src/example';
import { specVisual } from '../../../../packages/shared/src/spec-visualizer';
import { SpecVisualizer } from './SpecVisualizer';

const meta: Meta<typeof SpecVisualizer> = {
  title: 'Documents/Specification visualizer',
  component: SpecVisualizer,
};
export default meta;
type Story = StoryObj<typeof SpecVisualizer>;
export const Empty: Story = { args: { data: specVisual(createSpec('visualizer', 'New project')) } };
export const Populated: Story = { args: { data: specVisual(buildExampleSpec('00000000-0000-4000-8000-000000000001')) } };
