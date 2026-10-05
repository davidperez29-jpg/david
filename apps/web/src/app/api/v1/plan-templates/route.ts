import { createTemplate, listPlanTemplates } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

/**
 * Template library with filters (q, profile, level, days, population, kind, scope, archived,
 * fitsEquipment, client) and «Crear desde cero».
 */
export const GET = authedRoute(async ({ req, ctx }) =>
  listPlanTemplates(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
export const POST = authedRoute(async ({ req, ctx }) => createTemplate(ctx, await readJson(req)));
