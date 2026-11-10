import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { registerDiagrams } from './diagrams';
import * as oidc from 'openid-client';
import { db } from './db';
import { authenticate, getUser, session, token, digest, audit, type User } from './security';
import { can } from '../../../packages/shared/src/domain';
import { grantableRoles, memberRemovalDenial, roleChangeDenial } from '../../../packages/shared/src/role-policy';
import { enforceRolePolicy, invitationHonoured } from './role-guard';
import { HttpError } from './projects';
import { metrics, redactPaths } from './observability';
import { registerSpecRoutes } from './specs';
import { registerReviewRoutes } from './review';
import { registerAiRoutes } from './ai';
import { registerBuilderAgentRoutes } from './builder-agent';
import { registerCatalogRoutes } from './catalog';
import { registerGitRoutes } from './git';
import { registerConnectors } from './connectors';
import { registerPublishing } from './publishing';
import { registerImportRoutes } from './importer';
import { registerBoard } from './board';
import { registerMcp } from './mcp';
import { features, registerFeatures } from './features';
import { registerObservability } from './admin-observability';
import { registerPlanFolder } from './plan-folder';
import { registerOpenSpec } from './openspec';
import { registerAio } from './aio';
import { registerDashboard } from './dashboard';
import { collectRoutes, registerOpenApi } from './openapi';
import { registerAdmin,runtimeConfig } from './admin';
import { registerExampleDataRoutes } from './example-data';
import { registerGoogleAuth } from './google-auth';
import { SsoError, ssoAccount, ssoCallback } from './sso-accounts';
import { registerSearch } from './search';
import type { Auth } from './auth-types';

export { HttpError, projectFor, saveSpec } from './projects';

