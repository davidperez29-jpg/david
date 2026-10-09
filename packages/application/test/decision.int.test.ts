import { schema } from '@tp/db';
import { addDays, localDate } from '@tp/domain';
import { and, desc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createAssessment,
  decideRecommendation,
  getDecision,
  getDecisionRules,
  grantConsent,
  listAssessmentTests,
  listCatalog,
  recordAssessmentResult,
  recordScreening,
  runDecision,
  setClientGoals,
  setClientRuleOverride,
  setTraitFlag,
  updateDecisionRules,
  updateTrainingProfile,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
const today = localDate(new Date());

const THRESHOLDS = [
  { key: 'profile.relative_strength_low', enabled: true, parameters: { threshold: 1.5 } },
  { key: 'profile.cmj_low', enabled: true, parameters: { threshold: 35 } },
  { key: 'profile.sprint_slow', enabled: true, parameters: { threshold: 1.85 } },
];

/** §69: footballer, 3 days × 60 min, CMJ 31.2 cm, sprint 1.74 s, 1RM 85 kg at 77 kg (1.1 × BW). */
async function footballer(org: Org) {
  const catalog = await listCatalog(org.admin);
  const tests = await listAssessmentTests(org.admin);
  const t = (slug: string) => tests.find((x) => x.slug === slug)!.id;
  await setClientGoals(org.admin, org.clientA, {
    goals: [
      {
        goalId: catalog.goals.find((g) => g.slug === 'team_sport_performance')!.id,
        sportId: catalog.sports.find((s) => s.slug === 'football')!.id,
        isPrimary: true,
        priorityWeight: 1,
      },
    ],
  });
  await updateTrainingProfile(org.admin, org.clientA, {
    experienceLevel: 'intermediate',
    sessionsPerWeek: 3,
    sessionDurationMin: 60,
  });
  await grantConsent(org.admin, org.clientA, { purpose: 'health_data', method: 'paper' });
  await recordScreening(org.admin, org.clientA, {
    questionnaire: 'PAR-Q+',
    questionnaireVersion: '2023',
    result: 'clear',
    completedOn: addDays(today, -30),
  });
  const a = await createAssessment(org.admin, org.clientA, {
    assessedOn: addDays(today, -20),
    testIds: [t('cmj_height'), t('sprint_10m'), t('one_rm_back_squat'), t('body_mass')],
  });
  const rec = (slug: string, v: number) =>
    recordAssessmentResult(org.admin, a.id, { testId: t(slug), attempts: [v] });
  await rec('cmj_height', 31.2);
  await rec('sprint_10m', 1.74);
  await rec('one_rm_back_squat', 85);
  await rec('body_mass', 77);
}

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  await footballer(o);
});

