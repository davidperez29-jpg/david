import { decisionContext } from '@tp/application';
import { authedRoute } from '@/server/api';

/** The facts the engine would use right now (for "¿Qué datos usa?"). */
export const GET = authedRoute(async ({ ctx, params }) => decisionContext(ctx, params.clientId!));
