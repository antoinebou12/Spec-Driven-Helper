import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grantableRoles, inviteRoleAllowed, memberRemovalDenial, roleChangeDenial, roleDenialMessage } from '../packages/shared/src/role-policy';
import { setupApp, type Harness } from './helpers';

/**
 * Root (Owner) and Admin permissions cannot be created through the application, except that an
 * owner may grant Admin. The policy is one shared module; these tests cover the rules themselves and
 * every path that could hand out a role: role changes, invitations, sign-up, single sign-on, project
 * members, and the invitation check at acceptance.
 */
describe('role policy', () => {
  const change = (actor: Parameters<typeof roleChangeDenial>[0]['actor'], next: Parameters<typeof roleChangeDenial>[0]['next'], targetRole?: Parameters<typeof roleChangeDenial>[0]['targetRole'], self = false) =>
    roleChangeDenial({ actor, actorId: 'a', targetId: self ? 'a' : 'b', targetRole, next });

  it('never grants root, whoever asks', () => {
    for (const actor of ['Owner', 'Admin', 'Editor', 'Reviewer', 'Viewer'] as const) expect(grantableRoles(actor)).not.toContain('Owner');
    expect(change('Owner', 'Owner', 'Viewer')).toBe('root');
    expect(change('Admin', 'Owner', 'Editor')).toBe('root');
    expect(change('Owner', 'Owner', undefined)).toBe('root');
    // Keeping an existing owner as owner changes nothing.
    expect(change('Owner', 'Owner', 'Owner')).toBeNull();
  });

  it('lets only an owner grant or change administrators', () => {
    expect(grantableRoles('Owner')).toEqual(['Admin', 'Editor', 'Reviewer', 'Viewer']);
    expect(grantableRoles('Admin')).toEqual(['Editor', 'Reviewer', 'Viewer']);
    expect(grantableRoles('Editor')).toEqual([]);
    expect(change('Owner', 'Admin', 'Viewer')).toBeNull();
    expect(change('Admin', 'Admin', 'Viewer')).toBe('admin-needs-owner');
    expect(change('Admin', 'Viewer', 'Admin')).toBe('admin-needs-owner');
    expect(change('Admin', 'Viewer', 'Owner')).toBe('admin-needs-owner');
    expect(change('Admin', 'Editor', 'Viewer')).toBeNull();
  });

  it('never lets anyone change their own role, and needs admin rights to change any', () => {
    expect(change('Owner', 'Editor', 'Owner', true)).toBe('self');
    expect(change('Admin', 'Owner', 'Admin', true)).toBe('self');
    for (const actor of ['Editor', 'Reviewer', 'Viewer'] as const) expect(change(actor, 'Viewer', 'Editor')).toBe('not-admin');
  });

  it('protects administrators and owners from removal by anyone but an owner', () => {
    const remove = (actor: Parameters<typeof memberRemovalDenial>[0]['actor'], targetRole?: Parameters<typeof memberRemovalDenial>[0]['targetRole'], self = false) => memberRemovalDenial({ actor, actorId: 'a', targetId: self ? 'a' : 'b', targetRole });
    expect(remove('Admin', 'Admin')).toBe('admin-needs-owner');
    expect(remove('Admin', 'Owner')).toBe('admin-needs-owner');
    expect(remove('Owner', 'Admin')).toBeNull();
    expect(remove('Admin', 'Viewer')).toBeNull();
    expect(remove('Admin', 'Viewer', true)).toBe('self');
    expect(remove('Editor', 'Viewer')).toBe('not-admin');
  });

  it('honours an invitation only if it could still be issued', () => {
    expect(inviteRoleAllowed('Owner', 'Owner')).toBe(false);
    expect(inviteRoleAllowed('Admin', 'Owner')).toBe(true);
    expect(inviteRoleAllowed('Admin', 'Admin')).toBe(false);
    expect(inviteRoleAllowed('Admin', undefined)).toBe(false);
    for (const role of ['Editor', 'Reviewer', 'Viewer']) expect(inviteRoleAllowed(role, undefined)).toBe(true);
    for (const role of ['root', 'owner', '', undefined, 3, null]) expect(inviteRoleAllowed(role, 'Owner')).toBe(false);
  });

  it('explains each refusal for the workspace and for projects', () => {
    expect(roleDenialMessage('root', 'workspace')).toMatch(/BOOTSTRAP_EMAIL/);
    expect(roleDenialMessage('root', 'project')).toMatch(/created it/);
    expect(roleDenialMessage('admin-needs-owner', 'project')).toMatch(/project owner/);
    expect(roleDenialMessage('self', 'workspace')).toMatch(/own role/);
  });
});

