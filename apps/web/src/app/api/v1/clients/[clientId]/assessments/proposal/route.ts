import { proposeAssessmentBattery } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) =>
  proposeAssessmentBattery(ctx, params.clientId!),
);
