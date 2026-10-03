import { completeSession } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  completeSession(ctx, params.sessionId!, await readJson(req)),
);
