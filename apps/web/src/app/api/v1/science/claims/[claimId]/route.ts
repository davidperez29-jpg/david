import { getClaim, updateClaim } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getClaim(ctx, params.claimId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateClaim(ctx, params.claimId!, await readJson(req)),
);
