import { uuid } from 'drizzle-orm/pg-core';
import { organizations } from './iam';

/** NULL = global content curated by the platform (read-only for organizations). */
export const orgScoped = () => uuid('organization_id').references(() => organizations.id);
/** Mandatory tenant column for business data. */
export const orgOwned = () =>
  uuid('organization_id')
    .notNull()
    .references(() => organizations.id);
