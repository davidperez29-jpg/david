import { hashPassword } from '@tp/auth';
import { schema, type Database } from '@tp/db';
import { DomainError } from '@tp/domain';
import { eq } from 'drizzle-orm';
import { assertPasswordPolicy } from './auth-service';

const { organizations, users, roles, userRoles, trainers } = schema;

/**
 * Bootstraps an organization with its first ADMIN (who is also a TRAINER, the common case of
 * a single-trainer business). Used by the CLI and the demo seed — not exposed over HTTP.
 */
export async function bootstrapOrganization(
  db: Database,
  input: {
    name: string;
    slug: string;
    admin: { email: string; password: string; firstName: string; lastName: string };
    adminIsTrainer?: boolean;
  },
): Promise<{ organizationId: string; adminUserId: string; trainerId: string | null }> {
  assertPasswordPolicy(input.admin.password, input.admin.email);
  const passwordHash = await hashPassword(input.admin.password);
  return db.transaction(async (tx) => {
    const exists = await tx.select().from(organizations).where(eq(organizations.slug, input.slug));
    if (exists.length)
      throw new DomainError('conflict', `Organization ${input.slug} already exists`);
    const [org] = await tx
      .insert(organizations)
      .values({ name: input.name, slug: input.slug })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({
        organizationId: org!.id,
        email: input.admin.email,
        passwordHash,
        displayName: `${input.admin.firstName} ${input.admin.lastName}`,
      })
      .returning();
    const roleRows = await tx.select().from(roles);
    const id = (k: string) => roleRows.find((r) => r.key === k)!.id;
    await tx
      .insert(userRoles)
      .values({ userId: user!.id, roleId: id('ADMIN'), organizationId: org!.id });
    let trainerId: string | null = null;
    if (input.adminIsTrainer ?? true) {
      await tx
        .insert(userRoles)
        .values({ userId: user!.id, roleId: id('TRAINER'), organizationId: org!.id });
      const [t] = await tx
        .insert(trainers)
        .values({
          organizationId: org!.id,
          userId: user!.id,
          firstName: input.admin.firstName,
          lastName: input.admin.lastName,
        })
        .returning();
      trainerId = t!.id;
    }
    return { organizationId: org!.id, adminUserId: user!.id, trainerId };
  });
}
