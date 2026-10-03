import { logSet } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Idempotent by `clientMutationId`. */
export const POST = authedRoute(async ({ req, ctx }) => logSet(ctx, await readJson(req)));
