import { injuryComparison } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx, params }) =>
  injuryComparison(
    ctx,
    params.clientId!,
    params.injuryId!,
    Object.fromEntries(req.nextUrl.searchParams),
  ),
);
