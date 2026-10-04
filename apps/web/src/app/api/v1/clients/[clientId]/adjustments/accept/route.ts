import { acceptAdjustments } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Accept several proposals at once; each one is applied and audited individually. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  acceptAdjustments(ctx, params.clientId!, await readJson(req)),
);
