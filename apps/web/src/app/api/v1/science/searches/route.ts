import { createScienceSearch, listScienceSearches } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listScienceSearches(ctx, { topic: req.nextUrl.searchParams.get('topic') ?? undefined }),
);
export const POST = authedRoute(async ({ req, ctx }) =>
  createScienceSearch(ctx, await readJson(req)),
);
