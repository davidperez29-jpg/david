import { deleteFinding } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) => deleteFinding(ctx, params.findingId!));
