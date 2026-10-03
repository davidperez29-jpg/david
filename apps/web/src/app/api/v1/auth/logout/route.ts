import { logout } from '@tp/application';
import { NextResponse } from 'next/server';
import { publicRoute } from '@/server/api';
import { SESSION_COOKIE } from '@/server/session';

export const POST = publicRoute(async ({ req, ctx }) => {
  await logout(ctx, req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
