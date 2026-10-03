import 'server-only';
import { resolveSession, type AppContext, type RequestContext } from '@tp/application';
import { DomainError, type ErrorCode } from '@tp/domain';
import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { baseContext, hashUserAgent } from './context';
import { clientIp, SESSION_COOKIE } from './session';

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  rate_limited: 429,
};

/** Marker used by the route-coverage test: every API export must be built with these helpers. */
export const ROUTE_MARKER = Symbol.for('tp.route');

type Params = Record<string, string>;
type Handler<C> = (args: {
  req: NextRequest;
  ctx: C;
  params: Params;
  userAgentHash: string | null;
}) => Promise<Response | unknown>;

export interface RouteMeta {
  access: 'public' | 'authenticated';
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function errorResponse(e: unknown, requestId: string): NextResponse {
  if (e instanceof DomainError) {
    return json(
      { error: { code: e.code, message: e.message, details: e.details ?? null, requestId } },
      STATUS[e.code],
    );
  }
  console.error(`[api] request ${requestId} failed`, e instanceof Error ? e.name : 'unknown');
  return json({ error: { code: 'internal', message: 'Error interno.', requestId } }, 500);
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence for cookie-authenticated mutations: the Origin (or Referer) must match the host.
 * Complements SameSite=Lax cookies.
 */
function sameOrigin(req: NextRequest): boolean {
  if (!UNSAFE.has(req.method)) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const origin = req.headers.get('origin') ?? req.headers.get('referer');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > 256 * 1024) throw new DomainError('validation', 'Petición demasiado grande.');
  try {
    return await req.json();
  } catch {
    throw new DomainError('validation', 'JSON no válido.');
  }
}

function build<C>(
  meta: RouteMeta,
  resolve: (req: NextRequest, base: AppContext) => Promise<C>,
  handler: Handler<C>,
) {
  const fn = async (req: NextRequest, segment: { params?: Promise<Params> }) => {
    const requestId = randomUUID();
    try {
      if (!sameOrigin(req)) throw new DomainError('forbidden', 'Origen no permitido.');
      const base = baseContext({ ip: clientIp(req.headers), requestId });
      const ctx = await resolve(req, base);
      const params = (await segment?.params) ?? {};
      const out = await handler({
        req,
        ctx,
        params,
        userAgentHash: hashUserAgent(req.headers.get('user-agent')),
      });
      if (out instanceof Response) return out;
      return json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e, requestId);
    }
  };
  return Object.assign(fn, { [ROUTE_MARKER]: meta });
}

/** Public endpoint (login, invitation acceptance, password reset). */
export function publicRoute(handler: Handler<AppContext>) {
  return build({ access: 'public' }, async (_req, base) => base, handler);
}

/**
 * Authenticated endpoint. Authorization (permission + scope) happens inside the application use
 * case, which is the single enforcement point shared with server components.
 */
export function authedRoute(handler: Handler<RequestContext & { sessionId: string }>) {
  return build(
    { access: 'authenticated' },
    async (req, base) => {
      const state = await resolveSession(base, req.cookies.get(SESSION_COOKIE)?.value);
      if (state.status !== 'authenticated')
        throw new DomainError('unauthenticated', 'Inicia sesión.');
      return { ...base, actor: state.actor, sessionId: state.sessionId };
    },
    handler,
  );
}
