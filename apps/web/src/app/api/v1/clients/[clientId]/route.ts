import { getClient, updateClient } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getClient(ctx, params.clientId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateClient(ctx, params.clientId!, await readJson(req)),
);
