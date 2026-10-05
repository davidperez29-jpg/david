import { bindActor, type Database } from '@tp/db';
import { DomainError } from '@tp/domain';
import { reportError } from './observability';
import type { RequestContext } from './context';

/**
 * A malformed id (text that is not a UUID, e.g. /clients/abc) reaching a query makes PostgreSQL
 * fail with 22P02. It names nothing: answer «not found» instead of an internal error. Every other
 * input is validated before any query, so this only catches ids taken from the URL.
 */
function notFoundIfMalformedId(e: unknown): never {
  const code =
    (e as { code?: string } | null)?.code ??
    (e as { cause?: { code?: string } } | null)?.cause?.code;
  if (code === '22P02') throw new DomainError('not_found', 'No encontrado.');
  throw e;
}

const BOUND = new WeakSet<RequestContext>();
type Hook = (root: RequestContext) => Promise<unknown>;
const HOOKS = new WeakMap<RequestContext, Map<string, Hook>>();

/**
 * Schedules system work to run once the use case's transaction has committed (e.g. evaluating
 * monitoring alerts). Hooks receive the unbound context (owner connection, no RLS): they are
 * system code, like the daily job. One hook per key per transaction. Failures are logged and
 * never undo the user's change.
 */
export function afterCommit(ctx: RequestContext, key: string, fn: Hook): void {
  const hooks = HOOKS.get(ctx);
  if (!hooks) throw new Error('afterCommit must be called inside a secured use case');
  if (!hooks.has(key)) hooks.set(key, fn);
}

/** Runs `fn` in a savepoint; the inner context keeps the bound actor and the after-commit hooks. */
export async function withSavepoint<R>(
  ctx: RequestContext,
  fn: (inner: RequestContext) => Promise<R>,
): Promise<R> {
  return ctx.db.transaction(async (tx) => {
    const inner: RequestContext = { ...ctx, db: tx as unknown as Database };
    BOUND.add(inner);
    const hooks = HOOKS.get(ctx);
    if (hooks) HOOKS.set(inner, hooks);
    return fn(inner);
  });
}

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
    const hooks = new Map<string, Hook>();
    return ctx.db
      .transaction(async (tx) => {
        await bindActor(tx, ctx.actor);
        const bound: RequestContext = { ...ctx, db: tx as unknown as Database };
        BOUND.add(bound);
        HOOKS.set(bound, hooks);
        return fn(bound, ...args);
      })
      .catch(notFoundIfMalformedId)
      .then(async (result) => {
        for (const [key, hook] of hooks) {
          try {
            await hook(ctx);
          } catch (e) {
            reportError(e, { hook: key });
          }
        }
        return result;
      });
  };
}
