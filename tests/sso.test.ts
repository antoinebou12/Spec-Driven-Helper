import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp, type Harness } from './helpers';

let h: Harness, sso: typeof import('../apps/api/src/sso-accounts');
beforeAll(async () => {
  h = await setupApp('sso');
  sso = await import('../apps/api/src/sso-accounts');
});
afterAll(async () => h?.teardown());

const issuer = 'https://id.example.test';
const claims = (email: string, extra: Record<string, unknown> = {}) => ({
  sub: crypto.randomUUID(),
  email,
  email_verified: true,
  name: 'Ada',
  ...extra,
});
const registration = (on: boolean) =>
  h.request('PUT', '/admin/configuration', { registration: on });
const outcome = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (e) => (e instanceof sso.SsoError ? e.outcome : String(e)),
  );

describe('single sign-on accounts', () => {
  it('creates an active account with the invited role and consumes the invitation', async () => {
    await h.db
      .collection('invites')
      .insertOne({
        email: 'invited@example.test',
        role: 'Editor',
        expiresAt: new Date(Date.now() + 60_000),
      });
    const user = await sso.ssoAccount(claims('Invited@Example.test'), issuer);
    expect(user).toMatchObject({ email: 'invited@example.test', role: 'Editor' });
    expect(
      await h.db.collection('users').findOne({ email: 'invited@example.test' }),
    ).not.toHaveProperty('disabled');
    expect(await h.db.collection('invites').findOne({ email: 'invited@example.test' })).toBeNull();
    expect(
      await h.db.collection('audit').findOne({ action: 'auth.sso-account-created' }),
    ).toBeTruthy();
  });

  it('requires an invitation while registration is closed', async () => {
    await registration(false);
    expect(await outcome(sso.ssoAccount(claims('stranger@example.test'), issuer))).toBe(
      'invite-required',
    );
    expect(await h.db.collection('users').findOne({ email: 'stranger@example.test' })).toBeNull();
  });

  it('turns an open registration into a disabled request, like email sign-up', async () => {
    await registration(true);
    try {
      const first = claims('new@example.test');
      expect(await sso.ssoAccount(first, issuer)).toBe('pending');
      expect(await h.db.collection('users').findOne({ email: 'new@example.test' })).toMatchObject({
        role: 'Viewer',
        disabled: true,
      });
      expect(await outcome(sso.ssoAccount(first, issuer))).toBe('inactive');
    } finally {
      await registration(false);
    }
  });

  it('never links an existing email and rejects unverified addresses', async () => {
    const owner = await h.db.collection('users').findOne({ role: 'Owner' });
    await h.db
      .collection('invites')
      .insertOne({
        email: 'test-owner@example.test',
        role: 'Admin',
        // A valid administrator invitation (issued by an owner): the existing account is still never linked.
        invitedBy: owner!.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
    expect(await outcome(sso.ssoAccount(claims('test-owner@example.test'), issuer))).toBe(
      'account-exists',
    );
    expect(
      await outcome(sso.ssoAccount(claims('x@example.test', { email_verified: false }), issuer)),
    ).toBe('unverified');
    expect(await outcome(sso.ssoAccount({ sub: 'no-email' }, issuer))).toBe('unverified');
  });

  it('signs a returning user in without creating another account', async () => {
    await h.db
      .collection('invites')
      .insertOne({
        email: 'back@example.test',
        role: 'Reviewer',
        expiresAt: new Date(Date.now() + 60_000),
      });
    const c = claims('back@example.test');
    const first = await sso.ssoAccount(c, issuer);
    const again = await sso.ssoAccount(c, issuer);
    expect(again).toMatchObject({ id: (first as { id: string }).id });
    expect(await h.db.collection('users').countDocuments({ email: 'back@example.test' })).toBe(1);
  });

  it('sends every callback failure back to the sign-in page with a reason', async () => {
    for (const path of [
      '/auth/oidc/callback?code=x&state=y',
      '/auth/google/callback?code=x&state=y',
    ]) {
      const res = await h.app.inject({ method: 'GET', url: `/api/v1${path}` });
      expect(res.statusCode, path).toBe(302);
      expect(res.headers.location).toBe('/?auth=expired');
    }
    const stale = await h.app.inject({
      method: 'GET',
      url: '/api/v1/auth/google/callback?code=x&state=y',
      cookies: { sdd_google: 'unknown-state' },
    });
    expect(stale.headers.location).toBe('/?auth=expired');
  });

  it('maps outcomes of a callback to redirects and signs in only real users', async () => {
    const redirects: string[] = [];
    const reply = { redirect: (url: string) => redirects.push(url) } as never;
    const signedIn: string[] = [];
    const signIn = async (u: { id: string }) => void signedIn.push(u.id);
    await sso.ssoCallback(reply, 'test', async () => 'pending', signIn);
    await sso.ssoCallback(reply, 'test', async () => ({ id: 'u1' }) as never, signIn);
    await sso.ssoCallback(
      reply,
      'test',
      async () => {
        throw new sso.SsoError('account-exists');
      },
      signIn,
    );
    await sso.ssoCallback(
      reply,
      'test',
      async () => {
        throw new Error('token exchange failed');
      },
      signIn,
    );
    expect(redirects).toEqual(['/?auth=pending', '/', '/?auth=account-exists', '/?auth=failed']);
    expect(signedIn).toEqual(['u1']);
  });
});
