import { deleteReferenceValue } from '@tp/application';
import { authedRoute } from '@/server/api';

export const DELETE = authedRoute(async ({ ctx, params }) =>
  deleteReferenceValue(ctx, params.referenceId!),
);
