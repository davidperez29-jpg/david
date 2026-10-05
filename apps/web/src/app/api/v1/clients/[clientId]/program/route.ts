import { programView } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Programa tab: plan → months → weeks → sessions (query: plan, week, session). */
export const GET = authedRoute(async ({ req, ctx, params }) =>
  programView(ctx, params.clientId!, Object.fromEntries(req.nextUrl.searchParams)),
);
