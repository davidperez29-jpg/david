import { setExerciseStatus } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  setExerciseStatus(ctx, params.exerciseId!, await readJson(req)),
);
