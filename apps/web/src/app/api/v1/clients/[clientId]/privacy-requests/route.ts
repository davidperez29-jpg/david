import { createPrivacyRequest, listClientPrivacyRequests } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  listClientPrivacyRequests(ctx, params.clientId!),
);
/** Rights request with a one-month due date (art. 12.3). */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  createPrivacyRequest(ctx, params.clientId!, await readJson(req)),
);
