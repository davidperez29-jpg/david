import { calendarEvents } from '@tp/application';
import { authedRoute } from '@/server/api';

export const GET = authedRoute(async ({ req, ctx }) =>
  calendarEvents(ctx, Object.fromEntries(req.nextUrl.searchParams)),
);
