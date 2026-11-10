import type { Meta, StoryObj } from '@storybook/react-vite';
import { VisualAnswerCard } from './VisualAnswer';

/** Answers you can interact with: what the AI in Build with AI can show instead of prose. */
const meta: Meta = {
  title: 'Builder/Interactive answers',
  decorators: [
    (Story) => (
      <div className="builder" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj;
const noop = () => {};

export const Comparison: Story = {
  render: () => (
    <VisualAnswerCard
      onFollowUp={noop}
      args={{
        visual: {
          kind: 'comparison',
          title: 'Database for the request store',
          options: ['PostgreSQL', 'MongoDB', 'SQLite'],
          criteria: [
            { name: 'Team knows it', weight: 3 },
            { name: 'Flexible documents', weight: 1 },
            { name: 'Runs on one server', weight: 2 },
          ],
          cells: [
            [{ score: 5, note: 'Used daily' }, { score: 2 }, { score: 4 }],
            [{ score: 4, note: 'JSONB' }, { score: 5 }, { score: 2 }],
            [{ score: 4 }, { score: 3 }, { score: 5 }],
          ],
          basis: 'Estimate from what you said about the team; check it before deciding.',
        },
      }}
    />
  ),
};

export const Steps: Story = {
  render: () => (
    <VisualAnswerCard
      onFollowUp={noop}
      args={{
        visual: {
          kind: 'steps',
          title: 'How a customer submits a request',
          steps: [
            { title: 'Sign in', detail: 'With the company account.', actor: 'Customer' },
            { title: 'Describe the issue', detail: 'Attach files up to 10 MB.' },
            { title: 'Submit', detail: 'The request gets an ID and the status “Submitted”.' },
            { title: 'Triage', actor: 'Agent' },
          ],
        },
      }}
    />
  ),
};

export const Chart: Story = {
  render: () => (
    <VisualAnswerCard
      args={{
        visual: {
          kind: 'chart',
          title: 'Latency budget per step',
          unit: 'ms',
          bars: [
            { label: 'Browser', value: 80 },
            { label: 'API', value: 120 },
            { label: 'Database', value: 260 },
          ],
          target: 200,
          targetLabel: 'SLO per step',
          basis: 'Numbers you gave for the current system.',
        },
      }}
    />
  ),
};

export const Streaming: Story = {
  render: () => <VisualAnswerCard args={{ visual: { kind: 'chart' } }} running />,
};
