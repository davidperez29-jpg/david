import { shareClientReport } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** `{shared}`: shows the report in the client's app (plain-language version) or hides it. */
export const PUT = authedRoute(async ({ req, ctx, params }) =>
  shareClientReport(ctx, params.id!, await readJson(req)),
);
