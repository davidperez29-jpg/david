import { resolveExerciseNames } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Recognizes exercise names typed or pasted in the session table. */
export const POST = authedRoute(async ({ req, ctx }) =>
  resolveExerciseNames(ctx, await readJson(req)),
);
