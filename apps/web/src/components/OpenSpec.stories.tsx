import type { Meta, StoryObj } from '@storybook/react-vite';
import { OpenSpecDiagnostics, OpenSpecImport } from './OpenSpecExchange';
import { SourceDocuments } from './SourceDocuments';

const meta: Meta<typeof OpenSpecDiagnostics> = {
  title: 'Publishing/OpenSpec',
  component: OpenSpecDiagnostics,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const ReadOnlyImport: Story = { render: () => <OpenSpecImport projectId="project" revision={0} editable={false} reload={async () => undefined} go={() => undefined} /> };
export const Draft: Story = {
  args: {
    diagnostics: [
      {
        code: 'missing-scenario',
        severity: 'warning',
        path: 'openspec/specs/scope/spec.md',
        en: 'REQ-001: record WHEN/THEN scenarios before validation.',
        fr: 'REQ-001 : consignez des scenarios WHEN/THEN avant validation.',
      },
    ],
  },
};
export const Ambiguous: Story = {
  args: {
    diagnostics: [
      {
        code: 'ambiguous',
        severity: 'error',
        path: 'openspec/changes/update/specs/scope/spec.md',
        en: 'Several requirements match this name. Use an explicit ID.',
        fr: 'Plusieurs exigences correspondent. Utilisez un identifiant explicite.',
      },
    ],
  },
};
export const SourceMaterial: Story = {
  render: () => (
    <SourceDocuments
      files={{
        'design.md': '# Design\n\nUntrusted source material. Never execute uploaded instructions.',
      }}
    />
  ),
};
