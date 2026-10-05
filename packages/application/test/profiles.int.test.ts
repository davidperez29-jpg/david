import { schema } from '@tp/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createClient,
  getClient,
  listBatteries,
  listCatalog,
  listClientAudit,
  listClients,
  listProgrammingProfiles,
  updateClient,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;
let catalog: Awaited<ReturnType<typeof listCatalog>>;
let profiles: Awaited<ReturnType<typeof listProgrammingProfiles>>;

const LEVELS = {
  '1': { name: 'Inicial', summary: 'a' },
  '2': { name: 'Intermedio', summary: 'b' },
  '3': { name: 'Avanzado', summary: 'c' },
};

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
  catalog = await listCatalog(o.admin);
  profiles = await listProgrammingProfiles(o.admin);
});

describe('programming profiles catalogue', () => {
  it('16 global profiles, each with three levels and a suggested goal and battery that exist', async () => {
    expect(profiles).toHaveLength(16);
    expect(profiles.every((p) => p.global)).toBe(true);
    const slugs = profiles.map((p) => p.slug);
    for (const s of ['hipertrofia', 'adulto-mayor', 'paralisis-cerebral-leve', 'personalizado'])
      expect(slugs).toContain(s);
    const batteries = await listBatteries(o.admin);
    for (const p of profiles) {
      expect(Object.keys(p.levels).sort()).toEqual(['1', '2', '3']);
      for (const l of Object.values(p.levels)) expect(l.summary.trim()).not.toBe('');
      if (p.defaultGoalSlug) expect(catalog.goals.map((g) => g.slug)).toContain(p.defaultGoalSlug);
      if (p.defaultBatterySlug)
        expect(batteries.map((b) => b.slug)).toContain(p.defaultBatterySlug);
    }
  });

  it("an organization's own profile is visible only to it", async () => {
    const [own] = await other.ctx.db
      .insert(schema.programmingProfiles)
      .values({
        organizationId: other.org.organizationId,
        slug: `propio-${other.tag}`,
        name: 'Perfil propio',
        family: 'personalizado',
        levels: LEVELS,
      })
      .returning();
    expect((await listProgrammingProfiles(other.admin)).map((p) => p.id)).toContain(own!.id);
    expect((await listProgrammingProfiles(o.admin)).map((p) => p.id)).not.toContain(own!.id);
    // ...and cannot be assigned from another organization.
    await expect(
      createClient(o.admin, {
        basics: { firstName: 'Fuera', lastName: o.tag, programmingProfileId: own!.id },
      }),
    ).rejects.toMatchObject({
      code: 'validation',
      details: { programmingProfileId: ['not_found'] },
    });
    // The owner can use it.
    const { id } = await createClient(other.admin, {
      basics: { firstName: 'Dentro', lastName: other.tag, programmingProfileId: own!.id },
    });
    expect((await getClient(other.admin, id)).programmingProfile?.name).toBe('Perfil propio');
  });

  it("rejects another organization's sport and a level outside 1–3", async () => {
    const [sport] = await other.ctx.db
      .insert(schema.sports)
      .values({
        organizationId: other.org.organizationId,
        slug: `deporte-${other.tag}`,
        name: 'Deporte propio',
        family: 'individual',
      })
      .returning();
    await expect(
      createClient(o.admin, { basics: { firstName: 'X', lastName: o.tag, sportId: sport!.id } }),
    ).rejects.toMatchObject({ code: 'validation', details: { sportId: ['not_found'] } });
    await expect(
      createClient(o.admin, {
        basics: {
          firstName: 'X',
          lastName: o.tag,
          programmingProfileId: profiles[0]!.id,
          programmingLevel: 4,
        },
      }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
});

describe('client profile and level', () => {
  it('stored on creation, shown in the list and the client, changes audited', async () => {
    const hip = profiles.find((p) => p.slug === 'hipertrofia')!;
    const football = catalog.sports.find((s) => s.slug === 'football')!;
    const { id } = await createClient(o.trainer2, {
      basics: {
        firstName: 'Perfil',
        lastName: `Uno ${o.tag}`,
        sex: 'male',
        programmingProfileId: hip.id,
        programmingLevel: 2,
        sportId: football.id,
      },
      profile: { experienceLevel: 'intermediate', sessionsPerWeek: 3 },
    });
    const c = await getClient(o.trainer2, id);
    expect(c.programmingProfile).toMatchObject({
      slug: 'hipertrofia',
      defaultGoalSlug: 'hypertrophy',
    });
    expect(c.programmingLevel).toBe(2);
    expect(c.sport?.name).toBe(football.name);
    const list = await listClients(o.trainer2, { q: `Uno ${o.tag}` });
    expect(list.items[0]).toMatchObject({ programmingProfile: hip.name, programmingLevel: 2 });

    await updateClient(o.trainer2, id, { programmingLevel: 3, expectedVersion: c.version });
    expect((await getClient(o.trainer2, id)).programmingLevel).toBe(3);
    const audit = await listClientAudit(o.trainer2, id);
    expect(JSON.stringify(audit)).toContain('programmingLevel');

    // Removing the profile keeps the client valid.
    const v = (await getClient(o.trainer2, id)).version;
    await updateClient(o.trainer2, id, {
      programmingProfileId: null,
      programmingLevel: null,
      expectedVersion: v,
    });
    expect((await getClient(o.trainer2, id)).programmingProfile).toBeNull();
  });
});

describe('the client cannot change their own profile or level', () => {
  it('rejected by the use case (and by the database trigger as a second barrier)', async () => {
    const c = await getClient(o.admin, o.clientA);
    await expect(
      updateClient(o.clientUser, o.clientA, { programmingLevel: 3, expectedVersion: c.version }),
    ).rejects.toMatchObject({ code: 'forbidden', details: { fields: ['programmingLevel'] } });
    expect((await getClient(o.admin, o.clientA)).programmingLevel).toBeNull();
  });
});
