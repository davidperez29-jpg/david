import { deleteSessionExercises } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Deletes several rows of the session table (all or none). */
export const POST = authedRoute(async ({ req, ctx }) =>
  deleteSessionExercises(ctx, await readJson(req)),
);
