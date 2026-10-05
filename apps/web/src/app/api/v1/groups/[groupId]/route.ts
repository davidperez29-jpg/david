import { getGroup, updateGroup } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getGroup(ctx, params.groupId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateGroup(ctx, params.groupId!, await readJson(req)),
);
