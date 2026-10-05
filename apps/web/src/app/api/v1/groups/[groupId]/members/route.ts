import { setGroupMembers } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  setGroupMembers(ctx, params.groupId!, await readJson(req)),
);
