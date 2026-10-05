import { beforeAll, describe, expect, it } from 'vitest';
import {
  createClient,
  createGroup,
  createGroupAssessment,
  getAssessment,
  getGroup,
  groupReport,
  listAssessmentTests,
  listFormulas,
  listGroups,
  recordAssessmentResult,
  resetFormula,
  saveFormula,
  setGroupMembers,
  type AssessmentTestSummary,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let tests: AssessmentTestSummary[];
const t = (slug: string) => tests.find((x) => x.slug === slug)!;
const SKIN = [
  'skinfold_triceps',
  'skinfold_subscapular',
  'skinfold_iliac_crest',
  'skinfold_abdominal',
  'skinfold_front_thigh',
  'skinfold_medial_calf',
];

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  tests = await listAssessmentTests(o.admin);
});

describe('groups, group assessment sheet and group report (phase 4)', () => {
  let groupId: string;
  const members: string[] = [];

  it('staff create a team and add members; clients cannot see groups', async () => {
    const g = await createGroup(o.admin, { name: `Juvenil A ${o.tag}` });
    groupId = g.id;
    for (let i = 1; i <= 5; i++) {
      const c = await createClient(o.admin, {
        basics: {
          firstName: `Jugador ${i}`,
          lastName: o.tag,
          birthDate: '2007-01-01',
          sex: 'male',
        },
      });
      members.push(c.id);
    }
    members.push(o.clientB); // assigned to trainer2
    await setGroupMembers(o.admin, groupId, { add: members });
    expect((await getGroup(o.admin, groupId)).members).toHaveLength(6);
    expect((await listGroups(o.admin)).find((x) => x.id === groupId)?.members).toBe(6);
    await expect(listGroups(o.clientUser)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(getGroup(other.admin, groupId)).rejects.toMatchObject({ code: 'not_found' });
    await expect(createGroup(o.admin, { name: `Juvenil A ${o.tag}` })).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it('a trainer only sees the members they are assigned to (RLS)', async () => {
    const g = await getGroup(o.trainer2, groupId);
    expect(g.members.map((m) => m.clientId)).toEqual([o.clientB]);
  });

  it('assesses the whole team on one date, idempotently', async () => {
    const testIds = ['height', 'body_mass', ...SKIN, 'sprint_5m', 'single_leg_cmj_height'].map(
      (s) => t(s).id,
    );
    const r = await createGroupAssessment(o.admin, groupId, { assessedOn: '2026-09-01', testIds });
    expect(r).toMatchObject({ created: 6, skipped: 0 });
    const again = await createGroupAssessment(o.admin, groupId, {
      assessedOn: '2026-09-01',
      testIds,
    });
    expect(again).toMatchObject({ created: 0, skipped: 6 });
  });

  it('report: medians of 3 skinfolds, minimum sprint, Σ, Faulkner, N/mean/SD, best, worst, Z, flags', async () => {
    let report = await groupReport(o.admin, groupId, { date: '2026-09-01' });
    expect(report.members).toHaveLength(6);
    const heights = [178, 181, 175, 183, 179, 150];
    const sprints = [1.05, 1.02, 1.1, 0.98, 1.04, 1.07];
    for (const [i, m] of report.members.entries()) {
      const rec = (slug: string, attempts: number[], side = 'both') =>
        recordAssessmentResult(o.admin, m.assessmentId, { testId: t(slug).id, attempts, side });
      await rec('height', [heights[i]!]);
      await rec('body_mass', [70 + i]);
      for (const [k, s] of SKIN.entries())
        await rec(s, [8 + k + i * 0.5, 8.2 + k + i * 0.5, 7.9 + k + i * 0.5]);
      await rec('sprint_5m', [sprints[i]! + 0.03, sprints[i]!]);
      if (i < 5) {
        await rec('single_leg_cmj_height', [20, 21, 20.5], 'right');
        await rec('single_leg_cmj_height', [18, 18.5, 19], 'left');
      }
    }
    report = await groupReport(o.admin, groupId, { date: '2026-09-01' });
    const row = (key: string) => report.rows.find((r) => r.key === key)!;
    // Median of three, as the club sheet: triceps of member 1 = median(8, 8.2, 7.9) = 8.
    expect(row('skinfold_triceps:both').values[0]).toBe(8);
    // Best of two sprint attempts = the minimum time.
    expect(row('sprint_5m:both').values).toEqual(sprints);
    const sp = row('sprint_5m:both');
    expect(sp.n).toBe(6);
    expect(sp.best).toBe(sprints.indexOf(Math.min(...sprints)));
    expect(sp.worst).toBe(sprints.indexOf(Math.max(...sprints)));
    expect(sp.z[sp.best!]).toBeGreaterThan(0); // faster = positive Z
    // Σ6 and Faulkner from the formula catalogue.
    const s6 = row('sum_6_skinfolds');
    expect(s6.values[0]).toBeCloseTo(8 + 9 + 10 + 11 + 12 + 13, 6);
    const fk = row('body_fat_faulkner');
    expect(fk.values[0]).toBeCloseTo((8 + 9 + 10 + 11) * 0.153 + 5.783, 3);
    // Height of 150 among ~180: «confirmar medición»; descriptive tests have no best/worst.
    expect(row('height:both').flags[5]).toBe('atipico');
    expect(row('height:both').best).toBeNull();
    // Sided test: one row per side and the asymmetry (descriptive).
    expect(row('single_leg_cmj_height:right').n).toBe(5);
    expect(row('asymmetry:single_leg_cmj_height').values[0]).toBeCloseTo(9.8, 1);
    expect(report.smallGroup).toBe(false);
  });

  it('the centre edits Faulkner constants: new calculations use them, the text shows them; reset restores', async () => {
    const before = (await listFormulas(o.admin)).find((f) => f.slug === 'body_fat_faulkner')!;
    expect(before.own).toBe(false);
    await expect(
      saveFormula(o.clientUser, 'body_fat_faulkner', { constants: { a: 0.2, b: 1 } }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await saveFormula(o.admin, 'body_fat_faulkner', { constants: { a: 0.2, b: 1 } });
    const mine = (await listFormulas(o.admin)).find((f) => f.slug === 'body_fat_faulkner')!;
    expect(mine).toMatchObject({ own: true, text: 'sum_4_skinfolds * 0,2 + 1' });
    expect(mine.platformConstants).toEqual({ a: 0.153, b: 5.783 });
    // Other organizations keep the platform's constants.
    expect((await listFormulas(other.admin)).find((f) => f.slug === 'body_fat_faulkner')!.own).toBe(
      false,
    );
    const report = await groupReport(o.admin, groupId, { date: '2026-09-01' });
    const m = report.members[0]!;
    await recordAssessmentResult(o.admin, m.assessmentId, {
      testId: t('skinfold_triceps').id,
      attempts: [8, 8, 8],
    });
    const a = await getAssessment(o.admin, m.assessmentId);
    const fk = a.derived.find((d) => d.metric === 'body_fat_faulkner')!;
    expect(fk.value).toBeCloseTo(38 * 0.2 + 1, 3);
    expect(fk.formula).toContain('0,2');
    // Invalid formulas are rejected with the reason.
    await expect(
      saveFormula(o.admin, 'body_fat_faulkner', { expression: 'sum_4_skinfolds * a + nope' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      saveFormula(o.admin, 'fat_mass', { expression: 'fat_free_mass * 2' }),
    ).rejects.toThrow(/circular/);
    await resetFormula(o.admin, 'body_fat_faulkner');
    expect((await listFormulas(o.admin)).find((f) => f.slug === 'body_fat_faulkner')!.own).toBe(
      false,
    );
  });

  it('an own new formula (Σ3 pliegues) is computed on the next save', async () => {
    await saveFormula(o.admin, 'sum_3_skinfolds', {
      name: 'Σ3 pliegues',
      unit: 'mm',
      expression: 'sum(skinfold_triceps, skinfold_subscapular, skinfold_abdominal)',
      betterDirection: 'lower',
      definition: 'Tríceps + subescapular + abdominal.',
    });
    const report = await groupReport(o.admin, groupId, { date: '2026-09-01' });
    const m = report.members[1]!;
    await recordAssessmentResult(o.admin, m.assessmentId, {
      testId: t('skinfold_triceps').id,
      attempts: [9, 9, 9],
    });
    const a = await getAssessment(o.admin, m.assessmentId);
    expect(a.derived.find((d) => d.metric === 'sum_3_skinfolds')?.value).toBeCloseTo(
      9 + 9.5 + 11.5,
      3,
    );
  });
});
