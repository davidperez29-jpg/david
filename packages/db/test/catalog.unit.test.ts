import { describe, expect, it } from 'vitest';
import { RLS_POLICIES, INHERIT_SCOPE, CHECK_CLIENT_ORG } from '../src/rls/policies';
import {
  MUSCLE_GROUP_NAMES,
  PRESCRIPTION_PROFILES,
  PRESCRIPTION_VARIABLES,
  MUSCLES,
  MOVEMENT_PATTERNS,
} from '../src/seed/structure';

describe('structural catalogues', () => {
  it('profiles only reference known prescription variables', () => {
    const keys = new Set(PRESCRIPTION_VARIABLES.map((v) => v.key));
    for (const [, , vars] of PRESCRIPTION_PROFILES) for (const v of vars) expect(keys).toContain(v);
  });
  it('slugs are unique', () => {
    for (const list of [
      PRESCRIPTION_VARIABLES.map((v) => v.key),
      MUSCLES.map((m) => m[0]),
      MOVEMENT_PATTERNS.map((p) => p[0]),
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
  it('every muscle group has a display name', () => {
    for (const m of MUSCLES) expect(MUSCLE_GROUP_NAMES[m[2]]).toBeDefined();
  });
  it('RIR range is 0–10 as required (§18)', () => {
    const rir = PRESCRIPTION_VARIABLES.find((v) => v.key === 'rir')!;
    expect([rir.min, rir.max]).toEqual(['0', '10']);
  });
});

describe('RLS map', () => {
  it('every client_owned/client_optional table keeps its client inside its organization (trigger)', () => {
    // The per-role access rule of these policies trusts organization_id: a trigger must guarantee
    // that the row's client belongs to that organization (check_client_org or inherit_scope).
    const unguarded = Object.entries(RLS_POLICIES)
      .filter(([, p]) => p.kind === 'client_owned' || p.kind === 'client_optional')
      .map(([t]) => t)
      .filter((t) => !(t in INHERIT_SCOPE) && !CHECK_CLIENT_ORG.includes(t));
    expect(unguarded).toEqual([]);
  });

  it('scope triggers and client/org checks only target mapped tables', () => {
    for (const t of [...Object.keys(INHERIT_SCOPE), ...CHECK_CLIENT_ORG])
      expect(RLS_POLICIES[t]).toBeDefined();
  });
  it('health and decision data are never client-writable', () => {
    for (const t of [
      'health_declarations',
      'client_goals',
      'recommendations',
      'alerts',
      'training_plans',
      'sessions',
      'session_exercises',
    ]) {
      const p = RLS_POLICIES[t]!;
      expect('clientWrite' in p ? p.clientWrite : false).toBe(false);
    }
  });
});

describe('RLS migration drift', () => {
  it('the latest *_rls*.sql migration matches the generator output', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { generateRlsSql } = await import('../src/rls/generate');
    const dir = path.resolve(__dirname, '../drizzle');
    const latest = readdirSync(dir)
      .filter((f) => /_rls(_v\d+)?\.sql$/.test(f))
      .sort()
      .at(-1)!;
    expect(readFileSync(path.join(dir, latest), 'utf8')).toBe(generateRlsSql());
  });
});
