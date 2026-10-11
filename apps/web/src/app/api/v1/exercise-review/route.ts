import { listExerciseReview } from '@tp/application';
import { authedRoute } from '@/server/api';

/** The bank review queue: the centre's exercises with what each lacks (phase 19). */
export const GET = authedRoute(async ({ req, ctx }) =>
  listExerciseReview(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
