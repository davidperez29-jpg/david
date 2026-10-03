import { createClient, listClients } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listClients(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
export const POST = authedRoute(async ({ req, ctx }) => createClient(ctx, await readJson(req)));
