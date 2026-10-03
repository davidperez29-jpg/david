import { describe, expect, it } from 'vitest';
import { authorize, PERMISSIONS, ROLE_PERMISSIONS, scopeFor, type Actor } from '../src';

const ORG = 'org-1';
const admin: Actor = { userId: 'u1', organizationId: ORG, roles: ['ADMIN'] };
const trainer: Actor = { userId: 'u2', organizationId: ORG, roles: ['TRAINER'], trainerId: 't2' };
const client: Actor = { userId: 'u3', organizationId: ORG, roles: ['CLIENT'], clientId: 'c3' };

describe('authorize', () => {
  it('denies everything not explicitly granted (deny by default)', () => {
    expect(authorize(client, 'users:manage')).toEqual({ allowed: false, reason: 'no_permission' });
    expect(authorize(trainer, 'users:manage')).toEqual({ allowed: false, reason: 'no_permission' });
  });

  it('never crosses organizations, even for ADMIN', () => {
    const d = authorize(admin, 'clients:read', { organizationId: 'other', clientId: 'x' });
    expect(d).toEqual({ allowed: false, reason: 'other_organization' });
  });

  it('limits trainers to assigned clients', () => {
    expect(
      authorize(trainer, 'clients:read', {
        organizationId: ORG,
        clientId: 'c9',
        assignedToActor: false,
      }).allowed,
    ).toBe(false);
    expect(
      authorize(trainer, 'clients:read', {
        organizationId: ORG,
        clientId: 'c9',
        assignedToActor: true,
      }).allowed,
    ).toBe(true);
    // assignedToActor missing is treated as not assigned
    expect(
      authorize(trainer, 'clients:read', { organizationId: ORG, clientId: 'c9' }).allowed,
    ).toBe(false);
  });

  it('limits clients to their own record', () => {
    expect(authorize(client, 'clients:read', { organizationId: ORG, clientId: 'c3' }).allowed).toBe(
      true,
    );
    expect(
      authorize(client, 'clients:read', {
        organizationId: ORG,
        clientId: 'c4',
        assignedToActor: true,
      }).allowed,
    ).toBe(false);
    const noClient: Actor = { ...client, clientId: null };
    expect(
      authorize(noClient, 'clients:read', { organizationId: ORG, clientId: 'c3' }).allowed,
    ).toBe(false);
  });

  it('uses the broadest scope across roles', () => {
    const both: Actor = { ...trainer, roles: ['TRAINER', 'ADMIN'] };
    expect(scopeFor(both, 'clients:read')).toBe('org');
  });

  it('clients can never write health data, plans or audit', () => {
    for (const p of [
      'health:write',
      'goals:write',
      'audit:read',
      'users:read',
      'clients:assign',
    ] as const) {
      expect(scopeFor(client, p)).toBeNull();
    }
  });

  it('matrix only references known permissions', () => {
    for (const role of Object.values(ROLE_PERMISSIONS)) {
      for (const p of Object.keys(role)) expect(PERMISSIONS).toContain(p);
    }
  });
});
