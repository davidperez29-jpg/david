import { getExercise, updateExercise } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getExercise(ctx, params.exerciseId!));
export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateExercise(ctx, params.exerciseId!, await readJson(req)),
);
