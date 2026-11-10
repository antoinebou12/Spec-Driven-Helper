import type { FastifyReply } from 'fastify';
import { runtimeConfig } from './admin';
import { db } from './db';
import { audit, type User } from './security';
import { HttpError } from './projects';
import { invitationHonoured } from './role-guard';
import { log } from './observability';

/** Reasons shown on the sign-in page after a single sign-on attempt (`/?auth=<code>`). */
export const ssoOutcomes = [
  'pending',
  'invite-required',
  'account-exists',
  'inactive',
  'unverified',
  'expired',
  'failed',
] as const;
export type SsoOutcome = (typeof ssoOutcomes)[number];

export class SsoError extends Error {
  constructor(public outcome: SsoOutcome) {
    super(outcome);
  }
}

type Claims = { sub: string; email?: unknown; email_verified?: unknown; name?: unknown };

/**
 * The same account rules for every identity provider, matching email sign-up:
 * - an invitation creates an active account with the invited role;
 * - without one, and only when registration is open, a disabled Viewer account is requested
 *   for an administrator to activate;
 * - an email that already has an account is never linked automatically.
 */
export async function ssoAccount(claims: Claims, issuer: string): Promise<User | 'pending'> {
  if (!claims.email || claims.email_verified !== true) throw new SsoError('unverified');
  const email = String(claims.email).toLowerCase();
  const existing = await db
    .collection<User>('users')
    .findOne({ oidcSubject: claims.sub, oidcIssuer: issuer } as never);
  if (existing) {
    if (existing.disabled) throw new SsoError('inactive');
    return existing;
  }
  const found = await db.collection('invites').findOne({ email, expiresAt: { $gt: new Date() } });
  // An invitation that could not have been issued today (Owner, or Admin from someone no longer an owner) grants nothing.
  const invite = found && (await invitationHonoured(found)) ? found : null;
  if (!invite && !(await runtimeConfig()).registration) throw new SsoError('invite-required');
  if (await db.collection('users').findOne({ email })) throw new SsoError('account-exists');
  const user = {
    id: crypto.randomUUID(),
    email,
    name: String(claims.name ?? email).slice(0, 100),
    role: invite?.role ?? 'Viewer',
    oidcSubject: claims.sub,
    oidcIssuer: issuer,
    ...(invite ? {} : { disabled: true }),
  };
  await db.collection('users').insertOne(user);
  if (invite) await db.collection('invites').deleteOne({ _id: invite._id });
  await audit(
    user.id,
    invite ? 'auth.sso-account-created' : 'auth.sso-account-requested',
    undefined,
    { issuer },
  );
  return invite ? (user as User) : 'pending';
}

/** Runs a callback and turns every failure into a readable message on the sign-in page. */
export async function ssoCallback(
  reply: FastifyReply,
  provider: string,
  run: () => Promise<User | 'pending'>,
  signIn: (user: User) => Promise<void>,
) {
  try {
    const result = await run();
    if (result === 'pending') return reply.redirect('/?auth=pending');
    await signIn(result);
    return reply.redirect('/');
  } catch (error) {
    const outcome: SsoOutcome =
      error instanceof SsoError
        ? error.outcome
        : error instanceof HttpError && error.statusCode === 400
          ? 'expired'
          : 'failed';
    if (outcome === 'failed')
      log.warn({ provider, err: (error as Error).message }, 'single sign-on failed');
    return reply.redirect(`/?auth=${outcome}`);
  }
}
