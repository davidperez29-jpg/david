import { nextExerciseToReview } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  nextExerciseToReview(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
