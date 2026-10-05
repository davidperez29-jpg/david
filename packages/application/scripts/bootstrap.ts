/**
 * First administrator of an online deployment (docs/DEPLOY_RENDER.md), run on every start and
 * idempotent: creates the organization and its ADMIN (also TRAINER) from ADMIN_EMAIL and
 * ADMIN_PASSWORD, which the host asks for in a form. Nothing happens if that user already exists
 * or the variables are missing. A password that breaks the policy is logged and the app still
 * starts (the login page then explains what to fix), so a typo never takes the service down.
 *
 * Optional: ORG_NAME (default «Mi centro»), ADMIN_NAME («Nombre Apellidos»), REQUIRE_ADMIN_2FA
 * (default true).
 */
import 'dotenv/config';
import { createDb, schema } from '@tp/db';
import { DomainError, slugify } from '@tp/domain';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { bootstrapOrganization } from '../src';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
if (!email || !password) {
  console.log('Bootstrap: ADMIN_EMAIL / ADMIN_PASSWORD not set; nothing to do.');
  process.exit(0);
}

const { db, close } = createDb(process.env.DATABASE_URL!);
try {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.email})`, email));
  if (existing) {
    console.log('Bootstrap: the administrator already exists; nothing to do.');
  } else {
    const orgName = process.env.ORG_NAME?.trim() || 'Mi centro';
    const [first, ...rest] = (process.env.ADMIN_NAME?.trim() || email.split('@')[0]!).split(/\s+/);
    const r = await bootstrapOrganization(db, {
      name: orgName,
      slug: `${slugify(orgName, 40) || 'centro'}-${randomBytes(3).toString('hex')}`,
      admin: { email, password, firstName: first!, lastName: rest.join(' ') || '-' },
      adminIsTrainer: true,
    });
    if (process.env.REQUIRE_ADMIN_2FA === 'false')
      await db
        .update(schema.organizations)
        .set({ requireAdmin2fa: false })
        .where(eq(schema.organizations.id, r.organizationId));
    console.log(`Bootstrap: organization «${orgName}» and its administrator created.`);
  }
} catch (e) {
  if (e instanceof DomainError) {
    // Most often the password policy (at least 12 characters, not the email): logged, not fatal.
    console.error(
      `Bootstrap: the administrator could not be created: ${e.message} ${JSON.stringify(e.details ?? '')}`,
    );
  } else throw e;
} finally {
  await close();
}
