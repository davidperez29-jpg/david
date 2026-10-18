import { createHmac } from 'node:crypto';
import { hashPassword, revokeAllSessions } from '@tp/auth';
import { schema, type Database } from '@tp/db';
import { eq, sql } from 'drizzle-orm';
import { rolesOf } from './actor';
import { assertPasswordPolicy } from './auth-service';

const { users, appState, auditLogs } = schema;
const KEY = 'host_admin_password';

export type HostAdminPasswordResult = 'remembered' | 'unchanged' | 'replaced' | 'not_admin';

/**
 * Owner recovery (restructure phase 23). ADMIN_PASSWORD, typed in the host's form, is the first
 * administrator's password. If the only administrator forgets it, nobody can create a link for
 * them: changing ADMIN_PASSWORD in the host is the way back. The start-up setup then runs again
 * (the start-up gate includes that setting) and this replaces the password, unlocks the account
 * and closes its sessions; two-step verification stays as it was.
 *
 * Only a keyed fingerprint of the last value seen is kept (app_state), so a new release with the
 * same value never undoes a password changed in the app. The first time there is nothing to
 * compare with: the value is only remembered.
 */
export async function applyHostAdminPassword(
  db: Database,
  input: { email: string; password: string; key: string; now?: Date },
): Promise<HostAdminPasswordResult> {
  const email = input.email.trim().toLowerCase();
  const now = input.now ?? new Date();
  const fingerprint = createHmac('sha256', input.key)
    .update(JSON.stringify(['admin-password', email, input.password]))
    .digest('hex');
  const remember = () =>
    db
      .insert(appState)
      .values({ key: KEY, value: fingerprint, updatedAt: now })
      .onConflictDoUpdate({ target: appState.key, set: { value: fingerprint, updatedAt: now } });

  const [seen] = await db.select().from(appState).where(eq(appState.key, KEY));
  if (!seen) {
    await remember();
    return 'remembered';
  }
  if (seen.value === fingerprint) return 'unchanged';

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  if (!user || !(await rolesOf(db, user.id)).includes('ADMIN')) return 'not_admin';
  // A value that breaks the policy is reported by the caller and tried again on the next start.
  assertPasswordPolicy(input.password, email);
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
    await revokeAllSessions(tx, user.id, now);
    await tx.insert(auditLogs).values({
      occurredAt: now,
      organizationId: user.organizationId,
      actorUserId: null,
      actorRoles: null,
      action: 'password_reset',
      entityType: 'user',
      entityId: user.id,
      reason: 'ADMIN_PASSWORD cambiada en el alojamiento',
    });
    await tx
      .insert(appState)
      .values({ key: KEY, value: fingerprint, updatedAt: now })
      .onConflictDoUpdate({ target: appState.key, set: { value: fingerprint, updatedAt: now } });
  });
  return 'replaced';
}
