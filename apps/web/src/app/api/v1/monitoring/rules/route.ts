import { getMonitoringRules, updateMonitoringRules } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => getMonitoringRules(ctx));
/** ADMIN only: saves a new, audited version of the organization's alert thresholds. */
export const PUT = authedRoute(async ({ req, ctx }) =>
  updateMonitoringRules(ctx, await readJson(req)),
);
