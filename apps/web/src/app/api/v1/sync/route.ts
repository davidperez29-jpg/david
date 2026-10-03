import { syncMutations } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Offline queue replay (§4.5): per-mutation results, never duplicates. */
export const POST = authedRoute(async ({ req, ctx }) => syncMutations(ctx, await readJson(req)));
