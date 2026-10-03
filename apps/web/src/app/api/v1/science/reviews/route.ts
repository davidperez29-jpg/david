import { addEvidenceReview } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx }) =>
  addEvidenceReview(ctx, await readJson(req)),
);
