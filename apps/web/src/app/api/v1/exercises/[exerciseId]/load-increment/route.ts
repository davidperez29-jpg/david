import { setExerciseLoadIncrement } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** The centre's own load increment for an exercise (restructure phase 13). */
export const PUT = authedRoute(async ({ req, ctx, params }) =>
  setExerciseLoadIncrement(ctx, params.exerciseId!, await readJson(req)),
);
