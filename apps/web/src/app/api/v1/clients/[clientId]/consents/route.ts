import { grantConsent, listConsents } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listConsents(ctx, params.clientId!));
export const POST = authedRoute(async ({ req, ctx, params }) =>
  grantConsent(ctx, params.clientId!, await readJson(req)),
);
