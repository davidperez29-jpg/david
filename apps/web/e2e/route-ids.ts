import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as pwRequest, expect, type APIRequestContext } from '@playwright/test';
import { createDb } from '@tp/db';
import type { ApiHandler } from '../test/api-routes';
import { PASSWORD } from './helpers';

/**
 * Real ids of the demo data for every kind of API path parameter (the victim of the security
 * matrix is Elena, a client of the demo organization), shared by the route-level E2E suites.
 */
const ENV = (k: string) =>
  process.env[k] ??
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${k}=`))
    ?.slice(k.length + 1);

export const RANDOM = '00000000-0000-4000-8000-000000000000';

export type Ids = Record<string, string | null>;
export interface Victim {
  clientId: string;
  orgId: string;
  name: string;
  ids: Ids;
  /** Global (read-only for every organization) catalogue records, when the org has none. */
  globalIds: Ids;
}

/** Real ids for each kind of path parameter, owned by the victim (or the victim's organization). */
export async function loadVictim(): Promise<Victim> {
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
        groupId: await ofOrg('client_groups'),
        slug: 'body_fat_faulkner',
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

export function fill(h: ApiHandler, v: Victim) {
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

export async function apiLogin(baseURL: string, email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const r = await ctx.post('/api/v1/auth/login', { data: { email, password: PASSWORD } });
  expect(r.ok(), `login ${email}`).toBe(true);
  return ctx;
}
