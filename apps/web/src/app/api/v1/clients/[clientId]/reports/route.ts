import { generateClientReport, listClientReports } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listClientReports(ctx, params.clientId!));
/** Freezes a snapshot of the client's data for the period (§34: 11 sections). */
export const POST = authedRoute(async ({ req, ctx, params }) =>
  generateClientReport(ctx, params.clientId!, await readJson(req)),
);
