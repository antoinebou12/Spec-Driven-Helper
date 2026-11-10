import { can } from './domain';
import type { Role } from './schema';

/**
 * Who may hand out which role, in one place, for the workspace and for projects.
 *
 * - **Root (Owner) is never granted through the application.** The workspace owner comes from
 *   BOOTSTRAP_EMAIL at deployment; a project's owner is the person who created it. No route,
 *   invitation, sign-up or single sign-on flow can create either.
 * - **Admin is granted only by an owner.** Administrators manage people below them.
 * - Nobody changes their own role, so no one can promote themselves.
 * - Only an owner may change or remove an administrator or an owner.
 */
export type RoleDenial = 'not-admin' | 'self' | 'root' | 'admin-needs-owner';
export type RoleScope = 'workspace' | 'project';

const elevated = (role?: Role) => role === 'Owner' || role === 'Admin';

/** Roles an actor may give to others (invitations and role changes). Never includes Owner. */
export function grantableRoles(actor: Role): Role[] {
  if (actor === 'Owner') return ['Admin', 'Editor', 'Reviewer', 'Viewer'];
  if (actor === 'Admin') return ['Editor', 'Reviewer', 'Viewer'];
  return [];
}

/** Why `actor` may not give `next` to the target, or null when the change is allowed. */
export function roleChangeDenial(input: { actor: Role; actorId: string; targetId: string; targetRole?: Role; next: Role }): RoleDenial | null {
  const { actor, actorId, targetId, targetRole, next } = input;
  if (!can(actor, 'admin')) return 'not-admin';
  if (actorId === targetId) return 'self';
  if (next === 'Owner') return targetRole === 'Owner' ? null : 'root';
  if ((elevated(next) || elevated(targetRole)) && actor !== 'Owner') return 'admin-needs-owner';
  return null;
}

/** Why `actor` may not remove or deactivate the target, or null when allowed. */
export function memberRemovalDenial(input: { actor: Role; actorId: string; targetId: string; targetRole?: Role }): RoleDenial | null {
  const { actor, actorId, targetId, targetRole } = input;
  if (!can(actor, 'admin')) return 'not-admin';
  if (actorId === targetId) return 'self';
  if (elevated(targetRole) && actor !== 'Owner') return 'admin-needs-owner';
  return null;
}

const messages: Record<RoleScope, Record<RoleDenial, string>> = {
  workspace: {
    'not-admin': 'Administrator access required',
    self: 'You cannot change your own role',
    root: 'The owner role cannot be granted here. The workspace owner is set at deployment (BOOTSTRAP_EMAIL).',
    'admin-needs-owner': 'Only the workspace owner can grant or change administrator access',
  },
  project: {
    'not-admin': 'Project administrator access required',
    self: 'You cannot change your own role',
    root: 'Project ownership cannot be granted. A project’s owner is the person who created it.',
    'admin-needs-owner': 'Only the project owner can grant or change administrator access',
  },
};
export const roleDenialMessage = (denial: RoleDenial, scope: RoleScope) => messages[scope][denial];

/**
 * An invitation is honoured when it is accepted, not only when it was written: it may never carry
 * Owner, and an Admin invitation counts only while the person who issued it is still an owner.
 */
export function inviteRoleAllowed(role: unknown, inviterRole: Role | undefined): role is Role {
  if (role === 'Owner' || role === undefined) return false;
  if (role === 'Admin') return inviterRole === 'Owner';
  return role === 'Editor' || role === 'Reviewer' || role === 'Viewer';
}
