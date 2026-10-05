import { trainerHome } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  trainerHome(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
