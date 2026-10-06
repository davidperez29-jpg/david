import { generateGroupReport, listGroupReports } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listGroupReports(ctx, params.groupId!));
export const POST = authedRoute(async ({ req, ctx, params }) =>
  generateGroupReport(ctx, params.groupId!, await readJson(req)),
);
