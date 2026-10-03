import { beforeAll, describe, expect, it } from 'vitest';
import {
  addLocalReliability,
  clientAssessmentProgress,
  createAssessment,
  createAssessmentTest,
  createBattery,
  deleteAssessmentResult,
  getAssessment,
  getAssessmentTest,
  grantConsent,
  listAssessmentTests,
  listBatteries,
  listClientAssessments,
  proposeAssessmentBattery,
  recordAssessmentResult,
  recordScreening,
  setAssessmentStatus,
  updateAssessmentTest,
  updateClient,
  getClient,
  type AssessmentTestSummary,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let tests: AssessmentTestSummary[];
const t = (slug: string) => {
  const x = tests.find((y) => y.slug === slug);
  if (!x) throw new Error(`missing test ${slug}`);
  return x;
};

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  tests = await listAssessmentTests(o.admin);
});

describe('assessment catalogue', () => {
  it('exposes the global catalogue with reliability and reference sources', async () => {
    expect(tests.length).toBeGreaterThan(25);
    const cmj = await getAssessmentTest(o.trainer2, t('cmj_height').id);
    expect(cmj.isGlobal).toBe(true);
    expect(cmj.reliability.length).toBeGreaterThan(0);
    for (const r of cmj.reliability) expect(r.source?.pmid).toMatch(/^\d+$/);
    const batteries = await listBatteries(o.admin);
    expect(batteries.map((b) => b.slug)).toEqual(
      expect.arrayContaining(['health', 'team_sport', 'hypertrophy_strength', 'initiation']),
    );
  });

  it('global tests are read-only; organizations add their own tests, batteries and local reliability', async () => {
    await expect(
      updateAssessmentTest(o.admin, t('cmj_height').id, { expectedVersion: 1, unit: 'm' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const own = await createAssessmentTest(o.trainer2, {
      name: `Lanzamiento de balón ${o.tag}`,
      category: 'power',
      unit: 'm',
      valueType: 'distance',
      betterDirection: 'higher',
      defaultAttempts: 3,
    });
    const before = await getAssessmentTest(o.admin, own.id);
    await updateAssessmentTest(o.admin, own.id, {
      expectedVersion: before.version,
      protocol: 'Lanzamiento sentado con balón de 3 kg.',
    });
    expect((await getAssessmentTest(o.admin, own.id)).protocolVersion).toBe('2');
    await expect(getAssessmentTest(other.admin, own.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(addLocalReliability(o.admin, own.id, { icc: 0.9 })).rejects.toMatchObject({
      code: 'validation',
    });
    await addLocalReliability(o.admin, own.id, { sem: 0.2, notes: 'n = 12, 48 h' });
    expect((await getAssessmentTest(o.admin, own.id)).reliability[0]).toMatchObject({
      isLocal: true,
    });
    await expect(
      createAssessmentTest(o.clientUser, {
        name: 'Test del cliente',
        category: 'power',
        unit: 'm',
        valueType: 'distance',
        betterDirection: 'higher',
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const b = await createBattery(o.admin, {
      name: `Batería ${o.tag}`,
      tests: [{ testId: own.id }, { testId: t('cmj_height').id, isCore: false }],
    });
    expect((await listBatteries(o.admin)).find((x) => x.id === b.id)!.tests).toHaveLength(2);
    expect((await listBatteries(other.admin)).some((x) => x.id === b.id)).toBe(false);
  });
});

describe('client assessments', () => {
  it('proposes a battery that excludes maximal tests without a clear screening', async () => {
    const p = await proposeAssessmentBattery(o.admin, o.clientA);
    expect(p.screening).toBe('unknown');
    expect(p.tests.filter((x) => !x.included).every((x) => /cribado/.test(x.reason!))).toBe(true);
    await grantConsent(o.admin, o.clientA, { purpose: 'health_data', method: 'paper' });
    await recordScreening(o.admin, o.clientA, {
      questionnaire: 'PAR-Q+',
      questionnaireVersion: '2023',
      result: 'clear',
      completedOn: '2026-01-10',
    });
    expect((await proposeAssessmentBattery(o.admin, o.clientA)).screening).toBe('clear');
  });

  it('records attempts, aggregates them, interprets change against MDC and computes derived metrics', async () => {
    const a1 = await createAssessment(o.admin, o.clientA, {
      assessedOn: '2026-03-01',
      testIds: [
        t('cmj_height').id,
        t('body_mass').id,
        t('height').id,
        t('test_505').id,
        t('sprint_10m').id,
      ],
      context: 'Inicial',
    });
    const r = await recordAssessmentResult(o.admin, a1.id, {
      testId: t('cmj_height').id,
      attempts: [30.1, 31.4, 30.8],
    });
    // CMJ uses the mean of the attempts (test card).
    expect(r.value).toBeCloseTo(30.767, 3);
    // Re-recording the same test replaces the result (one per test and side).
    await recordAssessmentResult(o.admin, a1.id, {
      testId: t('cmj_height').id,
      attempts: [30.1, 31.0, 30.8],
    });
    await recordAssessmentResult(o.admin, a1.id, { testId: t('body_mass').id, attempts: [64] });
    await recordAssessmentResult(o.admin, a1.id, { testId: t('height').id, attempts: [168] });
    await recordAssessmentResult(o.admin, a1.id, {
      testId: t('test_505').id,
      side: 'left',
      attempts: [2.61, 2.58],
    });
    await recordAssessmentResult(o.admin, a1.id, {
      testId: t('test_505').id,
      side: 'right',
      attempts: [2.7],
    });
    await recordAssessmentResult(o.admin, a1.id, {
      testId: t('sprint_10m').id,
      attempts: [1.95, 1.93],
    });
    let d = await getAssessment(o.admin, a1.id);
    expect(d.status).toBe('in_progress');
    expect(d.results.filter((x) => x.test.slug === 'cmj_height')).toHaveLength(1);
    const derived = Object.fromEntries(d.derived.map((m) => [m.metric, m.value]));
    expect(derived.bmi).toBeCloseTo(22.676, 2);
    expect(derived['cod_deficit:left']).toBeCloseTo(0.65, 3);
    expect(derived['cod_deficit:right']).toBeCloseTo(0.77, 3);
    expect(derived['asymmetry:test_505']).toBeCloseTo(4.7, 1);
    await setAssessmentStatus(o.admin, a1.id, { status: 'completed' });

    const a2 = await createAssessment(o.admin, o.clientA, {
      assessedOn: '2026-05-01',
      testIds: [t('cmj_height').id],
    });
    await recordAssessmentResult(o.admin, a2.id, {
      testId: t('cmj_height').id,
      attempts: [36.2, 35.9],
    });
    d = await getAssessment(o.admin, a2.id);
    const cmj = d.results[0]!;
    expect(cmj.change).toMatchObject({ comparable: true });
    expect(cmj.change!.pre).toBeCloseTo(30.633, 3);
    expect(cmj.change!.post).toBeCloseTo(36.05, 3);
    // CMJ has published reliability for adults in the seed: a 5 cm gain is beyond the MDC95.
    expect(cmj.change!.verdict).toBe('probable_improvement');
    expect(cmj.change!.error).not.toBeNull();

    // A different measurement method is not comparable: no verdict.
    const a3 = await createAssessment(o.admin, o.clientA, {
      assessedOn: '2026-07-01',
      testIds: [t('cmj_height').id],
    });
    await recordAssessmentResult(o.admin, a3.id, {
      testId: t('cmj_height').id,
      attempts: [36.5],
      measurementMethod: 'App móvil',
    });
    const c3 = (await getAssessment(o.admin, a3.id)).results[0]!.change!;
    expect(c3.comparable).toBe(false);
    expect(c3.verdict).toBe('unknown_error');

    const progress = await clientAssessmentProgress(o.admin, o.clientA);
    const series = progress.series.find((s) => s.test.slug === 'cmj_height')!;
    expect(series.points).toHaveLength(3);
    expect(series.comparable).toBe(false);
    expect(series.overall?.verdict).toBe('unknown_error');
    expect(progress.derived.find((x) => x.metric === 'bmi')).toBeTruthy();
    expect(await listClientAssessments(o.admin, o.clientA)).toHaveLength(3);
  });

  it('a test without reliability shows the difference but never a verdict', async () => {
    const own = await createAssessmentTest(o.admin, {
      name: `Test sin fiabilidad ${o.tag}`,
      category: 'power',
      unit: 'm',
      valueType: 'distance',
      betterDirection: 'higher',
    });
    for (const [date, v] of [
      ['2026-02-01', 5],
      ['2026-04-01', 7],
    ] as const) {
      const a = await createAssessment(o.admin, o.clientA, { assessedOn: date, testIds: [own.id] });
      await recordAssessmentResult(o.admin, a.id, { testId: own.id, attempts: [v] });
    }
    const s = (await clientAssessmentProgress(o.admin, o.clientA)).series.find(
      (x) => x.test.id === own.id,
    )!;
    expect(s.overall).toMatchObject({ delta: 2, deltaPercent: 40, verdict: 'unknown_error' });
  });

  it('sided tests need a side and produce a descriptive asymmetry', async () => {
    const sided = t('handgrip_strength');
    const a = await createAssessment(o.admin, o.clientA, {
      assessedOn: '2026-08-01',
      testIds: [sided.id],
    });
    await expect(
      recordAssessmentResult(o.admin, a.id, { testId: sided.id, attempts: [10] }),
    ).rejects.toMatchObject({ code: 'validation' });
    await recordAssessmentResult(o.admin, a.id, { testId: sided.id, side: 'left', attempts: [20] });
    const right = await recordAssessmentResult(o.admin, a.id, {
      testId: sided.id,
      side: 'right',
      attempts: [18],
    });
    const d = await getAssessment(o.admin, a.id);
    expect(d.derived.find((m) => m.metric === `asymmetry:${sided.slug}`)).toBeTruthy();
    await deleteAssessmentResult(o.admin, right.id);
    expect(
      (await getAssessment(o.admin, a.id)).derived.some((m) => m.metric.startsWith('asymmetry:')),
    ).toBe(false);
  });

  it('applies descriptive cut-offs only to the matching age band and never refers for them', async () => {
    const client = await getClient(o.admin, o.clientB);
    await updateClient(o.trainer2, o.clientB, {
      expectedVersion: client.version,
      birthDate: '1952-01-01',
    });
    const sts = t('five_times_sit_to_stand');
    const a = await createAssessment(o.trainer2, o.clientB, {
      assessedOn: '2026-09-01',
      testIds: [sts.id],
    });
    await recordAssessmentResult(o.trainer2, a.id, { testId: sts.id, attempts: [14.1] });
    const d = await getAssessment(o.trainer2, a.id);
    const refs = d.results[0]!.references;
    const applicable = refs.filter((r) => r.applicable);
    expect(applicable).toHaveLength(1);
    expect(applicable[0]!.band).toMatch(/peor que la media|Más allá/);
    expect(
      refs.filter((r) => !r.applicable).every((r) => r.reasons.some((x) => /Edad/.test(x))),
    ).toBe(true);
    expect(d.flags).toEqual([]);
  });

  it('enforces scope: other trainers, other organizations and clients', async () => {
    const [a] = await listClientAssessments(o.admin, o.clientA);
    await expect(getAssessment(o.trainer2, a!.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(getAssessment(other.admin, a!.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      createAssessment(o.trainer2, o.clientA, { assessedOn: '2026-01-01' }),
    ).rejects.toMatchObject({ code: 'not_found' });
    // The client reads their own results but cannot record them.
    expect((await getAssessment(o.clientUser, a!.id)).id).toBe(a!.id);
    expect((await clientAssessmentProgress(o.clientUser, o.clientA)).series.length).toBeGreaterThan(
      0,
    );
    await expect(
      recordAssessmentResult(o.clientUser, a!.id, { testId: t('cmj_height').id, attempts: [40] }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(listClientAssessments(o.clientUser, o.clientB)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
