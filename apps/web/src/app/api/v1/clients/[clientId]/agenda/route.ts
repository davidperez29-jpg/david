import { clientAgenda } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx, params }) =>
  clientAgenda(ctx, params.clientId!, Object.fromEntries(req.nextUrl.searchParams)),
);
