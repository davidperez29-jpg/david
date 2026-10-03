import { listFindings } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listFindings(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
