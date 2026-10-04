import { decideAdjustment } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Accept (applies to future sessions with a plan revision) / edit / reject / postpone. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  decideAdjustment(ctx, params.id!, await readJson(req)),
);
