import type { Meta, StoryObj } from '@storybook/react-vite';
import Overview from './Overview';
import { InterviewPanel } from './Interview';
import { DocumentPanel } from './DocumentPanel';
import { modules } from '../../../../packages/shared/src/templates';
import { createSpec, readiness } from '../../../../packages/shared/src/domain';
import { buildExampleSpec } from '../../../../packages/shared/src/example';
import type { Spec } from '../../../../packages/shared/src/schema';
import type { ProjectState } from '../state';

/** Full views that render from the project state alone, without API calls. */
const meta: Meta = { title: 'Views', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const id = '00000000-0000-4000-8000-000000000001';
const project = (spec: Spec, pendingProposals = 0) =>
  ({
    spec,
    role: 'Owner',
    readiness: readiness(spec),
    pendingProposals,
    status: 'idle',
    conflict: null,
    epoch: 0,
    save: async () => {},
    accept: () => {},
    reload: async () => undefined,
    resolveConflict: async () => {},
  }) as unknown as ProjectState;

export const OverviewExample: Story = {
  render: () => <Overview project={project(buildExampleSpec(id), 2)} go={() => {}} />,
};
export const OverviewNewProject: Story = {
  render: () => <Overview project={project(createSpec(id, 'New service'))} go={() => {}} />,
};

export const QuietDocument: Story = { render: () => {
  const state = project(createSpec(id, 'New service'));
  return <DocumentPanel module={modules[0]} section={state.spec!.sections[0]} project={state} editable />;
} };

export const CompactQuestionForm: Story = {
  render: () => {
    const state = project(createSpec(id, 'New service'));
    return (
      <div style={{ maxWidth: 660 }}>
        <InterviewPanel
          module={modules[0]}
          section={state.spec!.sections[0]}
          project={state}
          editable
          guidance={{}}
          focusQuestion={null}
          onFocused={() => {}}
          onNextModule={() => {}}
          onAskAi={() => {}}
        />
      </div>
    );
  },
};
