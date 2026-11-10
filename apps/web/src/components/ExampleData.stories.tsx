import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExampleDataPanel } from './ExampleData';

const meta: Meta = { title: 'Administration/Example data' };
export default meta;
type Story = StoryObj;

const projects = [
  { id: 'a', name: 'Customer Request Portal', revision: 3, updatedAt: '2026-09-28T10:00:00.000Z' },
  { id: 'b', name: 'Demo for onboarding', revision: 0, updatedAt: '2026-09-27T09:00:00.000Z' },
];
export const WithExamples: Story = { render: () => <ExampleDataPanel projects={projects} onRemove={async () => ({ removed: 2 })} /> };
export const None: Story = { render: () => <ExampleDataPanel projects={[]} onRemove={async () => ({ removed: 0 })} /> };
