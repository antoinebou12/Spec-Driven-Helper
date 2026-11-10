import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPanel, type AuthOptions } from './Login';

const all: AuthOptions = { google: true, oidc: true, registration: true };
const setup = (options: AuthOptions, extra: Partial<Parameters<typeof LoginPanel>[0]> = {}) => {
  const onLogin = vi.fn();
  const request = vi.fn(async (path: string) =>
    path === '/auth/login'
      ? { id: 'u1', email: 'a@b.c', name: 'A', role: 'Owner' }
      : { message: 'ok' },
  ) as never;
  render(
    <LoginPanel
      options={options}
      lang="en"
      setLang={() => {}}
      onLogin={onLogin}
      request={request}
      {...extra}
    />,
  );
  return { onLogin, request: request as unknown as ReturnType<typeof vi.fn> };
};

describe('sign-in page', () => {
  it('signs in with email and password', async () => {
    const { onLogin, request } = setup({ google: false, oidc: false, registration: false });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/or with email/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.test');
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
    expect(request).toHaveBeenCalledWith('/auth/login', 'POST', {
      email: 'ada@example.test',
      password: 'secret',
    });
    expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
    expect(screen.getByText(/Access is by invitation/)).toBeInTheDocument();
  });

  it('offers Google and company SSO on both sign-in and sign-up', async () => {
    setup(all);
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google',
    );
    expect(screen.getByRole('link', { name: 'Continue with company SSO' })).toHaveAttribute(
      'href',
      '/api/v1/auth/oidc',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Create account' }));
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Sign up with Google' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up with company SSO' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  });

  it('requests an account and returns to sign-in with a notice', async () => {
    const { request, onLogin } = setup(all);
    await userEvent.click(screen.getByRole('tab', { name: 'Create account' }));
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.test');
    const password = screen.getByLabelText('Password', { exact: true });
    expect(password).toHaveAttribute('minLength', '12');
    expect(password).toHaveAccessibleDescription(/At least 12 characters/);
    await userEvent.type(password, 'a long enough phrase');
    await userEvent.click(screen.getByRole('button', { name: 'Request account' }));
    expect(request).toHaveBeenCalledWith('/auth/signup', 'POST', {
      name: 'Ada',
      email: 'ada@example.test',
      password: 'a long enough phrase',
    });
    expect(onLogin).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('An administrator must activate it');
    expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches tabs with the arrow keys and toggles password visibility', async () => {
    setup(all);
    screen.getByRole('tab', { name: 'Sign in' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const password = screen.getByLabelText('Password', { exact: true });
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('accepts an invitation with a name and password, or with SSO', async () => {
    const { request } = setup(all, { invite: 'tok-1' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Accept with Google' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Your name'), 'Ada');
    await userEvent.type(
      screen.getByLabelText('Password', { exact: true }),
      'a long enough phrase',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Join workspace' }));
    expect(request).toHaveBeenCalledWith('/auth/accept-invite', 'POST', {
      token: 'tok-1',
      name: 'Ada',
      password: 'a long enough phrase',
    });
  });

  it('explains the outcome of a single sign-on attempt', () => {
    setup(all, { outcome: 'pending' });
    expect(screen.getByRole('status')).toHaveTextContent('Account requested');
  });

  it('shows failures as alerts, including unknown outcomes', () => {
    setup(all, { outcome: 'something-else' });
    expect(screen.getByRole('alert')).toHaveTextContent('Single sign-on failed');
  });
});
