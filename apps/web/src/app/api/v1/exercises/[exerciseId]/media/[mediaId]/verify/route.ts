import { verifyExerciseMedia } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  verifyExerciseMedia(ctx, params.exerciseId!, params.mediaId!, await readJson(req)),
);
