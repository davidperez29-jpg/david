import { createGroup, listGroups } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listGroups(ctx, { archived: req.nextUrl.searchParams.get('archived') === 'true' }),
);
export const POST = authedRoute(async ({ req, ctx }) => createGroup(ctx, await readJson(req)));
