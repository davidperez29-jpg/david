import { updateAlertStatus } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const POST = authedRoute(async ({ req, ctx, params }) =>
  updateAlertStatus(ctx, params.alertId!, await readJson(req)),
);
