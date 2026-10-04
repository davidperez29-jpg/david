import { listAdjustments } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listAdjustments(ctx, params.clientId!));
