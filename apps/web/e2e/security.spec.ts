import { expect, test } from '@playwright/test';
import { login } from './helpers';

/** Light pentest (Phase 13): the checks are repeatable on every build. See docs/PENTEST.md. */

test('security headers on pages and API', async ({ request }) => {
  for (const path of ['/login', '/api/v1/me']) {
    const r = await request.get(path);
    const h = r.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("object-src 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('same-origin');
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['x-powered-by']).toBeUndefined();
  }
});

test('unauthenticated API calls are rejected without leaking internals', async ({ request }) => {
  const r = await request.get('/api/v1/clients');
  expect(r.status()).toBe(401);
  const body = await r.text();
  expect(body).not.toMatch(/at \w+ \(|node_modules|stack/i);
  // Malformed input: a clean validation error, never a stack trace.
  const bad = await request.post('/api/v1/auth/login', {
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    data: '{"email":',
  });
  expect(bad.status()).toBeLessThan(500);
  expect(await bad.text()).not.toMatch(/node_modules|at \w+ \(/);
});

test('session cookie flags, CSRF origin check, IDOR and download caching', async ({ page }) => {
  await login(page, 'marcos.villalba@example.com');
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.httpOnly);
  expect(session, 'session cookie is HttpOnly').toBeDefined();
  expect(session!.sameSite).toBe('Lax');
  expect(session!.secure).toBe(true);

  const origin = new URL(page.url()).origin;
  const me = (await (await page.request.get('/api/v1/me')).json()) as {
    actor: { clientId: string };
  };
  const myId = me.actor.clientId;
  expect(myId).toBeTruthy();

  // CSRF: a mutation from a foreign origin (or with no origin at all) is refused.
  for (const headers of [{ origin: 'https://evil.example' }, {}] as Record<string, string>[]) {
    const r = await page.request.post(`/api/v1/clients/${myId}/privacy-requests`, {
      headers,
      data: { type: 'access' },
    });
    expect(r.status()).toBe(403);
  }

  // IDOR: another client's data is reported as not found (no enumeration), even by id.
  const other = await page.request.get('/api/v1/clients/00000000-0000-4000-8000-000000000000');
  expect(other.status()).toBe(404);
  const elena = await page.context().browser()!.newPage();
  await login(elena, 'elena.prieto@example.com');
  const s = (await (await elena.request.get('/api/v1/me')).json()) as {
    actor: { clientId: string };
  };
  const elenaId = s.actor.clientId;
  await elena.close();
  for (const path of [`/api/v1/clients/${elenaId}`, `/api/v1/clients/${elenaId}/subject-data`]) {
    const r = await page.request.get(path);
    expect(r.status(), path).toBe(404);
  }
  // Privileged action out of role: a client cannot erase anyone.
  const erase = await page.request.post(`/api/v1/clients/${myId}/erase`, {
    headers: { origin },
    data: { confirmation: 'x', reason: 'prueba' },
  });
  expect([403, 404]).toContain(erase.status());

  // Personal downloads are never cached.
  const own = await page.request.get(`/api/v1/clients/${myId}/subject-data`);
  expect(own.status()).toBe(200);
  expect(own.headers()['cache-control']).toContain('no-store');
  expect(own.headers()['content-disposition']).toMatch(/attachment/);
});

test('per-user API budget: heavy operations beyond the limit get 429 with Retry-After', async ({
  page,
}) => {
  await login(page, 'iker.arrieta@example.com');
  // Default heavy budget: 30 per minute per user (API_LIMIT_HEAVY). Exports are refused to a
  // client (403) but still count.
  // Up to two windows: if the minute changes mid-test the count restarts once.
  const statuses: number[] = [];
  let retryAfter: string | undefined;
  for (let i = 0; i < 65 && !retryAfter; i++) {
    const r = await page.request.get('/api/v1/exports?entity=clients&format=csv');
    statuses.push(r.status());
    if (r.status() === 429) retryAfter = r.headers()['retry-after'];
  }
  expect(statuses.at(-1)).toBe(429);
  expect(statuses.length - 1).toBeGreaterThanOrEqual(30);
  expect(statuses.slice(0, -1).every((s) => s === 403)).toBe(true);
  expect(Number(retryAfter)).toBeGreaterThan(0);
  expect(Number(retryAfter)).toBeLessThanOrEqual(60);
});
