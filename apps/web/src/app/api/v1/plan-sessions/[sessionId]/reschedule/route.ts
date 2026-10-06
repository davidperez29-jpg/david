import { rescheduleSession } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Move a session to another day of its plan (calendar, restructure phase 12). */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  rescheduleSession(ctx, params.sessionId!, await readJson(req)),
);
