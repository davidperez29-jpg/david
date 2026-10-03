import { setClaimStatus } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  setClaimStatus(ctx, params.claimId!, await readJson(req)),
);
