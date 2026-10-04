import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { authorship, id, timestamps } from './_common';

export const roleKey = pgEnum('role_key', ['ADMIN', 'TRAINER', 'CLIENT']);
export const permissionScope = pgEnum('permission_scope', ['org', 'assigned', 'own']);
export const userStatus = pgEnum('user_status', ['active', 'disabled']);

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  /**
   * Months an archived client's personal data are kept before automatic anonymization (Phase 13).
   * NULL = not set: the controller must decide it [REQUIERE VALIDACIÓN LEGAL].
   */
  retentionMonths: integer('retention_months'),
  /** §14.1: 2FA mandatory for ADMIN accounts (can be relaxed only for demos). */
  requireAdmin2fa: boolean('require_admin_2fa').notNull().default(true),
  ...timestamps(),
});

export const users = pgTable(
  'users',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    displayName: text('display_name').notNull(),
    status: userStatus('status').notNull().default('active'),
    /** TOTP secret, AES-256-GCM encrypted (§14.1). */
    totpSecretEnc: text('totp_secret_enc'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    /** Last TOTP time step accepted: a code is single-use within its window. */
    totpLastStep: integer('totp_last_step'),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`)],
);

export const roles = pgTable('roles', {
  id: id(),
  key: roleKey('key').notNull().unique(),
  name: text('name').notNull(),
});

export const permissions = pgTable('permissions', {
  id: id(),
  key: text('key').notNull().unique(),
  description: text('description'),
});

/** Mirror of the domain matrix (ROLE_PERMISSIONS), seeded from code; used for reporting/UI. */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id),
    scope: permissionScope('scope').notNull(),
  },
  (t) => [uniqueIndex('role_permissions_uq').on(t.roleId, t.permissionId)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_roles_uq').on(t.userId, t.roleId, t.organizationId)],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the opaque session token; the token itself is never stored. */
    tokenHash: text('token_hash').notNull().unique(),
    secondFactorVerified: boolean('second_factor_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    idleExpiresAt: timestamp('idle_expires_at', { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId)],
);

/** Login attempts for rate limiting / lockout (keys are hashed, no raw IP or email). */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: id(),
    emailHash: text('email_hash').notNull(),
    ipHash: text('ip_hash'),
    success: boolean('success').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('login_attempts_email_idx').on(t.emailHash, t.occurredAt),
    index('login_attempts_ip_idx').on(t.ipHash, t.occurredAt),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    email: text('email').notNull(),
    role: roleKey('role').notNull(),
    /** For CLIENT invitations: the client record the new account will be linked to. */
    clientId: uuid('client_id'),
    /** Role-specific data captured at invitation time (e.g. trainer first/last name). */
    payload: jsonb('payload'),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
    ...authorship(),
  },
  (t) => [index('invitations_org_idx').on(t.organizationId)],
);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
