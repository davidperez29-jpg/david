import { markExerciseReviewed } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  markExerciseReviewed(ctx, params.exerciseId!, await readJson(req)),
);
