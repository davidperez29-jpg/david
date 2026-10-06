import { estimatedStrength } from '@tp/application';
import { authedRoute } from '@/server/api';

/** Estimated 1RM per exercise from the logged sets, informative only (restructure phase 14). */
export const GET = authedRoute(async ({ ctx, params }) => estimatedStrength(ctx, params.clientId!));
