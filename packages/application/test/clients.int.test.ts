import { beforeAll, describe, expect, it } from 'vitest';
import {
  addHistoryEntry,
  assignTrainer,
  createClient,
  getClient,
  listCatalog,
  listClientAudit,
  listClients,
  listTrainers,
  setClientArchived,
  setClientAvailability,
  setClientEquipment,
  setClientGoals,
  unassignTrainer,
  updateClient,
  updateTrainingProfile,
} from '../src';
import { buildOrg } from './fixtures';

let o: Awaited<ReturnType<typeof buildOrg>>;
let catalog: Awaited<ReturnType<typeof listCatalog>>;
beforeAll(async () => {
  o = await buildOrg();
  catalog = await listCatalog(o.admin);
});

const goal = (slug: string) => catalog.goals.find((g) => g.slug === slug)!.id;

describe('client lifecycle', () => {
  it('catalogue exposes the 17 global goals', () => {
    expect(catalog.goals).toHaveLength(17);
    expect(catalog.sports.length).toBeGreaterThan(5);
    expect(catalog.equipment.length).toBeGreaterThan(10);
  });

  it('creates a complete client in one transaction and assigns the creating trainer', async () => {
    const { id } = await createClient(o.trainer2, {
      basics: { firstName: 'Carla', lastName: 'Gómez', birthDate: '2003-05-20', sex: 'female', phone: '+34 600 111 222', modality: 'online' },
      profile: { experienceLevel: 'intermediate', yearsTraining: 3, sessionsPerWeek: 3, sessionDurationMin: 60, location: 'gym' },
      goals: [
        { goalId: goal('team_sport_performance'), isPrimary: true, priorityWeight: 1, sportId: catalog.sports.find((s) => s.slug === 'handball')!.id, competitiveLevel: 'amateur' },
        { goalId: goal('hypertrophy'), isPrimary: false, priorityWeight: 0.4 },
      ],
      availability: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }, { weekday: 3 }],
      equipment: [{ equipmentId: catalog.equipment[0]!.id, location: 'gym' }],
    });
    const c = await getClient(o.trainer2, id);
    expect(c.phone).toBe('+34 600 111 222');
    expect(c.goals[0]!.isPrimary).toBe(true);
    expect(c.goals[0]!.sportName).toBe('Balonmano');
    expect(c.availability).toHaveLength(2);
    expect(c.assignments.map((a) => a.name)).toEqual(['Teo Trainer']);
    expect(c.referral.required).toBe(false);
    const audit = await listClientAudit(o.trainer2, id);
    expect(audit.some((a) => a.action === 'create' && a.entityType === 'client')).toBe(true);
    // phone must never be written to the audit trail in clear text
    expect(JSON.stringify(audit)).not.toContain('600 111 222');
  });

  it('rejects invalid goal selections atomically (no partial client)', async () => {
    const before = (await listClients(o.admin, {})).total;
    await expect(
      createClient(o.admin, {
        basics: { firstName: 'X', lastName: 'Y' },
        goals: [{ goalId: goal('power'), isPrimary: false, priorityWeight: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect((await listClients(o.admin, {})).total).toBe(before);
  });

  it('ADMIN without explicit trainer is assigned as trainer (admin is also trainer)', async () => {
    const { id } = await createClient(o.admin, { basics: { firstName: 'Dani', lastName: 'Ruiz' } });
    expect((await getClient(o.admin, id)).assignments).toHaveLength(1);
  });

  it('uses optimistic locking and audits field-level changes', async () => {
    const c = await getClient(o.admin, o.clientA);
    const { version } = await updateClient(o.admin, o.clientA, { firstName: 'Anabel', expectedVersion: c.version });
    expect(version).toBe(c.version + 1);
    await expect(updateClient(o.admin, o.clientA, { firstName: 'Old', expectedVersion: c.version })).rejects.toMatchObject({ code: 'conflict' });
    const audit = await listClientAudit(o.admin, o.clientA);
    const change = audit.find((a) => a.action === 'update' && a.entityType === 'client');
    expect(change?.changes).toEqual(expect.arrayContaining([{ field: 'firstName', before: 'Ana', after: 'Anabel' }]));
    expect(change?.actor).toBe('Ada Admin');
  });

  it('replacing goals keeps history and enforces one primary', async () => {
    await setClientGoals(o.admin, o.clientA, { goals: [{ goalId: goal('hypertrophy'), isPrimary: true, priorityWeight: 1 }] });
    await setClientGoals(o.admin, o.clientA, {
      goals: [
        { goalId: goal('max_strength'), isPrimary: true, priorityWeight: 0.8 },
        { goalId: goal('mobility'), isPrimary: false, priorityWeight: 0.3 },
      ],
    });
    const c = await getClient(o.admin, o.clientA);
    expect(c.goals.map((g) => g.name)).toEqual(['Fuerza máxima', 'Movilidad']);
    await expect(
      setClientGoals(o.admin, o.clientA, { goals: [{ goalId: goal('power'), isPrimary: true, priorityWeight: 1 }, { goalId: goal('sprint'), isPrimary: true, priorityWeight: 1 }] }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('client can set own availability but not equipment or training profile', async () => {
    await setClientAvailability(o.clientUser, o.clientA, { slots: [{ weekday: 2, startTime: '07:00', endTime: '08:00' }] });
    expect((await getClient(o.clientUser, o.clientA)).availability).toEqual([{ weekday: 2, startTime: '07:00', endTime: '08:00', maxDurationMin: null }]);
    await expect(setClientEquipment(o.clientUser, o.clientA, { items: [] })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(updateTrainingProfile(o.clientUser, o.clientA, { experienceLevel: 'advanced' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(setClientAvailability(o.admin, o.clientA, { slots: [{ weekday: 2, startTime: '09:00', endTime: '08:00' }] })).rejects.toMatchObject({ code: 'validation' });
  });

  it('search, status filter and archive', async () => {
    const found = await listClients(o.admin, { q: `beta ${o.tag}` });
    expect(found.items.map((c) => c.id)).toEqual([o.clientB]);
    await setClientArchived(o.admin, o.clientB, true, 'Fin de contrato');
    expect((await listClients(o.admin, {})).items.map((c) => c.id)).not.toContain(o.clientB);
    expect((await listClients(o.admin, { status: 'archived' })).items.map((c) => c.id)).toContain(o.clientB);
    await setClientArchived(o.admin, o.clientB, false);
    // LIKE wildcards in the search term are escaped
    expect((await listClients(o.admin, { q: '%' })).total).toBe(0);
  });

  it('assignments: add collaborator, keep at least one trainer', async () => {
    const trainers = await listTrainers(o.admin);
    const teo = trainers.find((t) => t.firstName === 'Teo')!;
    await assignTrainer(o.admin, o.clientA, { trainerId: teo.id, role: 'collaborator' });
    expect((await getClient(o.trainer2, o.clientA)).id).toBe(o.clientA); // now visible to trainer2
    await expect(assignTrainer(o.admin, o.clientA, { trainerId: teo.id })).rejects.toMatchObject({ code: 'conflict' });
    await expect(assignTrainer(o.trainer2, o.clientA, { trainerId: teo.id })).rejects.toMatchObject({ code: 'forbidden' });
    const c = await getClient(o.admin, o.clientA);
    const collab = c.assignments.find((a) => a.role === 'collaborator')!;
    await unassignTrainer(o.admin, o.clientA, collab.id);
    await expect(getClient(o.trainer2, o.clientA)).rejects.toMatchObject({ code: 'not_found' });
    const last = (await getClient(o.admin, o.clientA)).assignments[0]!;
    await expect(unassignTrainer(o.admin, o.clientA, last.id)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('records training history', async () => {
    await addHistoryEntry(o.admin, o.clientA, { kind: 'sport', periodStart: '2015-09-01', periodEnd: '2020-06-30', description: 'Baloncesto federado' });
    expect((await getClient(o.admin, o.clientA)).history[0]!.description).toBe('Baloncesto federado');
  });
});
