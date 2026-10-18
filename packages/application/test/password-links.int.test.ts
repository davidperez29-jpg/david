import { schema } from '@tp/db';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  acceptInvitation,
  createClientPasswordLink,
  createInvitation,
  createUserPasswordLink,
  describePasswordLink,
  login,
  MemoryMailer,
  requestPasswordReset,
  resetPassword,
  resolveSession,
  setUserActive,
} from '../src';
import { appContext, buildOrg, PASSWORD, testDb } from './fixtures';

const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;
const NEW_PASSWORD = 'una-frase-nueva-y-larga';

let o: Awaited<ReturnType<typeof buildOrg>>;
let bruno: { userId: string; email: string };
beforeAll(async () => {
  o = await buildOrg();
  // Client B (trainer 2's) gets an account too.
  const email = `bruno-${o.tag}@example.com`;
  const inv = await createInvitation(o.trainer2, { role: 'CLIENT', email, clientId: o.clientB });
  const r = await acceptInvitation(appContext(), {
    token: tokenOf(inv.link),
    displayName: 'Bruno',
    password: PASSWORD,
  });
  const s = await resolveSession(appContext(), r.token);
  if (s.status !== 'authenticated') throw new Error('Bruno not signed in');
  bruno = { userId: s.actor.userId, email };
});

describe('new-password links shared by hand (restructure phase 23)', () => {
  it('the assigned trainer creates one; it signs the client in once and closes the old sessions', async () => {
    const ctx = appContext();
    const old = await login(ctx, { email: bruno.email, password: PASSWORD });
    const { link, expiresAt } = await createClientPasswordLink(o.trainer2, o.clientB);
    expect(link).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=/);
    const hours = (expiresAt.getTime() - Date.now()) / 3600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    expect(await describePasswordLink(ctx, tokenOf(link))).toEqual({ email: bruno.email });

    const r = await resetPassword(ctx, { token: tokenOf(link), password: NEW_PASSWORD });
    expect(r.requiresSecondFactor).toBe(false);
    const s = await resolveSession(ctx, r.token);
    expect(s.status === 'authenticated' && s.actor.userId).toBe(bruno.userId);
    expect((await resolveSession(ctx, old.token)).status).toBe('anonymous');
    await login(ctx, { email: bruno.email, password: NEW_PASSWORD });

    // Single use.
    expect(await describePasswordLink(ctx, tokenOf(link))).toBeNull();
    await expect(
      resetPassword(ctx, { token: tokenOf(link), password: 'otra-frase-nueva-larga' }),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('only the newest link works, and the same link sent twice at once is used once', async () => {
    const first = await createClientPasswordLink(o.admin, o.clientA);
    const second = await createClientPasswordLink(o.admin, o.clientA);
    const ctx = appContext();
    expect(await describePasswordLink(ctx, tokenOf(first.link))).toBeNull();
    await expect(
      resetPassword(ctx, { token: tokenOf(first.link), password: NEW_PASSWORD }),
    ).rejects.toMatchObject({ code: 'validation' });

    const both = await Promise.allSettled([
      resetPassword(ctx, { token: tokenOf(second.link), password: NEW_PASSWORD }),
      resetPassword(ctx, { token: tokenOf(second.link), password: NEW_PASSWORD }),
    ]);
    expect(both.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  });

  it('is refused to an unassigned trainer, a client, another organization and for clients without an account', async () => {
    await expect(createClientPasswordLink(o.trainer2, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(createClientPasswordLink(o.clientUser, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    const other = await buildOrg();
    await expect(createClientPasswordLink(other.admin, o.clientA)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(createUserPasswordLink(other.admin, bruno.userId)).rejects.toMatchObject({
      code: 'not_found',
    });
    const fresh = await buildOrg(); // its client B has no account
    await expect(createClientPasswordLink(fresh.trainer2, fresh.clientB)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('an administrator creates one for any other account of the centre; trainers cannot', async () => {
    const ctx = appContext();
    const { link } = await createUserPasswordLink(o.admin, o.trainer2.actor.userId);
    expect(await describePasswordLink(ctx, tokenOf(link))).toEqual({
      email: `trainer2-${o.tag}@example.com`,
    });
    await expect(createUserPasswordLink(o.trainer2, o.admin.actor.userId)).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(createUserPasswordLink(o.admin, o.admin.actor.userId)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('a disabled account gets no link, and its pending link stops working', async () => {
    const f = await buildOrg();
    const ctx = appContext();
    const { link } = await createUserPasswordLink(f.admin, f.trainer2.actor.userId);
    await setUserActive(f.admin, f.trainer2.actor.userId, false);
    expect(await describePasswordLink(ctx, tokenOf(link))).toBeNull();
    await expect(
      resetPassword(ctx, { token: tokenOf(link), password: NEW_PASSWORD }),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(createUserPasswordLink(f.admin, f.trainer2.actor.userId)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('an account with two-step verification still has to enter its code', async () => {
    const f = await buildOrg();
    const { db } = testDb();
    await db
      .update(schema.users)
      .set({ totpEnabledAt: new Date() })
      .where(eq(schema.users.id, f.clientUser.actor.userId));
    const { link } = await createClientPasswordLink(f.admin, f.clientA);
    const ctx = appContext();
    const r = await resetPassword(ctx, { token: tokenOf(link), password: NEW_PASSWORD });
    expect(r.requiresSecondFactor).toBe(true);
    expect((await resolveSession(ctx, r.token)).status).toBe('second_factor_required');
  });

  it('is audited with who created it, never with the link', async () => {
    const f = await buildOrg();
    const { link } = await createClientPasswordLink(f.admin, f.clientA);
    const { db } = testDb();
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.action, 'password_link_created'),
          eq(schema.auditLogs.entityId, f.clientUser.actor.userId),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actorUserId).toBe(f.admin.actor.userId);
    expect(rows[0]!.clientId).toBe(f.clientA);
    expect(JSON.stringify(rows[0])).not.toContain(tokenOf(link));
  });

  it('without an email provider, «forgot password» stores nothing', async () => {
    const f = await buildOrg();
    const mailer = Object.assign(new MemoryMailer(), { delivers: false });
    const ctx = appContext({ mailer });
    await requestPasswordReset(ctx, { email: `admin-${f.tag}@example.com` });
    const { db } = testDb();
    const tokens = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, f.admin.actor.userId));
    expect(tokens).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });
});
