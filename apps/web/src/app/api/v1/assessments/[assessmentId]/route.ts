import { getAssessment } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getAssessment(ctx, params.assessmentId!));
