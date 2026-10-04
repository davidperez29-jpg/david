import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as pwRequest, expect, test, type APIRequestContext } from '@playwright/test';
import { createDb } from '@tp/db';
import { apiHandlers, type ApiHandler } from '../test/api-routes';
import { PASSWORD } from './helpers';

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
const ENV = (k: string) =>
  process.env[k] ??
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${k}=`))
    ?.slice(k.length + 1);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC = (h: ApiHandler) => h.wrapper === 'publicRoute';
const RANDOM = '00000000-0000-4000-8000-000000000000';

type Ids = Record<string, string | null>;
interface Victim {
  clientId: string;
  orgId: string;
  name: string;
  ids: Ids;
  /** Global (read-only for every organization) catalogue records, when the org has none. */
  globalIds: Ids;
}

/** Real ids for each kind of path parameter, owned by the victim (or the victim's organization). */
async function loadVictim(): Promise<Victim> {
  const { rawQuery, close } = createDb(ENV('DATABASE_URL')!, { max: 1 });
  try {
    const q = (text: string) => rawQuery(text) as Promise<Record<string, string>[]>;
    const one = async (text: string) => (await q(text))[0]?.id ?? null;
    const [v] = (await q(
      `SELECT c.id, c.organization_id, c.first_name || ' ' || c.last_name AS name, c.user_id
       FROM clients c JOIN users u ON u.id = c.user_id WHERE u.email = 'elena.prieto@example.com'`,
    )) as { id: string; organization_id: string; name: string; user_id: string }[];
    const c = v!.id;
    const o = v!.organization_id;
    const ofClient = (t: string) => one(`SELECT id FROM ${t} WHERE client_id = '${c}' LIMIT 1`);
    const ofOrg = (t: string) =>
      one(`SELECT id FROM ${t} WHERE organization_id = '${o}' ORDER BY id LIMIT 1`);
    // An exercise of the organization with media, so media routes have a real target.
    const exercise = await one(
      `SELECT e.id FROM exercises e WHERE e.organization_id = '${o}'
       ORDER BY EXISTS (SELECT 1 FROM exercise_media m WHERE m.exercise_id = e.id) DESC, e.id LIMIT 1`,
    );
    const global = (t: string) =>
      one(`SELECT id FROM ${t} WHERE organization_id IS NULL ORDER BY id LIMIT 1`);
    return {
      clientId: c,
      orgId: o,
      name: v!.name,
      ids: {
        clientId: c,
        assessmentId: await ofClient('assessments'),
        resultId: await ofClient('assessment_results'),
        planId: await ofClient('training_plans'),
        microcycleId: await ofClient('microcycles'),
        sessionId: await ofClient('sessions'),
        blockId: await ofClient('session_blocks'),
        logId: await ofClient('set_logs'),
        alertId: await ofClient('alerts'),
        declarationId: await ofClient('health_declarations'),
        entryId: await ofClient('client_history_entries'),
        toleranceId: await ofClient('exercise_tolerances'),
        substitutionId: await ofClient('exercise_substitutions'),
        assignmentId: await ofClient('trainer_client_assignments'),
        'reports/id': await ofClient('reports'),
        'recommendations/id': await ofClient('recommendations'),
        'adjustments/id': await ofClient('recommendations'),
        'privacy-requests/id': await ofClient('privacy_requests'),
        'imports/id': await ofOrg('import_jobs'),
        'auth/sessions/id': await one(
          `SELECT id FROM auth_sessions WHERE user_id = '${v!.user_id}' LIMIT 1`,
        ),
        fileId: await ofOrg('files'),
        exerciseId: exercise,
        mediaId: exercise
          ? await one(`SELECT id FROM exercise_media WHERE exercise_id = '${exercise}' LIMIT 1`)
          : null,
        progressionId: await ofOrg('exercise_progressions'),
        sourceId: await ofOrg('evidence_sources'),
        findingId: await ofOrg('evidence_findings'),
        claimId: await ofOrg('knowledge_claims'),
        methodId: await ofOrg('methods'),
        testId: await ofOrg('assessment_tests'),
        reliabilityId: await ofOrg('test_reliability_data'),
        templateId: await ofOrg('plan_templates'),
        userId: await one(`SELECT id FROM users WHERE email = 'nerea.soto@example.com'`),
        purpose: 'health_data',
        entity: 'clients',
      },
      globalIds: {
        exerciseId: await global('exercises'),
        progressionId: await global('exercise_progressions'),
        sourceId: await global('evidence_sources'),
        findingId: await global('evidence_findings'),
        claimId: await global('knowledge_claims'),
        methodId: await global('methods'),
        testId: await global('assessment_tests'),
        reliabilityId: await global('test_reliability_data'),
        templateId: await global('plan_templates'),
      },
    };
  } finally {
    await close();
  }
}

/** Victim-owned parameters (records of the client) vs organization-level ones (library, science). */
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

function fill(h: ApiHandler, v: Victim) {
  const used: string[] = [];
  let missing = false;
  let global = false;
  const url = h.path.replace(/\[(\w+)\]/g, (_, p: string) => {
    const key = p === 'id' ? `${h.path.split('/[id]')[0]}/id` : p;
    used.push(key);
    const id = v.ids[key] ?? v.globalIds[key];
    if (!v.ids[key] && v.globalIds[key]) global = true;
    if (!id) missing = true;
    return id ?? RANDOM;
  });
  return { url: `/api/v1/${url}`, used, missing, global };
}

async function login(baseURL: string, email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const r = await ctx.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
  expect(r.ok(), `login ${email}`).toBe(true);
  return ctx;
}

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
    // `entity` and `purpose` are names (template type, consent purpose), not records.
    const orgRecord = used.some((u) => u !== 'entity' && u !== 'purpose');
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
