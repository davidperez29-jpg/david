import { bulkEditExercises } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** One change to up to 100 exercises; each one is skipped or applied, versioned and audited. */
export const POST = authedRoute(async ({ req, ctx }) =>
  bulkEditExercises(ctx, await readJson(req)),
);
