import { createBattery, listBatteries } from '@tp/application';
import { authedRoute, readJson } from '@/server/api';

export const GET = authedRoute(async ({ ctx }) => listBatteries(ctx));
export const POST = authedRoute(async ({ req, ctx }) => createBattery(ctx, await readJson(req)));
