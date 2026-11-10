import type { Meta, StoryObj } from '@storybook/react-vite';
import { LicenseCheck } from './LicenseCheck';
import type { Technology } from '../../../../packages/shared/src/schema';

const meta: Meta = { title: 'Stack/License check' };
export default meta;
type Story = StoryObj;

const tech = (name: string, license: string, category: Technology['category'], icon = '') =>
  ({ id: name, name, license, category, icon }) as Technology;
const stack = [
  tech('React', 'MIT', 'framework', 'react'),
  tech('PostgreSQL', 'PostgreSQL', 'database', 'postgresql'),
  tech('Grafana', 'AGPL-3.0', 'observability', 'grafana'),
  tech('ReadLine', 'GPL-3.0', 'library'),
  tech('Terraform', 'BUSL-1.1', 'iac', 'terraform'),
  tech('Internal SDK', '', 'library'),
];

export const DistributedProprietary: Story = {
  render: () => (
    <LicenseCheck
      technologies={stack}
      policy={{
        projectLicense: 'Proprietary (all rights reserved)',
        distribution: 'Hosted service (SaaS)',
        allowed: ['permissive', 'standard', 'weak-copyleft'],
      }}
    />
  ),
};
export const NoPolicyYet: Story = {
  render: () => (
    <LicenseCheck
      technologies={stack.slice(0, 2)}
      policy={{ projectLicense: '', distribution: '', allowed: [] }}
    />
  ),
};
