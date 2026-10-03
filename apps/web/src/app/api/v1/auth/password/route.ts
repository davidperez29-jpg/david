import { changePassword } from '@tp/application';
import { createSession } from '@tp/auth';
import { NextResponse } from 'next/server';
import { authedRoute, readJson } from '@/server/api';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

export const POST = authedRoute(async ({ req, ctx, userAgentHash }) => {
  await changePassword(ctx, await readJson(req), ctx.sessionId);
  // All sessions were revoked; issue a fresh one for this device.
  const s = await createSession(ctx.db, ctx.actor.userId, ctx.actor.roles, {
    secondFactorVerified: true,
    ipHash: ctx.ipHash ?? null,
    userAgentHash,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.token, sessionCookieOptions(s.expiresAt));
  return res;
});
