import { publishSessions } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) => publishSessions(ctx, await readJson(req)));
