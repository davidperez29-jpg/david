import { setAutoApply } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/** Apply routine load progressions without confirmation (off by default; audited, reversible). */
export const PUT = authedRoute(async ({ req, ctx, params }) =>
  setAutoApply(ctx, params.clientId!, await readJson(req)),
);
