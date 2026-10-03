import { listClientAudit } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => listClientAudit(ctx, params.clientId!));
