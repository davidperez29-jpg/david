import { deleteSetLog } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) => deleteSetLog(ctx, params.logId!));
