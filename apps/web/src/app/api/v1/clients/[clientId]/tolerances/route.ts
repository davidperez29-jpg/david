import { listExerciseTolerances, setExerciseTolerance } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  listExerciseTolerances(ctx, params.clientId!),
);
export const POST = authedRoute(async ({ req, ctx, params }) =>
  setExerciseTolerance(ctx, params.clientId!, await readJson(req)),
);
