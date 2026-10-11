import { listPendingVideos } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Videos of the centre's exercises waiting for a person to watch them. */
export const GET = authedRoute(async ({ req, ctx }) =>
  listPendingVideos(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
