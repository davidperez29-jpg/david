import { clientMonitoring } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => clientMonitoring(ctx, params.clientId!));
