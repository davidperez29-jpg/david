import { recordRtpDecision } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  recordRtpDecision(ctx, params.clientId!, params.injuryId!, await readJson(req)),
);