let h: Harness;
let sso: typeof import('../apps/api/src/sso-accounts');
let security: typeof import('../apps/api/src/security');
beforeAll(async () => {
  h = await setupApp('permissions');
  sso = await import('../apps/api/src/sso-accounts');
  security = await import('../apps/api/src/security');
});
afterAll(async () => h?.teardown());

const setRole = (as: string | undefined, userId: string, role: string) => h.request('PUT', `/users/${userId}/role`, { role }, as);
const denials = () => h.db.collection('audit').countDocuments({ action: 'role.escalation-denied' });
const invite = (as: string | undefined, email: string, role: string) => h.request('POST', '/auth/invites', { email, role }, as);

describe('workspace roles', () => {
  it('has one root, from the bootstrap, and no way to create another', async () => {
    const root = await h.db.collection('users').findOne({ role: 'Owner' });
    const admin = await h.userWith('Admin');
    const editor = await h.userWith('Editor');
    const before = await denials();
    expect((await setRole(undefined, editor.user.id, 'Owner')).statusCode).toBe(403);
    expect((await setRole(admin.cookie, editor.user.id, 'Owner')).statusCode).toBe(403);
    expect((await setRole(admin.cookie, admin.user.id, 'Owner')).statusCode).toBe(403);
    expect((await invite(undefined, 'root@example.test', 'Owner')).statusCode).toBe(400);
    expect((await invite(admin.cookie, 'root@example.test', 'Owner')).statusCode).toBe(400);
    expect(await h.db.collection('users').countDocuments({ role: 'Owner' })).toBe(1);
    expect((await h.db.collection('users').findOne({ role: 'Owner' }))!.id).toBe(root!.id);
    expect(await denials()).toBe(before + 3);
    expect(await h.db.collection('audit').findOne({ action: 'role.escalation-denied', 'details.denial': 'root' })).toMatchObject({ userId: expect.any(String), details: { scope: 'workspace', to: 'Owner' } });
  });

  it('lets an owner, and only an owner, grant administrator access', async () => {
    const admin = await h.userWith('Admin');
    const editor = await h.userWith('Editor');
    const target = await h.userWith('Viewer');
    expect((await setRole(editor.cookie, target.user.id, 'Editor')).statusCode).toBe(403);
    expect((await setRole(admin.cookie, target.user.id, 'Admin')).statusCode).toBe(403);
    expect((await invite(admin.cookie, 'a@example.test', 'Admin')).statusCode).toBe(403);
    expect((await invite(editor.cookie, 'e@example.test', 'Viewer')).statusCode).toBe(403);
    expect((await h.db.collection('users').findOne({ id: target.user.id }))!.role).toBe('Viewer');
    expect((await invite(undefined, 'a@example.test', 'Admin')).statusCode).toBe(200);
    expect((await setRole(undefined, target.user.id, 'Admin')).statusCode).toBe(200);
    expect((await h.db.collection('users').findOne({ id: target.user.id }))!.role).toBe('Admin');
    expect((await invite(admin.cookie, 'v@example.test', 'Viewer')).statusCode).toBe(200);
  });

  it('never changes your own role and shields administrators and owners from other administrators', async () => {
    const admin = await h.userWith('Admin');
    const other = await h.userWith('Admin');
    const viewer = await h.userWith('Viewer');
    const root = await h.db.collection('users').findOne({ role: 'Owner' });
    expect((await setRole(admin.cookie, admin.user.id, 'Viewer')).statusCode).toBe(403);
    expect((await setRole(admin.cookie, other.user.id, 'Viewer')).statusCode).toBe(403);
    expect((await setRole(admin.cookie, root!.id, 'Viewer')).statusCode).toBe(403);
    expect((await h.request('POST', `/users/${other.user.id}/deactivate`, {}, admin.cookie)).statusCode).toBe(403);
    expect((await h.request('POST', `/users/${root!.id}/deactivate`, {}, admin.cookie)).statusCode).toBe(403);
    expect((await h.request('POST', `/users/${viewer.user.id}/deactivate`, {}, admin.cookie)).statusCode).toBe(200);
    expect((await h.db.collection('users').findOne({ id: other.user.id }))!.role).toBe('Admin');
    // The owner keeps the last-owner protection and cannot demote themself either.
    expect((await setRole(undefined, root!.id, 'Admin')).statusCode).toBe(403);
    expect((await h.request('POST', `/users/${root!.id}/deactivate`, {})).statusCode).toBe(400);
  });
});

