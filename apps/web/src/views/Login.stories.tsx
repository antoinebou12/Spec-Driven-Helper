import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoginPanel, type AuthOptions } from './Login';

const meta: Meta = { title: 'Views/Sign in', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const all: AuthOptions = { google: true, oidc: true, registration: true };
const panel = (options: AuthOptions, extra: { invite?: string; outcome?: string } = {}) => (
  <LoginPanel
    options={options}
    lang="en"
    setLang={() => {}}
    onLogin={() => {}}
    request={async () => ({}) as never}
    {...extra}
  />
);

export const SignInWithSso: Story = { render: () => panel(all) };
export const InvitationOnly: Story = {
  render: () => panel({ google: false, oidc: false, registration: false }),
};
export const AcceptInvitation: Story = { render: () => panel(all, { invite: 'token' }) };
export const PendingAfterSso: Story = { render: () => panel(all, { outcome: 'pending' }) };
export const InviteRequired: Story = {
  render: () =>
    panel({ google: true, oidc: false, registration: false }, { outcome: 'invite-required' }),
};
