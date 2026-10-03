import { integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from '../uuid';

export const id = () => uuid('id').primaryKey().$defaultFn(() => uuidv7());

export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const authorship = () => ({
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
});

/** Optimistic locking column (§6.1). */
export const version = () => integer('version').notNull().default(1);
