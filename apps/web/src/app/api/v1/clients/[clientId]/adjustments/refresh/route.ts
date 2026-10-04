import { refreshAdjustments } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Recomputes the adjustment proposals now (they are also computed after each client event). */
export const POST = authedRoute(async ({ ctx, params }) =>
  refreshAdjustments(ctx, params.clientId!),
);
