import { getSession, updateSession } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getSession(ctx, params.sessionId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateSession(ctx, params.sessionId!, await readJson(req)),
);
