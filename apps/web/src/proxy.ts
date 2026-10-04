import { NextResponse, type NextRequest } from 'next/server';

/**
 * Content Security Policy with a per-request nonce (Phase 15; PENTEST P-2, ASVS V14): scripts run
 * only if they carry the nonce (Next adds it to its own scripts) or are loaded by one that does
 * ('strict-dynamic'). No 'unsafe-inline' for scripts. Styles keep 'unsafe-inline' (style
 * attributes); they cannot run code.
 */
export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    // Exercise videos are embedded only from privacy-friendly players (§28).
    'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    // Everything except static assets (they run no inline code and are cached).
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest).*)',
  ],
};
