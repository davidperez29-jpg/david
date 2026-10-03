/**
 * Permission catalogue and role → scope matrix (MASTER_SPECIFICATION §14.2).
 *
 * A permission is granted to a role with a *scope*:
 *  - `org`      every resource of the actor's organization
 *  - `assigned` only clients assigned to the actor (trainer ↔ client assignment)
 *  - `own`      only the actor's own client record
 */
export const ROLES = ['ADMIN', 'TRAINER', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

export type Scope = 'org' | 'assigned' | 'own';

export const PERMISSIONS = [
  'clients:read',
  'clients:create',
  'clients:write',
  'clients:archive',
  'clients:assign',
  'goals:write',
  'health:read',
  'health:write',
  'consents:read',
  'consents:write',
  'audit:read',
  'users:read',
  'users:manage',
  'invitations:create',
  'catalog:read',
  'library:read',
  'library:write',
  'library:publish',
  'privacy:export_subject',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

type Matrix = Record<Role, Partial<Record<Permission, Scope>>>;

export const ROLE_PERMISSIONS: Matrix = {
  ADMIN: {
    'clients:read': 'org',
    'clients:create': 'org',
    'clients:write': 'org',
    'clients:archive': 'org',
    'clients:assign': 'org',
    'goals:write': 'org',
    'health:read': 'org',
    'health:write': 'org',
    'consents:read': 'org',
    'consents:write': 'org',
    'audit:read': 'org',
    'users:read': 'org',
    'users:manage': 'org',
    'invitations:create': 'org',
    'catalog:read': 'org',
    'library:read': 'org',
    'library:write': 'org',
    'library:publish': 'org',
    'privacy:export_subject': 'org',
  },
  TRAINER: {
    'clients:read': 'assigned',
    // A trainer may create clients; the new client is assigned to them in the same transaction.
    'clients:create': 'org',
    'clients:write': 'assigned',
    'clients:archive': 'assigned',
    'goals:write': 'assigned',
    'health:read': 'assigned',
    'health:write': 'assigned',
    'consents:read': 'assigned',
    // Trainers record paper/verbal consent collected in person.
    'consents:write': 'assigned',
    'audit:read': 'assigned',
    'invitations:create': 'assigned',
    'catalog:read': 'org',
    // Shared library of the organization (§45: el entrenador gestiona ejercicios).
    'library:read': 'org',
    'library:write': 'org',
    'library:publish': 'org',
  },
  CLIENT: {
    'clients:read': 'own',
    'clients:write': 'own',
    'health:read': 'own',
    'consents:read': 'own',
    'consents:write': 'own',
    'catalog:read': 'org',
    'privacy:export_subject': 'own',
  },
};

/** Fields a CLIENT may edit on their own record (§14.2: contacto, disponibilidad, preferencias). */
export const CLIENT_SELF_EDITABLE_FIELDS = ['email', 'phone', 'preferences'] as const;
