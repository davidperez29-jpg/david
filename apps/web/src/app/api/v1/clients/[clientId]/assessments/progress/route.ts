import { clientAssessmentProgress } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  clientAssessmentProgress(ctx, params.clientId!),
);
