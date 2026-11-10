import { db } from './db';
import { audit, type User } from './security';
import { HttpError } from './projects';
import { inviteRoleAllowed, roleDenialMessage, type RoleDenial, type RoleScope } from '../../../packages/shared/src/role-policy';

/**
 * Applies the role policy (`role-policy.ts`) to a request. A denied change is a 403, and an attempt to
 * reach root, administrator or one's own elevation is written to the audit log so it can be reviewed.
 */
export async function enforceRolePolicy(denial: RoleDenial | null, scope: RoleScope, actorId: string, details: Record<string, unknown>, projectId?: string) {
  if (!denial) return;
  if (denial !== 'not-admin') await audit(actorId, 'role.escalation-denied', projectId, { scope, denial, ...details });
  throw new HttpError(403, roleDenialMessage(denial, scope));
}

/** Whether an invitation may still create an account with its role (never Owner; Admin only from a current owner). */
export async function invitationHonoured(invite: { role?: unknown; invitedBy?: unknown }) {
  const inviter = invite.invitedBy ? await db.collection<User>('users').findOne({ id: String(invite.invitedBy), disabled: { $ne: true } }) : null;
  return inviteRoleAllowed(invite.role, inviter?.role);
}
