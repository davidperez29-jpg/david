import { exportData } from '@tp/application';
import { authedRoute, fileResponse } from '@/server/api';

/** ?entity=clients|assessments|plan|sessions|progress&format=csv|xlsx[&clientId&planId&from&to] */
export const GET = authedRoute(async ({ req, ctx }) =>
  fileResponse(await exportData(ctx, Object.fromEntries(req.nextUrl.searchParams))),
);
