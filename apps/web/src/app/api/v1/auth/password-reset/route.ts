import { resetPassword } from '@tp/application';
import { NextResponse } from 'next/server';
import { publicRoute, readJson } from '@/server/api';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

/** New password from a reset link; the person is signed in with it (restructure phase 23). */
export const POST = publicRoute(async ({ req, ctx, userAgentHash }) => {
  const r = await resetPassword(ctx, await readJson(req), { userAgentHash });
  const res = NextResponse.json(
    { requiresSecondFactor: r.requiresSecondFactor },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  res.cookies.set(SESSION_COOKIE, r.token, sessionCookieOptions(r.expiresAt));
  return res;
});
