import { suggestExerciseSubstitutes } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx, params }) =>
  suggestExerciseSubstitutes(ctx, params.exerciseId!, Object.fromEntries(req.nextUrl.searchParams)),
);
