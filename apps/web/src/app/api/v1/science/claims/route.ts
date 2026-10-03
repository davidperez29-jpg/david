import { createClaim, listClaims } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listClaims(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
export const POST = authedRoute(async ({ req, ctx }) => createClaim(ctx, await readJson(req)));
