import { bindActor, type Database } from '@tp/db';
import type { RequestContext } from './context';

const BOUND = new WeakSet<RequestContext>();

/**
 * Wraps a use case so it always runs inside a transaction bound to the actor with PostgreSQL
 * Row Level Security active (defence in depth, §14.3). Application-level authorization still
 * runs first; RLS guarantees that a bug there cannot expose another tenant's or client's rows.
 * Nested use cases reuse the bound transaction.
 */
export function secured<A extends unknown[], R>(
  fn: (ctx: RequestContext, ...args: A) => Promise<R>,
) {
  return (ctx: RequestContext, ...args: A): Promise<R> => {
    if (BOUND.has(ctx)) return fn(ctx, ...args);
    return ctx.db.transaction(async (tx) => {
      await bindActor(tx, ctx.actor);
      const bound: RequestContext = { ...ctx, db: tx as unknown as Database };
      BOUND.add(bound);
      return fn(bound, ...args);
    });
  };
}
