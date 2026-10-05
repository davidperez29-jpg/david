import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_common';
import { organizations } from './iam';

/**
 * Catalogues are data, not code (§6.1.2). organization_id NULL = global content curated by the
 * platform (read-only for organizations); otherwise organization-owned.
 */
export const goalFamily = pgEnum('goal_family', [
  'muscle',
  'strength',
  'power_speed',
  'sport_performance',
  'endurance',
  'health',
  'body_composition',
  'mobility',
  'reconditioning',
  'general',
]);

export const goals = pgTable(
  'goals',
  {
    id: id(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    family: goalFamily('family').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [unique('goals_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

export const sportFamily = pgEnum('sport_family', [
  'team',
  'endurance',
  'individual',
  'racket',
  'combat',
  'other',
]);

export const sports = pgTable(
  'sports',
  {
    id: id(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    family: sportFamily('family').notNull(),
    ...timestamps(),
  },
  (t) => [unique('sports_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

export const equipment = pgTable(
  'equipment',
  {
    id: id(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    ...timestamps(),
  },
  (t) => [unique('equipment_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct()],
);

/**
 * Programming profiles (restructure, docs/DATABASE_SCHEMA.md): the client's main profile
 * (Hipertrofia, Deportes de equipo, Adulto mayor, Retorno al deporte…), each with three levels
 * described in `levels`. A catalogue, so adding a profile is adding a row (§3 of the brief).
 */
export const programmingProfiles = pgTable(
  'programming_profiles',
  {
    id: id(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    /** rendimiento · salud · fuerza_hipertrofia · readaptacion · poblacion_especifica · personalizado */
    family: text('family').notNull(),
    description: text('description'),
    /** {"1": {"name","summary"}, "2": {…}, "3": {…}}: how the three levels differ for this profile. */
    levels: jsonb('levels').notNull(),
    /** Goal suggested when a client gets this profile (goal slug), if any. */
    defaultGoalSlug: text('default_goal_slug'),
    /** Suggested assessment battery (slug), if any. */
    defaultBatterySlug: text('default_battery_slug'),
    /** Suggested radar dimensions (slugs). */
    radarDimensions: text('radar_dimensions').array().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique('programming_profiles_org_slug_uq').on(t.organizationId, t.slug).nullsNotDistinct(),
  ],
);
