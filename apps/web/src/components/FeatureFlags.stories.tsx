import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FeatureFlagsPanel } from './FeatureFlags';
import {
  effectiveFeatures,
  featureFlags,
  type FeatureState,
} from '../../../../packages/shared/src/feature-flags';

const meta: Meta = { title: 'Administration/Feature flags' };
export default meta;
type Story = StoryObj;

const catalog = featureFlags.map(({ id, category, label, description, defaultEnabled }) => ({
  id,
  category,
  label,
  description,
  defaultEnabled,
}));

function Stateful({ initial }: { initial: Partial<FeatureState> }) {
  const [value, setValue] = useState(effectiveFeatures(initial));
  return (
    <FeatureFlagsPanel
      catalog={catalog}
      value={value}
      updatedAt="2026-09-27T18:00:00Z"
      onSave={async (changes) => setValue(effectiveFeatures({ ...value, ...changes }))}
    />
  );
}

export const AllOn: Story = { render: () => <Stateful initial={{}} /> };
export const SomeOff: Story = {
  render: () => (
    <Stateful initial={{ mcp: false, connectors: false, googleSignIn: false, tour: false }} />
  ),
};
