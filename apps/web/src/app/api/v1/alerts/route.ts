import { listAlerts } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listAlerts(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