describe('accounts that arrive without an owner deciding', () => {
  it('turns a sign-up into a disabled viewer whatever the request says, and activation keeps it a viewer', async () => {
    await h.request('PUT', '/admin/configuration', { registration: true });
    try {
      const res = await h.request('POST', '/auth/signup', { name: 'Mallory', email: 'mallory@example.test', password: 'a-long-enough-password', role: 'Owner', disabled: false }, '');
      expect(res.statusCode).toBe(200);
      const created = await h.db.collection('users').findOne({ email: 'mallory@example.test' });
      expect(created).toMatchObject({ role: 'Viewer', disabled: true });
      expect((await h.request('POST', '/auth/login', { email: 'mallory@example.test', password: 'a-long-enough-password' }, '')).statusCode).toBe(401);
      await h.request('POST', `/admin/users/${created!.id}/activate`);
      expect(await h.db.collection('users').findOne({ email: 'mallory@example.test' })).toMatchObject({ role: 'Viewer', disabled: false });
    } finally {
      await h.request('PUT', '/admin/configuration', { registration: false });
    }
  });

  it('honours an administrator invitation only from a current owner, and never an owner invitation', async () => {
    const root = await h.db.collection('users').findOne({ role: 'Owner' });
    const admin = await h.userWith('Admin');
    const accept = (value: string) => h.request('POST', '/auth/accept-invite', { token: value, name: 'Invitee', password: 'a-long-enough-password' }, '');
    const seed = async (email: string, role: string, invitedBy?: string) => {
      const value = `token-${crypto.randomUUID()}`;
      await h.db.collection('invites').insertOne({ email, role, token: security.digest(value), invitedBy, expiresAt: new Date(Date.now() + 3_600_000) });
      return value;
    };
    // Records that no route would write today, planted directly: the check happens at acceptance.
    expect((await accept(await seed('root2@example.test', 'Owner', root!.id))).statusCode).toBe(400);
    expect((await accept(await seed('admin2@example.test', 'Admin', admin.user.id))).statusCode).toBe(400);
    expect((await accept(await seed('admin3@example.test', 'Admin', undefined))).statusCode).toBe(400);
    for (const email of ['root2', 'admin2', 'admin3']) expect(await h.db.collection('users').findOne({ email: `${email}@example.test` })).toBeNull();
    const ok = await accept(await seed('admin4@example.test', 'Admin', root!.id));
    expect(ok.statusCode).toBe(200);
    expect(ok.json().role).toBe('Admin');
    const editor = await accept(await seed('editor4@example.test', 'Editor', admin.user.id));
    expect(editor.json().role).toBe('Editor');
  });

  it('gives single sign-on no more than an honoured invitation', async () => {
    const issuer = 'https://id.example.test';
    const claims = (email: string) => ({ sub: crypto.randomUUID(), email, email_verified: true, name: 'Eve' });
    await h.db.collection('invites').insertOne({ email: 'sso-root@example.test', role: 'Owner', invitedBy: 'nobody', expiresAt: new Date(Date.now() + 60_000) });
    await expect(sso.ssoAccount(claims('sso-root@example.test'), issuer)).rejects.toMatchObject({ outcome: 'invite-required' });
    expect(await h.db.collection('users').findOne({ email: 'sso-root@example.test' })).toBeNull();
    const root = await h.db.collection('users').findOne({ role: 'Owner' });
    await h.db.collection('invites').insertOne({ email: 'sso-admin@example.test', role: 'Admin', invitedBy: root!.id, expiresAt: new Date(Date.now() + 60_000) });
    expect(await sso.ssoAccount(claims('sso-admin@example.test'), issuer)).toMatchObject({ role: 'Admin' });
  });
});

