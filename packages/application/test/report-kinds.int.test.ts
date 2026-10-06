import { schema } from '@tp/db';
import { reportLanguageIssues } from '@tp/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addHealthDeclaration,
  createAssessment,
  createClient,
  createGroup,
  createGroupAssessment,
  downloadClientReport,
  generateClientReport,
  generateGroupReport,
  getClientReport,
  getClientReportView,
  grantConsent,
  groupReport,
  listAssessmentTests,
  listClientReports,
  listGroupReports,
  recordAssessmentResult,
  setGroupMembers,
  shareClientReport,
  type AssessmentTestSummary,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let tests: AssessmentTestSummary[];
let groupId: string;
const t = (slug: string) => tests.find((x) => x.slug === slug)!;
const members: string[] = [];
const period = { from: '2026-08-01', to: '2026-10-05' };

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  tests = await listAssessmentTests(o.admin);
  const g = await createGroup(o.admin, { name: `Informes ${o.tag}` });
  groupId = g.id;
  for (let i = 0; i < 6; i++) {
    const c = await createClient(o.admin, {
      basics: { firstName: `P${i}`, lastName: o.tag, birthDate: '2005-03-01', sex: 'male' },
    });
    members.push(c.id);
  }
  await setGroupMembers(o.admin, groupId, { add: members });
  const ids = ['sprint_5m', 'cmj_height', 'sprint_30m', 'imtp_peak_force', 'body_mass'].map(
    (s) => t(s).id,
  );
  for (const [k, date] of ['2026-09-01', '2026-10-01'].entries()) {
    await createGroupAssessment(o.admin, groupId, { assessedOn: date, testIds: ids });
    const r = await groupReport(o.admin, groupId, { date });
    for (const m of r.members) {
      const i = members.indexOf(m.clientId);
      const rec = (slug: string, v: number) =>
        recordAssessmentResult(o.admin, m.assessmentId, { testId: t(slug).id, attempts: [v] });
      await rec('sprint_5m', 1.1 - i * 0.02 - k * 0.02);
      await rec('cmj_height', 32 + i + k * 1.5);
      await rec('sprint_30m', 4.4 - i * 0.03 - k * 0.03);
      await rec('imtp_peak_force', 2600 + i * 80 + k * 100);
      await rec('body_mass', 70 + i);
    }
  }
  // The first player: health-data consent, an injury between A and B, and pain logs.
  await grantConsent(o.admin, members[0]!, { purpose: 'health_data', method: 'paper' });
  await addHealthDeclaration(o.admin, members[0]!, {
    type: 'injury',
    bodyRegion: 'isquiosurales',
    declaredOn: '2026-09-10',
    declaredStatus: 'active',
  });
  await testDb()
    .db.insert(schema.painLogs)
    .values(
      ['2026-09-12', '2026-09-20', '2026-09-28'].map((d, i) => ({
        organizationId: o.org.organizationId,
        clientId: members[0]!,
        occurredOn: d,
        bodyRegion: 'isquiosurales',
        intensity: 6 - i * 2,
        context: 'after' as const,
      })),
    );
});

const KINDS = [
  'technical',
  'client',
  'initial',
  'follow_up',
  'comparative',
  'final',
  'rtp',
] as const;

