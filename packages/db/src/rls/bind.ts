import { sql } from 'drizzle-orm';
import type { Executor } from '../client';

export interface RlsActor {
  organizationId: string;
  userId: string;
  roles: readonly string[];
  trainerId?: string | null;
  clientId?: string | null;
}

/**
 * Binds the acting user to the current transaction: sets the `app.*` settings read by the RLS
 * helper functions and switches to the non-privileged `app_runtime` role (transaction-local).
 * Must be called inside a transaction.
 */
export async function bindActor(tx: Executor, actor: RlsActor): Promise<void> {
  await tx.execute(sql`SELECT
    set_config('app.org_id', ${actor.organizationId}, true),
    set_config('app.user_id', ${actor.userId}, true),
    set_config('app.roles', ${actor.roles.join(',')}, true),
    set_config('app.trainer_id', ${actor.trainerId ?? ''}, true),
    set_config('app.client_id', ${actor.clientId ?? ''}, true),
    set_config('role', 'app_runtime', true)`);
}
