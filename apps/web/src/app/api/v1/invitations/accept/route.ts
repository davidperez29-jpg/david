import { acceptInvitation } from '@tp/application';
import { NextResponse } from 'next/server';
import { publicRoute, readJson } from '@/server/api';
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

export const POST = publicRoute(async ({ req, ctx }) => {
  const r = await acceptInvitation(ctx, await readJson(req));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, r.token, sessionCookieOptions(r.expiresAt));
  return res;
});
