import { clientSummary } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => clientSummary(ctx, params.clientId!));
