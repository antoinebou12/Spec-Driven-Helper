import type { Meta, StoryObj } from '@storybook/react-vite';
import { OverviewImage } from './OverviewImage';
import { overviewSvg } from '../../../../packages/shared/src/overview-image';

const meta: Meta = { title: 'Publishing/Overview image' };
export default meta;
type Story = StoryObj;

const svg = (language: 'en' | 'fr', ready: boolean) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    overviewSvg({
      name: 'Customer service portal',
      subtitle: 'Web application · r12 · 2026-09-27',
      language,
      readiness: ready ? 100 : 68,
      ready,
      completeness: ready ? 94 : 57,
      modules: ['Discovery', 'Scope', 'Workflows', 'Architecture', 'Data', 'Quality', 'Security', 'Design', 'Technology', 'Conventions', 'Testing', 'Delivery', 'Operations', 'Governance'].map(
        (title, i) => ({ title, done: ready ? 6 : i % 7, total: 6 }),
      ),
      stack: ['React', 'TypeScript', 'Fastify', 'PostgreSQL', 'Docker', 'GitHub Actions', 'OpenTelemetry'],
    }),
  )}`;

export const InProgress: Story = { render: () => <OverviewImage src={svg('en', false)} name="Customer service portal-r12" /> };
export const ReadyInFrench: Story = { render: () => <OverviewImage src={svg('fr', true)} name="Portail client-r12" /> };