const appOrigin = () => process.env.APP_ORIGIN ?? 'http://localhost:5173';
const allowedOrigins = () =>
  new Set([
    appOrigin(),
    ...(process.env.APP_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
const safeUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info', redact: redactPaths },
    bodyLimit: 3_000_000,
    trustProxy: process.env.TRUST_PROXY === 'true',
  });
  await app.register(cookie);
  // Requests per minute per client address; raise it for load tests or a proxy that shares one address.
  await app.register(rateLimit, { max: Number(process.env.RATE_LIMIT_MAX) || 300, timeWindow: '1 minute' });
  const routes = collectRoutes(app);
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'same-origin')
      .header('X-Frame-Options', 'DENY')
      .header('Content-Security-Policy', contentSecurityPolicy);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins().has(origin))
        throw new HttpError(403, 'Request origin is not allowed');
    }
  });
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url ?? 'unmatched';
    const labels = { method: req.method, route, status: String(reply.statusCode) };
    metrics.counter('sdd_http_requests_total', 'HTTP requests by route and status', labels);
    metrics.observe('sdd_http_request_duration_seconds', 'HTTP request duration', { route }, reply.elapsedTime / 1000);
  });
  app.setErrorHandler((error: any, req, reply) => {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      const where = first?.path.length ? ` (${first.path.join('.')})` : '';
      return reply.code(400).send({ error: `Invalid input${where}: ${first?.message ?? 'check the values'}`, details: error.issues });
    }
    const code =
      error instanceof HttpError
        ? error.statusCode
        : typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
    if (code >= 500) req.log.error({ message: error.message }, 'request failed');
    reply.code(code).send({
      error: code >= 500 ? 'The operation could not be completed. Check the server logs.' : error.message,
      ...(error instanceof HttpError ? error.details : {}),
    });
  });
  const auth: Auth = async (req) => {
    const u = await getUser(req.cookies.sdd_session);
    if (!u) throw new HttpError(401, 'Please sign in');
    req.user = u;
  };
  const setSession = async (reply: FastifyReply, u: User) => {
    reply.setCookie('sdd_session', await session(u.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: appOrigin().startsWith('https:'),
      path: '/',
      maxAge: 604800,
    });
  };

  // ---- Health and metrics -------------------------------------------------------------------
  app.get('/api/health/live', async () => ({ status: 'ok' }));
  app.get('/api/health', async () => {
    await db.command({ ping: 1 });
    return { status: 'ok' };
  });
  app.get('/api/metrics', async (req: FastifyRequest, reply) => {
    const expected = process.env.METRICS_TOKEN;
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
    if (expected ? req.headers.authorization !== `Bearer ${expected}` : !local)
      throw new HttpError(403, 'Metrics require METRICS_TOKEN or a local request');
    const jobs = await db
      .collection('jobs')
      .aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
      .toArray();
    const pending = await db.collection('proposals').countDocuments({ status: 'pending' });
    reply.type('text/plain; version=0.0.4');
    return metrics.render([
      ...jobs.map((j) => ({ name: 'sdd_jobs', description: 'Jobs by status', labels: { status: String(j._id) }, value: j.n })),
      { name: 'sdd_pending_proposals', description: 'Proposals awaiting review', value: pending },
      { name: 'sdd_process_resident_bytes', description: 'Resident memory', value: process.memoryUsage().rss },
    ]);
  });

  // ---- Authentication -----------------------------------------------------------------------
  app.get('/api/v1/auth/options', async () => {const [c,f]=await Promise.all([runtimeConfig(),features()]);return {oidc:f.sso&&!!c.oidcIssuer,google:f.googleSignIn&&!!c.googleClientId&&!!c.googleSecret,registration:c.registration,local:true};});
  app.post(
    '/api/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const b = z.object({ email: z.string().email(), password: z.string().max(200) }).parse(req.body);
      const u = await authenticate(b.email, b.password);
      if (!u) throw new HttpError(401, 'Invalid email or password');
      await setSession(reply, u);
      return safeUser(u);
    },
  );
  app.post('/api/v1/auth/logout', async (req, reply) => {
    if (req.cookies.sdd_session)
      await db.collection('sessions').deleteOne({ token: digest(req.cookies.sdd_session) });
    reply.clearCookie('sdd_session', { path: '/' });
    return { ok: true };
  });
  app.get('/api/v1/auth/me', { preHandler: auth }, async (req: any) => safeUser(req.user));
  app.post('/api/v1/auth/invites', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
    const b = z
      .object({ email: z.string().email(), role: z.enum(['Admin', 'Editor', 'Reviewer', 'Viewer']) })
      .parse(req.body);
    // Owner is not an invitable role at all; Admin only from an owner.
    await enforceRolePolicy(grantableRoles(req.user.role).includes(b.role) ? null : 'admin-needs-owner', 'workspace', req.user.id, { invited: b.role });
    const value = token();
    await db.collection('invites').insertOne({
      email: b.email.toLowerCase(),
      role: b.role,
      token: digest(value),
      invitedBy: req.user.id,
      expiresAt: new Date(Date.now() + 86400000 * 3),
    });
    await audit(req.user.id, 'invite.created', undefined, { email: b.email.toLowerCase(), role: b.role });
    return { url: `${appOrigin()}/?invite=${value}` };
  });
  app.post(
    '/api/v1/auth/accept-invite',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const b = z
        .object({ token: z.string(), name: z.string().min(1).max(100), password: z.string().min(12).max(200) })
        .parse(req.body);
      const invite = await db
        .collection('invites')
        .findOne({ token: digest(b.token), expiresAt: { $gt: new Date() } });
      if (!invite || !(await invitationHonoured(invite))) throw new HttpError(400, 'Invitation expired or invalid');
      const u: User = {
        id: crypto.randomUUID(),
        name: b.name,
        email: invite.email,
        role: invite.role,
        passwordHash: await hash(b.password, 12),
      };
      try {
        await db.collection('users').insertOne(u);
      } catch {
        throw new HttpError(409, 'An account with this email already exists');
      }
      await db.collection('invites').deleteOne({ _id: invite._id });
      await audit(u.id, 'invite.accepted');
      await setSession(reply, u);
      return safeUser(u);
    },
  );
  const getOIDC = async () => {
    const c = await runtimeConfig();
    if (!c.oidcIssuer || !c.oidcClientId)
      throw new HttpError(503, 'OIDC is not configured');
    return oidc.discovery(new URL(c.oidcIssuer), c.oidcClientId, c.oidcSecret);
  };
  app.get('/api/v1/auth/oidc', async (_req, reply) => {
    const config = await getOIDC(),
      verifier = oidc.randomPKCECodeVerifier(),
      state = oidc.randomState(),
      nonce = oidc.randomNonce();
    await db.collection('sessions').insertOne({
      oidcState: digest(state),
      verifier,
      nonce,
      expiresAt: new Date(Date.now() + 600000),
    });
    reply.setCookie('sdd_oidc', state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: appOrigin().startsWith('https:'),
      maxAge: 600,
    });
    return reply.redirect(
      oidc.buildAuthorizationUrl(config, {
        redirect_uri: `${appOrigin()}/api/v1/auth/oidc/callback`,
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
      }).href,
    );
  });
  app.get('/api/v1/auth/oidc/callback', async (req, reply) => {
    const state = req.cookies.sdd_oidc;
    reply.clearCookie('sdd_oidc', { path: '/' });
    return ssoCallback(
      reply,
      'oidc',
      async () => {
        if (!state) throw new HttpError(400, 'Missing sign-in state');
        const stored = await db
          .collection('sessions')
          .findOneAndDelete({ oidcState: digest(state), expiresAt: { $gt: new Date() } });
        if (!stored) throw new HttpError(400, 'Sign-in expired');
        const config = await getOIDC();
        const tokens = await oidc.authorizationCodeGrant(config, new URL(req.url, appOrigin()), {
          pkceCodeVerifier: stored.verifier,
          expectedState: state,
          expectedNonce: stored.nonce,
        });
        const claims = tokens.claims();
        if (!claims) throw new SsoError('unverified');
        return ssoAccount(claims, config.serverMetadata().issuer);
      },
      (u) => setSession(reply, u),
    );
  });

  // ---- Workspace users ----------------------------------------------------------------------
  app.get('/api/v1/users', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
    const users = await db.collection<User>('users').find({}).sort({ name: 1 }).toArray();
    return users.map((u) => ({ ...safeUser(u), disabled: !!u.disabled }));
  });
  app.put('/api/v1/users/:userId/role', { preHandler: auth }, async (req: any) => {
    const b = z.object({ role: z.enum(['Owner', 'Admin', 'Editor', 'Reviewer', 'Viewer']) }).parse(req.body);
    const target = await db.collection<User>('users').findOne({ id: req.params.userId });
    if (!target) throw new HttpError(404, 'User not found');
    // Owner (root) is never granted here; only an owner grants or changes administrators; nobody changes their own role.
    const actor = req.user as User;
    await enforceRolePolicy(roleChangeDenial({ actor: actor.role, actorId: actor.id, targetId: target.id, targetRole: target.role, next: b.role }), 'workspace', actor.id, { userId: target.id, from: target.role, to: b.role });
    if (target.role === b.role) return { ok: true };
    if (target.role === 'Owner' && b.role !== 'Owner') {
      const owners = await db.collection('users').countDocuments({ role: 'Owner', disabled: { $ne: true } });
      if (owners <= 1) throw new HttpError(409, 'Assign another owner before changing the last owner');
    }
    await db.collection('users').updateOne({ id: target.id }, { $set: { role: b.role } });
    await audit(actor.id, 'user.role-changed', undefined, { userId: target.id, from: target.role, to: b.role });
    return { ok: true };
  });
  app.post('/api/v1/users/:userId/deactivate', { preHandler: auth }, async (req: any) => {
    const actor = req.user as User;
    if (!can(actor.role, 'admin')) throw new HttpError(403, 'Administrator access required');
    const target = await db.collection<User>('users').findOne({ id: req.params.userId });
    if (!target) throw new HttpError(404, 'User not found');
    if (target.id === actor.id) throw new HttpError(400, 'You cannot deactivate your own account');
    await enforceRolePolicy(memberRemovalDenial({ actor: actor.role, actorId: actor.id, targetId: target.id, targetRole: target.role }), 'workspace', actor.id, { userId: target.id, action: 'deactivate' });
    if (target.role === 'Owner') {
      const owners = await db.collection('users').countDocuments({ role: 'Owner', disabled: { $ne: true } });
      if (owners <= 1) throw new HttpError(409, 'The last owner cannot be deactivated');
    }
    await db.collection('users').updateOne({ id: target.id }, { $set: { disabled: true } });
    await db.collection('sessions').deleteMany({ userId: target.id });
    await audit(actor.id, 'user.deactivated', undefined, { userId: target.id });
    return { ok: true };
  });
  app.get('/api/v1/audit', { preHandler: auth }, async (req: any) => {
    if (!can(req.user.role, 'admin')) throw new HttpError(403, 'Administrator access required');
    return db.collection('audit').find({}, { projection: { _id: 0 } }).sort({ at: -1 }).limit(200).toArray();
  });

  await registerFeatures(app, auth);
  await registerObservability(app, auth);
  await registerPlanFolder(app, auth);
  await registerOpenSpec(app, auth);
  await registerAio(app);
  await registerDashboard(app, auth);
  await registerCatalogRoutes(app, auth);
  await registerSpecRoutes(app, auth);
  await registerReviewRoutes(app, auth);
  await registerAiRoutes(app, auth);
  await registerBuilderAgentRoutes(app, auth);
  await registerGitRoutes(app, auth);
  await registerConnectors(app, auth);
  await registerPublishing(app, auth);
  await registerImportRoutes(app, auth);
  await registerBoard(app, auth);
  await registerMcp(app, auth);
  await registerOpenApi(app, auth, routes);
  await registerAdmin(app,auth);
  await registerExampleDataRoutes(app, auth);
  await registerGoogleAuth(app);
  await registerSearch(app,auth);
  await registerDiagrams(app,auth);

  // The documentation website (pnpm docs:site) is public, like the sign-in page.
  const docsSite = resolve('dist/docs-site');
  if (existsSync(docsSite)) {
    await app.register(staticFiles, { root: docsSite, prefix: '/docs/', decorateReply: false, index: 'index.html' });
    app.get('/docs', async (_req, reply) => reply.redirect('/docs/'));
  }
  const web = resolve('dist/web');
  if (existsSync(web)) {
    await app.register(staticFiles, { root: web });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/') || req.url.startsWith('/docs/') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html'),
    );
  }
  return app;
}

