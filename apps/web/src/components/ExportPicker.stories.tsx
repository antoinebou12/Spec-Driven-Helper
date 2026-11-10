import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExportPicker } from './ExportPicker';

const meta: Meta<typeof ExportPicker> = {
  title: 'Publishing/Export picker',
  component: ExportPicker,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const GroupedFormats: Story = {
  args: {
    projectId: 'example',
    groups: [
      { id: 'agents', title: 'Agents', ids: ['zip'] },
      { id: 'data', title: 'Data', ids: ['json', 'toon'] },
    ],
    formats: [
      { id: 'zip', title: 'Implementation bundle', note: '.plan/, AGENTS.md, CLAUDE.md' },
      { id: 'json', title: 'JSON', note: 'JSON' },
      { id: 'toon', title: 'TOON', note: 'TOON' },
    ],
  },
};
