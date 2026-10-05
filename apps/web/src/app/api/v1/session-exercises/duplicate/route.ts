import { duplicateSessionExercises } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) =>
  duplicateSessionExercises(ctx, await readJson(req)),
);
