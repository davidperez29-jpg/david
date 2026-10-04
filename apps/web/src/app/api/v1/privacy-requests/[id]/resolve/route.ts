import { resolvePrivacyRequest } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  resolvePrivacyRequest(ctx, params.id!, await readJson(req)),
);
