/**
 * "Something changed for this client" after a transaction commits. Modules that react to client
 * activity (monitoring alerts) subscribe here, so producers (assessments, sessions) do not depend
 * on them. Handlers run as system code after commit (see `afterCommit`).
 */
import type { RequestContext } from './context';
import { afterCommit } from './rls';

type Handler = (root: RequestContext, clientId: string) => Promise<unknown>;
const handlers: Handler[] = [];

export function onClientActivity(handler: Handler): void {
  handlers.push(handler);
}

export function clientActivity(ctx: RequestContext, clientId: string): void {
  afterCommit(ctx, `client-activity:${clientId}`, async (root) => {
    for (const h of handlers) await h(root, clientId);
  });
}
