import { exportSubjectData } from '@tp/application';
import { authedRoute, fileResponse } from '@/server/api';

/** RGPD arts. 15/20: the client's data as JSON (client: own; ADMIN: organization). Audited. */
export const GET = authedRoute(async ({ ctx, params }) =>
  fileResponse(await exportSubjectData(ctx, params.clientId!)),
);
