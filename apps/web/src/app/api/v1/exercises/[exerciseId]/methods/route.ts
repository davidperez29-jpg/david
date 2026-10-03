import { setExerciseMethods } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PUT = authedRoute(async ({ req, ctx, params }) =>
  setExerciseMethods(ctx, params.exerciseId!, await readJson(req)),
);
