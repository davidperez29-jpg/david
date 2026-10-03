import 'server-only';
import { resolveSession, type RequestContext, type SessionState } from '@tp/application';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { baseContext } from './context';

export const SESSION_COOKIE = 'tp_session';

export function clientIp(h: Headers): string | null {
  // Behind a trusted reverse proxy the first X-Forwarded-For hop is the client.
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
}

/** Session resolved once per request (React cache). */
export const currentSession = cache(
  async (): Promise<{ state: SessionState; ctx: ReturnType<typeof baseContext> }> => {
    const h = await headers();
    const ctx = baseContext({ ip: clientIp(h) });
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return { state: await resolveSession(ctx, token), ctx };
  },
);

/** For server components: returns a request context or redirects to login. */
export async function requireRequestContext(): Promise<RequestContext> {
  const { state, ctx } = await currentSession();
  if (state.status === 'second_factor_required') redirect('/login/2fa');
  if (state.status !== 'authenticated') redirect('/login');
  return { ...ctx, actor: state.actor };
}

export async function requireStaff(): Promise<RequestContext> {
  const rctx = await requireRequestContext();
  if (!rctx.actor.roles.some((r) => r === 'ADMIN' || r === 'TRAINER')) redirect('/me');
  return rctx;
}

export async function requireClientUser(): Promise<RequestContext> {
  const rctx = await requireRequestContext();
  if (!rctx.actor.clientId) redirect('/app');
  return rctx;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}
