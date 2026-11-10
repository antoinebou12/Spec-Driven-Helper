import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConventionsGuide } from './ConventionsGuide';
import { languageConventions, languagesForStack } from '../../../../packages/shared/src/conventions';

const meta: Meta = { title: 'Stack/Conventions guide' };
export default meta;
type Story = StoryObj;

export const TypeScriptAndPython: Story = {
  render: () => <ConventionsGuide languages={languagesForStack(['typescript', 'python'])} />,
};
export const EveryLanguage: Story = { render: () => <ConventionsGuide languages={languageConventions} /> };
