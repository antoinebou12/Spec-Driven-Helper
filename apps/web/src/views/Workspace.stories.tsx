import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Workspace } from './Workspace';
import { FeaturesProvider } from '../features';
import { applySpecPatch, createSpec, readiness } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';

function Preview() {
  const [spec, setSpec] = useState(() => createSpec('workspace-preview', 'Documentation workspace'));
  const project = {
    spec, role: 'Owner', readiness: readiness(spec), pendingProposals: 0,
    status: 'idle', conflict: null, epoch: 0,
    save: async (build) => {
      const patch = typeof build === 'function' ? build(spec) : build;
      if (!patch) return spec;
      const next = applySpecPatch(spec, patch, 'preview', { canReview: true });
      setSpec(next);
      return next;
    },
    reload: async () => {}, accept: setSpec, resolveConflict: async () => {},
  } as ProjectState;
  return <FeaturesProvider initial={{ ai: false, stack: false }}><Workspace project={project} editable guidance={{}} target={null} onTargetHandled={() => {}} go={() => {}} notify={() => {}} /></FeaturesProvider>;
}
const meta: Meta = { title: 'Views/Native workspace', parameters: { layout: 'fullscreen' } };
export default meta;
export const Conversation: StoryObj = { render: () => <Preview /> };
