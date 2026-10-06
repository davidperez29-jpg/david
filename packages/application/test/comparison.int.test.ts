import { zAgainstGroup } from '@tp/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  clientComparison,
  createAssessment,
  createClient,
  createGroup,
  createGroupAssessment,
  groupReport,
  listAssessmentTests,
  recordAssessmentResult,
  setGroupMembers,
  type AssessmentTestSummary,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let tests: AssessmentTestSummary[];
const t = (slug: string) => tests.find((x) => x.slug === slug)!;
const members: string[] = [];
const sprints = [1.05, 1.02, 1.1, 0.98, 1.04, 1.07];
const cmj = [36, 38, 33, 41, 35, 37];

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  tests = await listAssessmentTests(o.admin);
  const g = await createGroup(o.admin, { name: `Radar ${o.tag}` });
  for (let i = 0; i < 6; i++) {
    const c = await createClient(o.admin, {
      basics: { firstName: `J${i}`, lastName: o.tag, birthDate: '2006-05-01', sex: 'male' },
    });
    members.push(c.id);
  }
  await setGroupMembers(o.admin, g.id, { add: members });
  await createGroupAssessment(o.admin, g.id, {
    assessedOn: '2026-09-01',
    testIds: [t('sprint_5m').id, t('cmj_height').id],
  });
  const r = await groupReport(o.admin, g.id, { date: '2026-09-01' });
  for (const m of r.members) {
    const i = members.indexOf(m.clientId);
    await recordAssessmentResult(o.admin, m.assessmentId, {
      testId: t('sprint_5m').id,
      attempts: [sprints[i]!],
    });
    await recordAssessmentResult(o.admin, m.assessmentId, {
      testId: t('cmj_height').id,
      attempts: [cmj[i]!],
    });
  }
  // A later individual assessment of the first player (B): faster and higher.
  const b = await createAssessment(o.admin, members[0]!, {
    assessedOn: '2026-10-01',
    testIds: [t('sprint_5m').id, t('cmj_height').id],
  });
  await recordAssessmentResult(o.admin, b.id, { testId: t('sprint_5m').id, attempts: [1.0] });
  await recordAssessmentResult(o.admin, b.id, { testId: t('cmj_height').id, attempts: [39] });
});

describe('comparativa A/B and radar (phase 5)', () => {
  it('defaults: B = latest, A = previous; auto scale = Z against the group session', async () => {
    const c = await clientComparison(o.admin, members[0]!, {});
    expect(c.b?.assessedOn).toBe('2026-10-01');
    expect(c.a?.assessedOn).toBe('2026-09-01');
    expect(c.scale?.value).toBe('z_group');
    const sp = c.items.find((i) => i.slug === 'sprint_5m')!;
    // A is the player's own value inside the group: same Z as the group report.
    expect(sp.scoreA).toBeCloseTo(zAgainstGroup(sprints, 'lower')[0]!, 9);
    // B is standardized against the same group: faster → higher score.
    expect(sp.scoreB!).toBeGreaterThan(sp.scoreA!);
    expect(sp.change?.delta).toBeCloseTo(-0.05, 6);
  });

  it('dimensions: weighted means of the scored items; dimensions without data are gaps', async () => {
    const c = await clientComparison(o.admin, members[0]!, {});
    const acc = c.dimensions.find((d) => d.key === 'aceleracion')!;
    const sp = c.items.find((i) => i.slug === 'sprint_5m')!;
    expect(acc.scoreB).toBeCloseTo(sp.scoreB!, 9);
    expect(acc.usedB).toEqual(['sprint_5m']);
    const res = c.dimensions.find((d) => d.key === 'resistencia')!;
    expect(res.scoreA).toBeNull();
    expect(res.scoreB).toBeNull();
  });

  it('other scales: percentile in the group; a scale without basis gives gaps and a note', async () => {
    const p = await clientComparison(o.admin, members[0]!, { scale: 'percentile' });
    const cm = p.items.find((i) => i.slug === 'cmj_height')!;
    expect(cm.scoreA).toBeCloseTo(((2 + 0.5) / 6) * 100, 9); // 36 beats 33 and 35
    const only = await clientComparison(o.admin, members[0]!, {
      scale: 'z_group',
      dims: 'potencia,velocidad',
    });
    expect(only.dimensions.map((d) => d.key)).toEqual(['potencia', 'velocidad']);
    // A client without a group: the group scales have no basis.
    const alone = await clientComparison(o.admin, o.clientA, { scale: 'z_group' });
    expect(alone.b).toBeNull();
  });

  it('chosen assessments, and access: other organization not found', async () => {
    const all = await clientComparison(o.admin, members[0]!, {});
    const [first, second] = all.assessments;
    const c = await clientComparison(o.admin, members[0]!, { a: second!.id, b: first!.id });
    expect(c.a?.id).toBe(second!.id);
    await expect(clientComparison(other.admin, members[0]!, {})).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      clientComparison(o.admin, members[0]!, { a: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
