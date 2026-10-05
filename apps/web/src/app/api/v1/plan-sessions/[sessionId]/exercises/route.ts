import { addSessionExercises } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Rows pasted into the session table, added in one transaction. */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  addSessionExercises(ctx, params.sessionId!, await readJson(req)),
);
