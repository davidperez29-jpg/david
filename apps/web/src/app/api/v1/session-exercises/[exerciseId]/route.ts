import { deleteSessionExercise, updateSessionExercise } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const PATCH = authedRoute(async ({ req, ctx, params }) =>
  updateSessionExercise(ctx, params.exerciseId!, await readJson(req)),
);
export const DELETE = authedRoute(async ({ ctx, params }) =>
  deleteSessionExercise(ctx, params.exerciseId!),
);
