import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackgroundRun } from './BackgroundRun';
import { createSpec } from '../../../../packages/shared/src/domain';
import type { ProjectState } from '../state';

const meta: Meta<typeof BackgroundRun> = { title: 'Settings/Background run', component: BackgroundRun };
export default meta;
export const Collapsed: StoryObj<typeof BackgroundRun> = { args: { project: { spec: createSpec('example', 'Example') } as ProjectState, onQueued: () => {} } };
