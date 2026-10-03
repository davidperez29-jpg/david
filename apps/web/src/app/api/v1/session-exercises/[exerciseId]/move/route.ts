import { moveSessionExercise } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  moveSessionExercise(ctx, params.exerciseId!, await readJson(req)),
);
