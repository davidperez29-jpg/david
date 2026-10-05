import { generateProfileTemplates, loadTemplateFiles, schema, seedTemplates } from '@tp/db';
import { SEED_DIR } from '@tp/db/testing';
import { addDays, isoWeekday, localDate, type TemplateDefinition } from '@tp/domain';
import { eq, isNull } from 'drizzle-orm';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  archiveTemplate,
  createPlanFromTemplate,
  createTemplate,
  duplicateTemplate,
  getPlan,
  getPlanTemplate,
  listCatalog,
  listPlanTemplates,
  listProgrammingProfiles,
  restoreTemplateVersion,
  setClientEquipment,
  setClientGoals,
  updateTemplate,
  type PlanDetail,
} from '../src';
import { buildOrg, testDb } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
const today = localDate(new Date());
const monday = addDays(today, 8 - isoWeekday(today));
const weeksOf = (p: PlanDetail) => p.phases.flatMap((ph) => ph.mesocycles.flatMap((m) => m.weeks));

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
});

async function globalTemplate(slug: string) {
  return (await listPlanTemplates(o.admin)).find((t) => t.slug === slug)!;
}

describe('template library', () => {
  it('filters by days, level, origin and text; the other organization never sees own templates', async () => {
    const all = await listPlanTemplates(o.admin);
    expect(all.length).toBeGreaterThanOrEqual(17);
    const three = await listPlanTemplates(o.admin, { days: '3' });
    expect(three.length).toBeGreaterThan(0);
    expect(three.every((t) => t.sessionsPerWeek === 3)).toBe(true);
    const lvl = await listPlanTemplates(o.admin, { level: '1' });
    expect(lvl.every((t) => t.levelN === 1 || t.levelN === null)).toBe(true);
    expect(await listPlanTemplates(o.admin, { scope: 'mine' })).toEqual([]);
    const q = await listPlanTemplates(o.admin, { q: 'HIPERTROFÍA' });
    expect(q.length).toBeGreaterThan(0);
    expect(q.every((t) => /hipertrofia/i.test(`${t.name} ${t.description}`))).toBe(true);
    await expect(listPlanTemplates(o.admin, { level: '7' })).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it('a client without a profile: their goals and experience order the library (A21)', async () => {
    const cat = await listCatalog(o.admin);
    await setClientGoals(o.trainer2, o.clientB, {
      goals: [
        {
          goalId: cat.goals.find((g) => g.slug === 'hypertrophy')!.id,
          isPrimary: true,
          priorityWeight: 1,
        },
      ],
    });
    const ranked = await listPlanTemplates(o.trainer2, { client: o.clientB });
    expect(ranked[0]!.profileSlug).toBe('hipertrofia');
    // Nothing is saved: the client still has no profile.
    const [row] = await testDb()
      .db.select({ p: schema.clients.programmingProfileId })
      .from(schema.clients)
      .where(eq(schema.clients.id, o.clientB));
    expect(row!.p).toBeNull();
  });

  it('for a client, the templates that suit them come first and equipment can filter', async () => {
    const profiles = await listProgrammingProfiles(o.admin);
    const hyp = profiles.find((p) => p.slug === 'hipertrofia')!;
    await testDb()
      .db.update(schema.clients)
      .set({ programmingProfileId: hyp.id, programmingLevel: 2 })
      .where(eq(schema.clients.id, o.clientA));
    const ranked = await listPlanTemplates(o.admin, { client: o.clientA });
    expect(ranked[0]!.profileSlug).toBe('hipertrofia');
    expect(ranked[0]!.fit).toBeGreaterThan(ranked.at(-1)!.fit ?? 0);
    // Only dumbbells: templates needing a barbell are left out when asked.
    const cat = await listCatalog(o.admin);
    await setClientEquipment(o.admin, o.clientA, {
      items: [
        { equipmentId: cat.equipment.find((e) => e.slug === 'dumbbells')!.id, location: 'gym' },
      ],
    });
    const fits = await listPlanTemplates(o.admin, { client: o.clientA, fitsEquipment: 'true' });
    expect(fits.every((t) => t.missingEquipment.length === 0)).toBe(true);
    expect(fits.length).toBeLessThan(ranked.length);
    // Another organization's trainer cannot use one of these clients to list.
    await expect(listPlanTemplates(other.admin, { client: o.clientA })).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('using a template', () => {
  it('creates an independent plan with the duration chosen; the template does not change', async () => {
    const tpl = await globalTemplate('hipertrofia-3d');
    const before = await getPlanTemplate(o.admin, tpl.id);
    const r = await createPlanFromTemplate(o.admin, o.clientA, {
      templateId: tpl.id,
      startDate: monday,
      weekdays: [1, 3, 5],
      durationMonths: 6,
    });
    const plan = await getPlan(o.admin, r.id);
    expect(plan.durationMonths).toBe(6);
    expect(weeksOf(plan)).toHaveLength(24);
    const [row] = await testDb()
      .db.select()
      .from(schema.trainingPlans)
      .where(eq(schema.trainingPlans.id, r.id));
    expect(row).toMatchObject({ basedOnTemplateId: tpl.id, basedOnTemplateVersion: 1 });
    // Editing the plan never touches the template.
    const after = await getPlanTemplate(o.admin, tpl.id);
    expect(after.definition).toEqual(before.definition);
    expect(after.templateVersion).toBe(before.templateVersion);
  });
});

describe('my templates', () => {
  let id: string;

  it('«Crear desde cero»: empty sessions of a week, version 1', async () => {
    const r = await createTemplate(o.trainer2, {
      name: `Desde cero ${o.tag}`,
      sessionsPerWeek: 2,
      levelN: 1,
      profileSlug: 'salud',
      population: ['adultos'],
    });
    const t = await getPlanTemplate(o.trainer2, r.id);
    expect(t.sessions.map((s) => s.dayLabel)).toEqual(['A', 'B']);
    expect(t.totalWeeks).toBe(13);
    expect(t.versions.map((v) => v.version)).toEqual([1]);
    expect(t.editable).toBe(true);
    expect((await listPlanTemplates(o.admin, { scope: 'mine' })).map((x) => x.id)).toContain(r.id);
    expect((await listPlanTemplates(other.admin)).some((x) => x.id === r.id)).toBe(false);
    await expect(getPlanTemplate(other.admin, r.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('duplicates a global template; global ones cannot be edited', async () => {
    const g = await globalTemplate('salud-2d');
    await expect(
      updateTemplate(o.admin, g.id, { expectedVersion: 1, name: 'Cambiada' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const copy = await duplicateTemplate(o.admin, g.id, {});
    id = copy.id;
    const t = await getPlanTemplate(o.admin, id);
    expect(t).toMatchObject({ name: `${g.name} (copia)`, isGlobal: false, editable: true });
    expect(t.versions[0]!.note).toMatch(/Copia de/);
    expect(t.equipmentSlugs).toEqual(g.equipmentSlugs);
  });

  it('every saved edit is a version; the same person editing in a row makes one version', async () => {
    let t = await getPlanTemplate(o.admin, id);
    const def = t.definition as TemplateDefinition;
    const first = def.sessions[0]!.blocks.find((b) => b.exercises.length)!.exercises[0]!;
    first.prescription = { ...first.prescription, sets: 4 };
    let r = await updateTemplate(o.admin, id, { expectedVersion: t.version, definition: def });
    expect(r.templateVersion).toBe(1); // grouped with the copy made a moment ago by the same person
    // Another person editing makes a new version.
    t = await getPlanTemplate(o.trainer2, id);
    const def2 = t.definition as TemplateDefinition;
    def2.sessions[0]!.title = 'Fuerza general A';
    r = await updateTemplate(o.trainer2, id, {
      expectedVersion: t.version,
      definition: def2,
      note: 'Título',
    });
    expect(r.templateVersion).toBe(2);
    // A stale version is a conflict: nothing is overwritten.
    await expect(
      updateTemplate(o.admin, id, { expectedVersion: t.version, name: 'Tarde' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    t = await getPlanTemplate(o.admin, id);
    expect(t.versions.map((v) => [v.version, v.note])).toEqual([
      [2, 'Título'],
      [1, expect.stringMatching(/Copia de/)],
    ]);
  });

  it('a version used by a plan never changes; later edits make a new version', async () => {
    let t = await getPlanTemplate(o.trainer2, id);
    await createPlanFromTemplate(o.trainer2, o.clientB, {
      templateId: id,
      startDate: monday,
      weekdays: [1, 4],
    });
    const def = t.definition as TemplateDefinition;
    def.sessions[1]!.title = 'Fuerza general B';
    const r = await updateTemplate(o.trainer2, id, { expectedVersion: t.version, definition: def });
    expect(r.templateVersion).toBe(3);
    t = await getPlanTemplate(o.trainer2, id);
    expect(t.versions.find((v) => v.version === 2)!.usedAt).not.toBeNull();
  });

  it('restores an earlier version as a new one; invalid content is rejected', async () => {
    let t = await getPlanTemplate(o.admin, id);
    const r = await restoreTemplateVersion(o.admin, id, { version: 1, expectedVersion: t.version });
    expect(r.templateVersion).toBe(4);
    t = await getPlanTemplate(o.admin, id);
    expect(t.versions[0]!.note).toBe('Restaurada la versión 1');
    expect(t.sessions[0]!.title).not.toBe('Fuerza general A');
    const bad = t.definition as TemplateDefinition;
    bad.sessions[0]!.blocks[0]!.exercises.push({
      exercise: 'no-existe',
      prescription: { sets: 3 },
    });
    await expect(
      updateTemplate(o.admin, id, { expectedVersion: t.version, definition: bad }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('archived templates leave the library but plans keep pointing to them', async () => {
    await archiveTemplate(o.admin, id, { archived: true });
    expect((await listPlanTemplates(o.admin)).some((x) => x.id === id)).toBe(false);
    expect((await listPlanTemplates(o.admin, { archived: 'true' })).map((x) => x.id)).toEqual([id]);
    const t = await getPlanTemplate(o.admin, id);
    await expect(
      updateTemplate(o.admin, id, { expectedVersion: t.version, name: 'No' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      createPlanFromTemplate(o.admin, o.clientA, {
        templateId: id,
        startDate: monday,
        weekdays: [1, 4],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    await archiveTemplate(o.admin, id, { archived: false });
    expect((await listPlanTemplates(o.admin)).some((x) => x.id === id)).toBe(true);
    // The other organization cannot archive, edit or duplicate it.
    await expect(archiveTemplate(other.admin, id, { archived: true })).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(duplicateTemplate(other.admin, id, {})).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('clients cannot use the library', async () => {
    await expect(listPlanTemplates(o.clientUser)).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('platform templates seed', () => {
  it('seeding again (every start of the app) keeps every version: jsonb reorders keys', async () => {
    const { db } = testDb();
    const versions = async () =>
      (
        await db
          .select({ slug: schema.planTemplates.slug, v: schema.planTemplates.templateVersion })
          .from(schema.planTemplates)
          .where(isNull(schema.planTemplates.organizationId))
      )
        .map((r) => `${r.slug}@${r.v}`)
        .sort();
    const before = await versions();
    expect(before.length).toBeGreaterThanOrEqual(102);
    const handWritten = loadTemplateFiles(join(SEED_DIR, 'templates'));
    await seedTemplates(db, [...handWritten, ...generateProfileTemplates(handWritten)]);
    expect(await versions()).toEqual(before);
  });
});
