import type { Meta, StoryObj } from '@storybook/react-vite';
import { SddWorkflow } from './SddWorkflow';
import { createSpec } from '../../../../packages/shared/src/domain';
import { buildExampleSpec } from '../../../../packages/shared/src/example';

const meta: Meta = { title: 'Overview/Spec-driven workflow' };
export default meta;
type Story = StoryObj;

const id = '00000000-0000-4000-8000-000000000001';
const go = () => {};

export const NewSpecification: Story = { render: () => <SddWorkflow spec={createSpec(id, 'New service')} go={go} /> };
export const ExampleSpecification: Story = { render: () => <SddWorkflow spec={buildExampleSpec(id)} go={go} /> };
