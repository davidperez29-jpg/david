import { request as pwRequest, expect, test, type APIRequestContext } from '@playwright/test';
import { apiHandlers, type ApiHandler } from '../test/api-routes';
import { apiLogin as login, fill, loadVictim } from './route-ids';

/**
 * Cross-access suite for EVERY API route (MASTER_SPECIFICATION §15.1: "acceso cruzado
 * (cliente→cliente, entrenador→no asignado, org→org) para cada ruta; 100 % rutas").
 *
 * The victim is a demo client (Elena, assigned to Nerea). Path parameters are filled with real ids
 * of her records (or of her organization for library/science ids). The attackers:
 * - nobody (no session): every authenticated route → 401;
 * - the ADMIN of another organization: any route that names a resource of the victim's organization
 *   → never 2xx (403/404/422), and no response leaks the victim;
 * - another client and an unassigned trainer: any route that names one of the victim's records →
 *   never 2xx, and no response leaks the victim.
 * Requests without a valid body may stop at validation (422) before authorization: what reaches the
 * use case is authorized there and covered by the integration tests of each use case.
 * The demo has no uploaded file, so `files/[fileId]` is covered by library.int.test.ts instead.
 */
/** Victim-owned parameters (records of the client) vs organization-level ones (library, science). */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC = (h: ApiHandler) => h.wrapper === 'publicRoute';

const CLIENT_PARAMS = new Set([
  'clientId',
  'assessmentId',
  'resultId',
  'planId',
  'microcycleId',
  'sessionId',
  'blockId',
  'logId',
  'alertId',
  'declarationId',
  'entryId',
  'toleranceId',
  'substitutionId',
  'assignmentId',
  'reports/id',
  'recommendations/id',
  'adjustments/id',
  'privacy-requests/id',
  'auth/sessions/id',
]);

const call = (ctx: APIRequestContext, method: string, url: string) =>
  ctx.fetch(url, { method, ...(MUTATING.has(method) ? { data: {} } : {}) });

test.describe.configure({ mode: 'serial' });

test('every API route refuses cross-tenant, cross-client and unassigned access', async ({
  baseURL,
}) => {
  test.setTimeout(300_000);
  const victim = await loadVictim();
  const handlers = apiHandlers();
  expect(handlers.length).toBeGreaterThan(100);
  const anon = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL! } });
  const attackers = {
    'ADMIN de otra organización': await login(baseURL!, 'ane.urrutia@example.com'),
    'otro cliente': await login(baseURL!, 'marcos.villalba@example.com'),
    'entrenador no asignado': await login(baseURL!, 'pablo.ibarra@example.com'),
  };
  const failures: string[] = [];
  const stats = { routes: 0, attacks: 0, withRealIds: 0, global: 0, noData: new Set<string>() };
  const leaks = (body: string) => body.includes(victim.clientId) || body.includes(victim.name);

  for (const h of handlers) {
    if (PUBLIC(h)) continue;
    stats.routes++;
    const { url, used, missing, global } = fill(h, victim);
    if (missing) stats.noData.add(`${h.method} ${h.path}`);
    // 1. No session.
    const r0 = await call(anon, h.method, url);
    if (r0.status() !== 401) failures.push(`sin sesión ${h.method} ${url} → ${r0.status()}`);

    // Logging out or closing sessions would end the attacker's own session: not an attack.
    if (h.path.startsWith('auth/') && !h.path.includes('[')) continue;
    // Routes without parameters are only read (to look for leaks), never mutated.
    if (!used.length && MUTATING.has(h.method)) continue;
    const victimRecord = used.some((u) => CLIENT_PARAMS.has(u));
    // `entity`, `purpose` and `slug` are names (template type, consent purpose, formula), not
    // records: a formula PUT/DELETE by slug only ever touches the caller's own centre's copy
    // (groups.int.test.ts checks the other centre keeps the platform's constants).
    const NAMES = new Set(['entity', 'purpose', 'slug']);
    const orgRecord = used.some((u) => !NAMES.has(u));
    if (orgRecord && !missing) stats.withRealIds++;
    if (global) stats.global++;

    for (const [who, ctx] of Object.entries(attackers)) {
      const r = await call(ctx, h.method, url);
      stats.attacks++;
      const status = r.status();
      const body = await r.text();
      // Global catalogue records: everyone reads them, nobody changes them.
      const mustRefuse = global
        ? MUTATING.has(h.method)
        : !missing && (who === 'ADMIN de otra organización' ? orgRecord : victimRecord);
      if (status >= 500) failures.push(`${who} ${h.method} ${url} → ${status}`);
      else if (mustRefuse && status < 400)
        failures.push(`${who} ${h.method} ${url} → ${status} (acceso)`);
      if (leaks(body))
        failures.push(`${who} ${h.method} ${url} → ${status} filtra datos de la víctima`);
    }
  }
  console.log(
    `Rutas autenticadas: ${stats.routes} · ataques: ${stats.attacks} · rutas con ids reales: ${stats.withRealIds} (de catálogo global: ${stats.global}) · sin datos demo: ${[...stats.noData].join(', ') || 'ninguna'}`,
  );
  expect(failures).toEqual([]);
});
