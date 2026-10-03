import { refreshClientAlerts } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) =>
  refreshClientAlerts(ctx, params.clientId!),
);
