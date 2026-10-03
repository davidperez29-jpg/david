import { createAssessmentTest, listAssessmentTests } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  listAssessmentTests(ctx, {
    q: req.nextUrl.searchParams.get('q') ?? undefined,
    category: req.nextUrl.searchParams.get('category') ?? undefined,
  }),
);
export const POST = authedRoute(async ({ req, ctx }) =>
  createAssessmentTest(ctx, await readJson(req)),
);
