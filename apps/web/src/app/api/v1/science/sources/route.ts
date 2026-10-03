import { createSource, listSources } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listSources(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
export const POST = authedRoute(async ({ req, ctx }) => createSource(ctx, await readJson(req)));
