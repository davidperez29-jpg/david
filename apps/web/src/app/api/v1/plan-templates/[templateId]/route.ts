import { getPlanTemplate } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ ctx, params }) => getPlanTemplate(ctx, params.templateId!));
