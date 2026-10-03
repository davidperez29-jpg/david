import { addSessionExercise } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  addSessionExercise(ctx, params.blockId!, await readJson(req)),
);
