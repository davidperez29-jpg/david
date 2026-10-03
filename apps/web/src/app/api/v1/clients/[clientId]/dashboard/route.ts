import { clientDashboard } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => clientDashboard(ctx, params.clientId!));
