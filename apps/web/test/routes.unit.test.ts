import { describe, expect, it } from 'vitest';
import { apiHandlers } from './api-routes';

/**
 * Route coverage (MASTER_SPECIFICATION §14.3): every HTTP handler under /api/v1 must be built with
 * `authedRoute` (session + use-case authorization) or `publicRoute`, and public routes are an
 * explicit allow-list. A new route that skips the wrappers fails CI.
 */
const PUBLIC = new Set([
  'auth/login POST',
  'auth/logout POST',
  'auth/2fa/verify POST',
  'auth/password-reset/request POST',
  'auth/password-reset POST',
  'invitations/accept POST',
]);

describe('API route coverage', () => {
  const handlers = apiHandlers().map((h) => ({
    key: `${h.path} ${h.method}`,
    wrapper: h.wrapper,
  }));

  it('finds the API routes', () => {
    expect(new Set(apiHandlers().map((h) => h.file)).size).toBeGreaterThan(20);
  });

  it.each(handlers)('$key uses an approved wrapper', ({ key, wrapper }) => {
    expect(['authedRoute', 'publicRoute']).toContain(wrapper);
    if (wrapper === 'publicRoute') expect(PUBLIC.has(key)).toBe(true);
  });

  it('every allow-listed public route exists', () => {
    const keys = new Set(handlers.map((h) => h.key));
    for (const p of PUBLIC) expect(keys.has(p)).toBe(true);
  });
});
