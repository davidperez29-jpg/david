import { describe, expect, it, beforeAll } from 'vitest';
import {
  addHealthDeclaration,
  getClient,
  grantConsent,
  listClientAudit,
  listClients,
  listConsents,
  listHealthDeclarations,
  listUsers,
  setClientGoals,
  updateClient,
  createInvitation,
  createClient,
} from '../src';
import { buildOrg } from './fixtures';

type Org = Awaited<ReturnType<typeof buildOrg>>;
let o: Org;
let other: Org;

beforeAll(async () => {
  [o, other] = await Promise.all([buildOrg(), buildOrg()]);
});

const notFoundOrForbidden = /not_found|forbidden/;

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return (e as { code?: string }).code ?? 'error';
  }
}

describe('cross-client and cross-tenant isolation', () => {
  it('trainer cannot read, edit or see health data of a client not assigned to them', async () => {
    expect(await code(getClient(o.trainer2, o.clientA))).toMatch(notFoundOrForbidden);
    expect(
      await code(updateClient(o.trainer2, o.clientA, { firstName: 'X', expectedVersion: 1 })),
    ).toMatch(notFoundOrForbidden);
    expect(await code(listHealthDeclarations(o.trainer2, o.clientA))).toMatch(notFoundOrForbidden);
    expect(await code(listClientAudit(o.trainer2, o.clientA))).toMatch(notFoundOrForbidden);
    expect(
      await code(
        createInvitation(o.trainer2, {
          role: 'CLIENT',
          email: 'x@example.com',
          clientId: o.clientA,
        }),
      ),
    ).toMatch(notFoundOrForbidden);
  });

  it('trainer list only contains assigned clients', async () => {
    const page = await listClients(o.trainer2, {});
    expect(page.items.map((c) => c.id)).toEqual([o.clientB]);
  });

  it('a client can never access another client', async () => {
    expect(await code(getClient(o.clientUser, o.clientB))).toMatch(notFoundOrForbidden);
    expect(await code(listConsents(o.clientUser, o.clientB))).toMatch(notFoundOrForbidden);
    const page = await listClients(o.clientUser, {});
    expect(page.items.map((c) => c.id)).toEqual([o.clientA]);
  });

  it('a client cannot perform staff actions on their own record', async () => {
    expect(await code(setClientGoals(o.clientUser, o.clientA, { goals: [] }))).not.toBe('ok');
    expect(await code(addHealthDeclaration(o.clientUser, o.clientA, { type: 'injury' }))).toMatch(
      /forbidden|not_found/,
    );
    expect(await code(listUsers(o.clientUser))).toBe('forbidden');
    expect(
      await code(createClient(o.clientUser, { basics: { firstName: 'a', lastName: 'b' } })),
    ).toBe('forbidden');
  });

  it('a client may only edit contact/preferences on their own record', async () => {
    const c = await getClient(o.clientUser, o.clientA);
    expect(
      await code(
        updateClient(o.clientUser, o.clientA, { firstName: 'Hack', expectedVersion: c.version }),
      ),
    ).toBe('forbidden');
    expect(
      await code(
        updateClient(o.clientUser, o.clientA, { status: 'paused', expectedVersion: c.version }),
      ),
    ).toBe('forbidden');
    expect(
      await code(
        updateClient(o.clientUser, o.clientA, {
          preferences: 'Mañanas',
          expectedVersion: c.version,
        }),
      ),
    ).toBe('ok');
  });

  it('ADMIN of another organization cannot reach this organization', async () => {
    expect(await code(getClient(other.admin, o.clientA))).toBe('not_found');
    expect(
      await code(grantConsent(other.admin, o.clientA, { purpose: 'photo', method: 'paper' })),
    ).toBe('not_found');
    const page = await listClients(other.admin, {});
    expect(page.items.map((c) => c.id)).not.toContain(o.clientA);
    expect(page.items.map((c) => c.id)).not.toContain(o.clientB);
  });

  it('a malformed id is simply not found, never an internal error', async () => {
    expect(await code(getClient(o.admin, 'not-a-uuid'))).toBe('not_found');
    expect(await code(getClient(o.admin, "x' OR '1'='1"))).toBe('not_found');
  });

  it('only ADMIN can invite staff', async () => {
    expect(
      await code(
        createInvitation(o.trainer2, {
          role: 'TRAINER',
          email: 'n@example.com',
          firstName: 'N',
          lastName: 'N',
        }),
      ),
    ).toBe('forbidden');
    expect(
      await code(createInvitation(o.trainer2, { role: 'ADMIN', email: 'n2@example.com' })),
    ).toBe('forbidden');
  });
});
