import { importExternalMeasurements, listExternalMeasurements } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx, params }) =>
  listExternalMeasurements(ctx, params.clientId!, Object.fromEntries(req.nextUrl.searchParams)),
);
export const POST = authedRoute(async ({ req, ctx, params }) =>
  importExternalMeasurements(ctx, params.clientId!, await readJson(req, 1100 * 1024)),
);