describe('report kinds (phase 6)', () => {
  const made: Record<string, string> = {};

  it('every client kind is generated from a frozen snapshot, with no forbidden phrases', async () => {
    for (const kind of KINDS) {
      const r = await generateClientReport(o.admin, members[0]!, {
        kind,
        ...(kind === 'comparative' || kind === 'rtp' ? {} : period),
        trainerNotes: 'Seguir con el trabajo de fuerza.',
      });
      made[kind] = r.id;
      const v = await getClientReport(o.admin, r.id);
      expect(v.kind).toBe(kind);
      expect(v.intact).toBe(true);
      expect(reportLanguageIssues(v.report), kind).toEqual([]);
    }
    const list = await listClientReports(o.admin, members[0]!);
    expect(new Set(list.map((x) => x.kind))).toEqual(new Set(KINDS));
  });

  it('each kind downloads as PDF, XLSX and CSV; the PDF is identical byte for byte', async () => {
    for (const kind of KINDS) {
      for (const format of ['pdf', 'xlsx', 'csv']) {
        const f = await downloadClientReport(o.admin, made[kind]!, format);
        expect(f.body.length, `${kind} ${format}`).toBeGreaterThan(200);
      }
      const a = await downloadClientReport(o.admin, made[kind]!, 'pdf');
      const b = await downloadClientReport(o.admin, made[kind]!, 'pdf');
      expect(a.body.equals(b.body), kind).toBe(true);
      expect(a.body.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('comparative: A vs B against the group, radar block and real-change column; «sin referencia» has no radar', async () => {
    const v = await getClientReport(o.admin, made.comparative!);
    const blocks = v.report.sections.flatMap((s) => s.blocks);
    const radar = blocks.find((b) => b.kind === 'radar');
    expect(radar).toBeTruthy();
    expect(v.report.subtitle).toContain('01/09/2026 frente a 01/10/2026');
    const none = await generateClientReport(o.admin, members[0]!, {
      kind: 'comparative',
      reference: 'none',
    });
    const nv = await getClientReport(o.admin, none.id);
    expect(nv.report.sections.flatMap((s) => s.blocks).some((b) => b.kind === 'radar')).toBe(false);
  });

  it('RTP: injury, symptoms and tests before/after; never «apto»; without consent, nothing of health', async () => {
    const v = await getClientReport(o.admin, made.rtp!);
    const text = JSON.stringify(v.report);
    expect(text).toContain('isquiosurales');
    expect(text).toContain('Listo para valoración');
    expect(text).not.toMatch(/\bapt[oa]\b/i);
    expect(v.report.sections.find((s) => s.key === 'tests')!.blocks[0]!.kind).not.toBe('text');
    const r2 = await generateClientReport(o.admin, members[1]!, { kind: 'rtp' });
    const t2 = JSON.stringify((await getClientReport(o.admin, r2.id)).report);
    expect(t2).toContain('Sin consentimiento');
  });

  it('the trainer text is checked: «previene lesiones» or «apto» is rejected with the reason', async () => {
    for (const trainerNotes of ['Este trabajo previene lesiones.', 'Está apto para competir.'])
      await expect(
        generateClientReport(o.admin, members[0]!, { kind: 'follow_up', ...period, trainerNotes }),
      ).rejects.toMatchObject({ code: 'validation' });
  });

  it('sharing: period kinds go to the client in plain language; comparative and RTP stay with the team', async () => {
    await shareClientReport(o.admin, made.follow_up!, { shared: true });
    expect((await getClientReportView(o.admin, made.follow_up!)).report.title).toBeTruthy();
    for (const k of ['comparative', 'rtp'])
      await expect(shareClientReport(o.admin, made[k]!, { shared: true })).rejects.toMatchObject({
        code: 'validation',
      });
  });

  it('rendimiento (group): summary, Z, a radar per chosen player; staff of the organization only', async () => {
    const r = await generateGroupReport(o.admin, groupId, {
      date: '2026-10-01',
      players: [members[0]!, members[5]!],
    });
    const v = await getClientReport(o.admin, r.id);
    expect(v.kind).toBe('performance');
    expect(v.clientId).toBeNull();
    const titles = v.report.sections.map((s) => s.title);
    expect(titles.slice(0, 3)).toEqual(['Grupo', 'Resumen del grupo', 'Z frente al grupo']);
    expect(titles).toHaveLength(6); // 2 players + notes
    expect(v.report.sections[3]!.blocks.some((b) => b.kind === 'radar')).toBe(true);
    for (const format of ['pdf', 'xlsx', 'csv'])
      expect((await downloadClientReport(o.admin, r.id, format)).body.length).toBeGreaterThan(200);
    const a = await downloadClientReport(o.admin, r.id, 'pdf');
    const b = await downloadClientReport(o.admin, r.id, 'pdf');
    expect(a.body.equals(b.body)).toBe(true);
    expect((await listGroupReports(o.admin, groupId)).map((x) => x.id)).toContain(r.id);
    await expect(getClientReport(other.admin, r.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(getClientReport(o.clientUser, r.id)).rejects.toMatchObject({ code: 'not_found' });
    // A trainer not assigned to every person in it cannot open it, nor see it listed.
    await expect(getClientReport(o.trainer2, r.id)).rejects.toMatchObject({ code: 'not_found' });
    expect(await listGroupReports(o.trainer2, groupId)).toEqual([]);
    expect(JSON.stringify(await listGroupReports(o.admin, groupId))).not.toContain(members[0]!);
    await expect(
      generateGroupReport(other.admin, groupId, { date: '2026-10-01' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('a later change of data does not change a generated report', async () => {
    const before = await downloadClientReport(o.admin, made.comparative!, 'pdf');
    const extra = await createAssessment(o.admin, members[0]!, {
      assessedOn: '2026-10-04',
      testIds: [t('cmj_height').id],
    });
    await recordAssessmentResult(o.admin, extra.id, { testId: t('cmj_height').id, attempts: [45] });
    const after = await downloadClientReport(o.admin, made.comparative!, 'pdf');
    expect(after.body.equals(before.body)).toBe(true);
  });
});