describe('project roles', () => {
  it('keeps project ownership with its creator, and lets only the project owner grant admin', async () => {
    const p = await h.createProject({ name: 'Members' });
    const admin = await h.userWith('Editor', { projectId: p.id, role: 'Admin' });
    const other = await h.userWith('Editor');
    const third = await h.userWith('Viewer');
    const add = (as: string | undefined, email: string, role: string) => h.request('POST', `/projects/${p.id}/members`, { email, role }, as);
    const before = await denials();

    // Nobody grants project ownership: not the owner, not an administrator.
    expect((await add(undefined, other.user.email, 'Owner')).statusCode).toBe(403);
    expect((await add(admin.cookie, other.user.email, 'Owner')).statusCode).toBe(403);
    // A project administrator manages the people below them, not other administrators.
    expect((await add(admin.cookie, other.user.email, 'Admin')).statusCode).toBe(403);
    expect((await add(admin.cookie, other.user.email, 'Editor')).statusCode).toBe(200);
    expect((await add(admin.cookie, admin.user.email, 'Viewer')).statusCode).toBe(403);
    expect((await add(undefined, other.user.email, 'Admin')).statusCode).toBe(200);
    expect((await add(admin.cookie, other.user.email, 'Viewer')).statusCode).toBe(403);
    expect((await h.project(p.id)).role).toBe('Owner');
    expect(await denials()).toBe(before + 5);

    const members = (await h.request('GET', `/projects/${p.id}/members`)).json();
    expect(members.filter((m: { role: string }) => m.role === 'Owner')).toHaveLength(1);
    expect(members.find((m: { id: string }) => m.id === other.user.id).role).toBe('Admin');

    // Removing administrators and the owner is for the owner; ordinary members can be removed by an administrator.
    await add(undefined, third.user.email, 'Viewer');
    const ownerId = (await h.db.collection('users').findOne({ role: 'Owner' }))!.id;
    expect((await h.request('DELETE', `/projects/${p.id}/members/${other.user.id}`, undefined, admin.cookie)).statusCode).toBe(403);
    expect((await h.request('DELETE', `/projects/${p.id}/members/${ownerId}`, undefined, admin.cookie)).statusCode).toBe(403);
    expect((await h.request('DELETE', `/projects/${p.id}/members/${third.user.id}`, undefined, admin.cookie)).statusCode).toBe(200);
    expect((await h.request('DELETE', `/projects/${p.id}/members/${other.user.id}`)).statusCode).toBe(200);
  });

  it('keeps the project owner in place, and records a role change once', async () => {
    const p = await h.createProject({ name: 'Owner stays' });
    const admin = await h.userWith('Editor', { projectId: p.id, role: 'Admin' });
    const member = await h.userWith('Viewer');
    const members = (await h.request('GET', `/projects/${p.id}/members`, undefined, admin.cookie)).json();
    const creator = members.find((m: { role: string }) => m.role === 'Owner');
    // The project's owner is its creator, and stays so; an administrator cannot touch them.
    expect((await h.request('POST', `/projects/${p.id}/members`, { email: creator.email, role: 'Viewer' }, admin.cookie)).statusCode).toBe(403);
    expect((await h.request('GET', `/projects/${p.id}/members`)).json().find((m: { role: string }) => m.role === 'Owner').email).toBe(creator.email);
    // Setting a role someone already has changes and records nothing.
    for (let i = 0; i < 2; i++) expect((await h.request('POST', `/projects/${p.id}/members`, { email: member.user.email, role: 'Editor' }, admin.cookie)).statusCode).toBe(200);
    expect(await h.db.collection('audit').countDocuments({ action: 'membership.updated', projectId: p.id })).toBe(1);
    // Someone who is not in the workspace cannot be added, whatever the role.
    expect((await h.request('POST', `/projects/${p.id}/members`, { email: 'nobody@example.test', role: 'Viewer' })).statusCode).toBe(404);
  });
});