describe('rules as data (ADMIN)', () => {
  it('lists default rules with pending thresholds; only ADMIN saves a new audited version', async () => {
    const r = await getDecisionRules(o.admin);
    expect(r.version).toBe(0);
    expect(r.rules.find((x) => x.key === 'profile.cmj_low')).toMatchObject({ pending: true });
    await expect(updateDecisionRules(o.trainer2, { rules: THRESHOLDS })).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(
      updateDecisionRules(o.admin, {
        rules: [{ key: 'profile.nope', enabled: true, parameters: {} }],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      updateDecisionRules(o.admin, {
        rules: [{ key: 'profile.cmj_low', enabled: true, parameters: { threshold: -1 } }],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
});

describe('golden case §69 end to end', () => {
  it('without thresholds: the engine says what is pending and does not invent a value', async () => {
    const { result } = await runDecision(o.admin, o.clientA);
    expect(result.pendingRules.map((p) => p.key)).toEqual(
      expect.arrayContaining(['profile.relative_strength_low', 'profile.cmj_low']),
    );
    expect(result.traits.find((t) => t.key === 'relative_strength_low')).toMatchObject({
      value: null,
      basis: 'unknown',
    });
    // CMJ: a verified reference applies to footballers, so it is used before any manual flag.
    expect(result.traits.find((t) => t.key === 'cmj_low')!.basis).toBe('reference');
  });

  it('with the centre thresholds: P1 strength (2 sessions), P2 power, maintain speed', async () => {
    const { version } = await updateDecisionRules(o.admin, {
      rules: THRESHOLDS,
      notes: 'Umbrales del centro para futbolistas',
    });
    expect(version).toBe(1);
    const { runId, result } = await runDecision(o.admin, o.clientA);
    expect(result.ruleSetVersion).toBe(1);
    expect(result.screening.status).toBe('clear');
    expect(result.priorities[0]).toMatchObject({ quality: 'max_strength', sessionsPerWeek: 2 });
    expect(result.priorities[1]).toMatchObject({ quality: 'power' });
    expect(result.needs.find((n) => n.quality === 'speed')!.direction).toBe('mantener');
    expect(result.traits.find((t) => t.key === 'relative_strength_low')).toMatchObject({
      value: true,
      basis: 'threshold',
    });
    expect(result.pendingRules).toEqual([]);

    // Persisted: a run plus proposals with explanation and linked evidence.
    const view = await getDecision(o.admin, o.clientA);
    expect(view.run!.id).toBe(runId);
    const need = view.recommendations.find(
      (r) => r.type === 'need' && r.payload.quality === 'max_strength',
    )!;
    expect(need.status).toBe('proposed');
    expect(need.explanation.data.join(' ')).toMatch(/1,1 ×PC frente al umbral del centro 1,5/);
    expect(need.ruleKeys).toContain('needs.max_strength.relative_strength_low');
    const ev = await testDb()
      .db.select()
      .from(schema.recommendationEvidence)
      .where(eq(schema.recommendationEvidence.recommendationId, need.id));
    expect(ev.length).toBe(new Set(need.explanation.evidence.map((e) => e.claimKey)).size);
    expect(view.recommendations.some((r) => r.type === 'plan_proposal')).toBe(true);
  });

  it('is deterministic: same data + same rule version → same hash and result', async () => {
    const a = await runDecision(o.admin, o.clientA);
    const b = await runDecision(o.admin, o.clientA);
    expect(b.result.inputHash).toBe(a.result.inputHash);
    // Exercise candidates are left out: other test files add global library exercises in
    // parallel (the engine itself is proved deterministic by the domain golden tests).
    expect({ ...b.result, exercises: [] }).toEqual({ ...a.result, exercises: [] });
    // Pending proposals of the earlier run are superseded, not deleted.
    const old = await testDb()
      .db.select({ status: schema.recommendations.status })
      .from(schema.recommendations)
      .where(
        and(
          eq(schema.recommendations.clientId, o.clientA),
          eq(schema.recommendations.status, 'superseded'),
        ),
      );
    expect(old.length).toBeGreaterThan(0);
  });
});

describe('the trainer has the last word (§13.9)', () => {
  it('accept, accept with changes (audited overrides), reject, postpone', async () => {
    await runDecision(o.admin, o.clientA);
    const recs = (await getDecision(o.admin, o.clientA)).recommendations;
    const [p1, p2] = recs.filter((r) => r.type === 'priority');
    const method = recs.find((r) => r.type === 'method')!;
    const plan = recs.find((r) => r.type === 'plan_proposal')!;

    await decideRecommendation(o.admin, p1!.id, { action: 'accept' });
    await expect(decideRecommendation(o.admin, p1!.id, { action: 'reject' })).rejects.toMatchObject(
      { code: 'conflict' },
    );
    await expect(
      decideRecommendation(o.admin, p2!.id, { action: 'accept_with_changes' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await decideRecommendation(o.admin, p2!.id, {
      action: 'accept_with_changes',
      changes: { sessionsPerWeek: 1 },
      reason: 'Calendario de partidos',
    });
    await decideRecommendation(o.admin, method.id, { action: 'reject', reason: 'No hay material' });
    await decideRecommendation(o.admin, plan.id, { action: 'postpone' });

    const after = (await getDecision(o.admin, o.clientA)).recommendations;
    const st = (id: string) => after.find((r) => r.id === id)!.status;
    expect([st(p1!.id), st(p2!.id), st(method.id), st(plan.id)]).toEqual([
      'accepted',
      'accepted_with_changes',
      'rejected',
      'postponed',
    ]);
    const ov = await testDb()
      .db.select()
      .from(schema.manualOverrides)
      .where(eq(schema.manualOverrides.recommendationId, p2!.id));
    expect(ov).toEqual([
      expect.objectContaining({
        field: 'sessionsPerWeek',
        proposedValue: p2!.payload.sessionsPerWeek,
        finalValue: 1,
      }),
    ]);
    // A postponed proposal can still be decided.
    await decideRecommendation(o.admin, plan.id, { action: 'accept' });

    // Override metrics per rule (to spot badly calibrated rules).
    const rules = (await getDecisionRules(o.admin)).rules;
    for (const k of method.ruleKeys)
      expect(rules.find((r) => r.key === k)!.stats).toMatchObject({ rejected: 1 });
    for (const k of p2!.ruleKeys)
      expect(rules.find((r) => r.key === k)!.stats!.changed).toBeGreaterThanOrEqual(1);
  });

  it('manual trait flags drive the profile when there is no threshold', async () => {
    await updateDecisionRules(o.admin, {
      rules: [
        {
          key: 'profile.relative_strength_low',
          enabled: true,
          parameters: { threshold: null },
        },
      ],
    });
    const trait = (r: { traits: { key: string }[] }) =>
      r.traits.find((t) => t.key === 'relative_strength_low')!;
    let { result } = await runDecision(o.admin, o.clientA);
    expect(trait(result)).toMatchObject({ value: null, basis: 'unknown' });
    await setTraitFlag(o.admin, o.clientA, {
      trait: 'relative_strength_low',
      value: true,
      note: 'Visto en campo',
    });
    ({ result } = await runDecision(o.admin, o.clientA));
    expect(trait(result)).toMatchObject({ value: true, basis: 'manual' });
    expect((await getDecision(o.admin, o.clientA)).traitFlags).toEqual([
      expect.objectContaining({ trait: 'relative_strength_low', value: true }),
    ]);
    await setTraitFlag(o.admin, o.clientA, { trait: 'relative_strength_low', value: null });
    expect((await getDecision(o.admin, o.clientA)).traitFlags).toEqual([]);
  });

  it('a rule can be disabled for one client only', async () => {
    await setClientRuleOverride(o.admin, o.clientA, {
      ruleKey: 'needs.max_strength.relative_strength_low',
      enabled: false,
      reason: 'Fase de recuperación',
    });
    const { result } = await runDecision(o.admin, o.clientA);
    const strength = result.needs.find((n) => n.quality === 'max_strength')!;
    expect(strength.explanation.rules.map((r) => r.key)).not.toContain(
      'needs.max_strength.relative_strength_low',
    );
    expect((await getDecision(o.admin, o.clientA)).disabledRules).toEqual([
      expect.objectContaining({ ruleKey: 'needs.max_strength.relative_strength_low' }),
    ]);
    await setClientRuleOverride(o.admin, o.clientA, {
      ruleKey: 'needs.max_strength.relative_strength_low',
      enabled: true,
    });
  });
});

describe('population values of the centre (restructure phase 17)', () => {
  const key = 'profile.relative_strength_low';
  const save = (variants?: unknown) =>
    updateDecisionRules(o.admin, {
      rules: [
        {
          key,
          enabled: true,
          parameters: {},
          ...(variants === undefined ? {} : { variants: variants as never }),
        },
      ],
    });

  it('are validated per rule, then versioned and audited', async () => {
    for (const variants of [
      [{ when: {}, values: { threshold: 1 } }],
      [{ when: { ageMin: 30, ageMax: 20 }, values: { threshold: 1 } }],
      [{ when: { sport: 'quidditch' }, values: { threshold: 1 } }],
      [{ when: { sex: 'male' }, values: { nope: 1 } }],
      [{ when: { sex: 'male' }, values: {} }],
      [{ when: { sex: 'male' }, values: { threshold: -1 } }],
      [
        { when: { sport: 'football' }, values: { threshold: 1 } },
        { when: { sport: 'football' }, values: { threshold: 2 } },
      ],
    ])
      await expect(save(variants)).rejects.toMatchObject({
        code: 'validation',
        details: { [`${key}.variants`]: [expect.any(String)] },
      });
    await expect(
      updateDecisionRules(o.trainer2, {
        rules: [{ key, enabled: true, parameters: {}, variants: [] }],
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });

    // The general threshold stays undefined (an earlier test cleared it); footballers get 1.5.
    const { version } = await save([
      { when: { sport: 'football' }, values: { threshold: 1.5 }, note: 'Primer equipo' },
    ]);
    const rules = await getDecisionRules(o.admin);
    expect(rules.version).toBe(version);
    expect(rules.sports.some((x) => x.slug === 'football')).toBe(true);
    expect(rules.rules.find((r) => r.key === key)).toMatchObject({
      pending: true,
      variants: [
        {
          when: { sport: 'football' },
          values: { threshold: 1.5 },
          note: 'Primer equipo',
          population: 'fútbol',
        },
      ],
    });
    const [audit] = await testDb()
      .db.select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.organizationId, o.org.organizationId),
          eq(schema.auditLogs.entityType, 'rule_set'),
        ),
      )
      .orderBy(desc(schema.auditLogs.occurredAt))
      .limit(1);
    expect(audit!.changes).toContainEqual({
      field: `${key}.variants`,
      before: '',
      after: 'football: threshold 1.5',
    });
  });

  it('apply to the matching clients only, and the explanation says so', async () => {
    const { result } = await runDecision(o.admin, o.clientA);
    expect(result.traits.find((t) => t.key === 'relative_strength_low')).toMatchObject({
      value: true,
      basis: 'threshold',
      detail: expect.stringContaining('frente al umbral del centro para fútbol 1,5'),
    });
    expect(result.pendingRules.map((p) => p.key)).not.toContain(key);
    expect(result.populationValues).toContainEqual({
      ruleKey: key,
      population: 'fútbol',
      values: { threshold: 1.5 },
      summary: 'Umbral de fuerza relativa: 1,5 ×PC',
      note: 'Primer equipo',
    });
    // Another client (no football): still pending, nothing invented.
    const other = await runDecision(o.trainer2, o.clientB);
    expect(other.result.pendingRules.map((p) => p.key)).toContain(key);
    expect(other.result.populationValues).toEqual([]);
  });

  it('omitted keeps them; an empty list removes them', async () => {
    await save();
    expect(
      (await getDecisionRules(o.admin)).rules.find((r) => r.key === key)!.variants,
    ).toHaveLength(1);
    await save([]);
    expect((await getDecisionRules(o.admin)).rules.find((r) => r.key === key)!.variants).toEqual(
      [],
    );
    const { result } = await runDecision(o.admin, o.clientA);
    expect(result.pendingRules.map((p) => p.key)).toContain(key);
  });
});

describe('permissions and isolation', () => {
  it('clients and unassigned trainers cannot read or run; other orgs cannot see it', async () => {
    // Clients never see the engine's internal proposals (only what the trainer publishes).
    for (const call of [runDecision, getDecision])
      await expect(call(o.clientUser, o.clientA)).rejects.toMatchObject({
        code: expect.stringMatching(/^(forbidden|not_found)$/),
      });
    await expect(getDecision(o.trainer2, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(getDecision(other.admin, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    const rec = (await getDecision(o.admin, o.clientA)).recommendations.find(
      (r) => r.status === 'proposed',
    )!;
    await expect(
      decideRecommendation(other.admin, rec.id, { action: 'accept' }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      setTraitFlag(o.trainer2, o.clientA, { trait: 'cmj_low', value: true }),
    ).rejects.toMatchObject({ code: 'not_found' });
    // Trainer 2 can run it for their own client (missing data are reported, not invented).
    const { result } = await runDecision(o.trainer2, o.clientB);
    expect(result.priorities).toBeDefined();
  });
});
