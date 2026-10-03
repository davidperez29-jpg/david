import { unassignTrainer } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  unassignTrainer(ctx, params.clientId!, params.assignmentId!),
);
