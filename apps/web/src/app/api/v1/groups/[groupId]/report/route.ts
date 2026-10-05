import { groupReport } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx, params }) =>
  groupReport(ctx, params.groupId!, { date: req.nextUrl.searchParams.get('date') ?? '' }),
);
