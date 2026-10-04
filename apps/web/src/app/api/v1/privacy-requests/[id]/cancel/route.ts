import { cancelPrivacyRequest } from '@tp/application';
import { authedRoute } from '@/server/api';

export const POST = authedRoute(async ({ ctx, params }) => cancelPrivacyRequest(ctx, params.id!));
