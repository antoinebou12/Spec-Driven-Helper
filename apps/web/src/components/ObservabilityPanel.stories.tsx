import type { Meta, StoryObj } from '@storybook/react-vite';
import { ObservabilityView } from './ObservabilityPanel';
import { sampleObservability } from '../test/observability-sample';

const meta: Meta<typeof ObservabilityView> = { title: 'Admin/Observability', component: ObservabilityView };
export default meta;
type Story = StoryObj<typeof ObservabilityView>;

export const Healthy: Story = { args: { data: sampleObservability } };
export const DatabaseDown: Story = {
  args: { data: { ...sampleObservability, database: { ok: false, latencyMs: 5000 }, requests: { ...sampleObservability.requests, serverErrors: 1200, errorRate: 0.065 } } },
};
