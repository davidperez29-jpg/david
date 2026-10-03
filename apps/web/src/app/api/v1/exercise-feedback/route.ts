import { saveExerciseFeedback } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) =>
  saveExerciseFeedback(ctx, await readJson(req)),
);
