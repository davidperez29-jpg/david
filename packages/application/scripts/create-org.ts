/**
 * Creates an organization and its first ADMIN (also TRAINER).
 * Usage: ORG_NAME="Mi centro" ORG_SLUG=mi-centro ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *        ADMIN_FIRST_NAME=... ADMIN_LAST_NAME=... pnpm --filter @tp/application create-org
 */
import 'dotenv/config';
import { createDb } from '@tp/db';
import { bootstrapOrganization } from '../src';

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required`);
  return v;
};
const { db, close } = createDb(need('DATABASE_URL'));
const r = await bootstrapOrganization(db, {
  name: need('ORG_NAME'),
  slug: need('ORG_SLUG'),
  admin: {
    email: need('ADMIN_EMAIL'),
    password: need('ADMIN_PASSWORD'),
    firstName: need('ADMIN_FIRST_NAME'),
    lastName: need('ADMIN_LAST_NAME'),
  },
});
await close();
console.log(`Organization created: ${r.organizationId}`);
