import { getReadiness, saveReadiness } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx, params }) =>
  getReadiness(ctx, params.clientId!, req.nextUrl.searchParams.get('on') ?? ''),
);
export const PUT = authedRoute(async ({ req, ctx, params }) =>
  saveReadiness(ctx, params.clientId!, await readJson(req)),
);
