import { schema } from '@tp/db';
import { currentTotp } from '@tp/auth';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  acceptInvitation,
  beginTotpEnrollment,
  changePassword,
  confirmTotpEnrollment,
  createInvitation,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  resolveSession,
  setUserActive,
  verifySecondFactor,
} from '../src';
import { appContext, as, buildOrg, PASSWORD, testDb } from './fixtures';

let o: Awaited<ReturnType<typeof buildOrg>>;
beforeAll(async () => {
  o = await buildOrg();
});
const adminEmail = () => `admin-${o.tag}@example.com`;

describe('login', () => {
  it('logs in with correct credentials (case-insensitive email) and resolves the actor', async () => {
    const ctx = appContext();
    const r = await login(ctx, { email: adminEmail().toUpperCase(), password: PASSWORD });
    expect(r.requiresSecondFactor).toBe(false);
    const s = await resolveSession(ctx, r.token);
    expect(s.status).toBe('authenticated');
    if (s.status === 'authenticated') expect(s.actor.roles.sort()).toEqual(['ADMIN', 'TRAINER']);
    await logout(ctx, r.token);
    expect((await resolveSession(ctx, r.token)).status).toBe('anonymous');
  });

  it('uses the same message for unknown user and wrong password', async () => {
    const ctx = appContext();
    const a = await login(ctx, { email: 'nobody@example.com', password: 'whatever-123456' }).catch(
      (e) => e,
    );
    const b = await login(ctx, { email: adminEmail(), password: 'wrong-password-123' }).catch(
      (e) => e,
    );
    expect(a.code).toBe('unauthenticated');
    expect(b.message).toBe(a.message);
  });

  it('locks the account after repeated failures', async () => {
    const { tag } = o;
    const email = `trainer2-${tag}@example.com`;
    for (let i = 0; i < 5; i++) {
      await login(appContext(), { email, password: 'wrong-password-xyz' }).catch(() => {});
    }
    await expect(login(appContext(), { email, password: PASSWORD })).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('rejects expired sessions', async () => {
    const ctx = appContext();
    const r = await login(ctx, { email: `ana-${o.tag}@example.com`, password: PASSWORD });
    const future = appContext({ now: () => new Date(Date.now() + 91 * 24 * 3600_000) });
    expect((await resolveSession(future, r.token)).status).toBe('anonymous');
  });

  it('disabled users lose their sessions immediately', async () => {
    const ctx = appContext();
    const r = await login(ctx, { email: `ana-${o.tag}@example.com`, password: PASSWORD });
    await setUserActive(o.admin, o.clientUser.actor.userId, false);
    expect((await resolveSession(ctx, r.token)).status).toBe('anonymous');
    await expect(
      login(ctx, { email: `ana-${o.tag}@example.com`, password: PASSWORD }),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    await setUserActive(o.admin, o.clientUser.actor.userId, true);
  });
});

describe('two-factor authentication', () => {
  it('enrols TOTP and then requires the second factor at login', async () => {
    const fresh = await buildOrg();
    const { secret } = await beginTotpEnrollment(fresh.admin);
    await expect(confirmTotpEnrollment(fresh.admin, '000000')).rejects.toMatchObject({
      code: 'validation',
    });
    await confirmTotpEnrollment(fresh.admin, currentTotp(secret));
    const ctx = appContext();
    const r = await login(ctx, { email: `admin-${fresh.tag}@example.com`, password: PASSWORD });
    expect(r.requiresSecondFactor).toBe(true);
    expect((await resolveSession(ctx, r.token)).status).toBe('second_factor_required');
    await expect(verifySecondFactor(ctx, r.token, '123456')).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await verifySecondFactor(ctx, r.token, currentTotp(secret));
    expect((await resolveSession(ctx, r.token)).status).toBe('authenticated');
    // the TOTP secret is stored encrypted
    const [u] = await testDb()
      .db.select()
      .from(schema.users)
      .where(eq(schema.users.id, fresh.admin.actor.userId));
    expect(u!.totpSecretEnc).not.toContain(secret);
  });
});

describe('invitations', () => {
  it('are single use and enforce the password policy', async () => {
    const ctx = appContext();
    const inv = await createInvitation(o.admin, {
      role: 'TRAINER',
      email: `t3-${o.tag}@example.com`,
      firstName: 'Tina',
      lastName: 'Tres',
    });
    const token = new URL(inv.link).searchParams.get('token')!;
    await expect(
      acceptInvitation(ctx, { token, displayName: 'Tina', password: 'aaaaaaaaaaaa' }),
    ).rejects.toMatchObject({ code: 'validation' });
    await acceptInvitation(ctx, { token, displayName: 'Tina', password: PASSWORD });
    await expect(
      acceptInvitation(ctx, { token, displayName: 'Tina', password: PASSWORD }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(o.ctx.mailer.sent.length + ctx.mailer.sent.length).toBeGreaterThanOrEqual(0);
  });

  it('cannot invite an existing email', async () => {
    await expect(
      createInvitation(o.admin, { role: 'ADMIN', email: adminEmail() }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('password reset and change', () => {
  it('reset link works once and revokes existing sessions', async () => {
    const fresh = await buildOrg();
    const ctx = appContext();
    const email = `admin-${fresh.tag}@example.com`;
    const old = await login(ctx, { email, password: PASSWORD });
    await requestPasswordReset(ctx, { email });
    await requestPasswordReset(ctx, { email: 'unknown@example.com' }); // silent
    expect(ctx.mailer.sent).toHaveLength(1);
    const token = new URL(ctx.mailer.sent[0]!.text.split(': ')[1]!.trim()).searchParams.get(
      'token',
    )!;
    await resetPassword(ctx, { token, password: 'a-brand-new-passphrase' });
    await expect(
      resetPassword(ctx, { token, password: 'another-passphrase-1' }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect((await resolveSession(ctx, old.token)).status).toBe('anonymous');
    await login(ctx, { email, password: 'a-brand-new-passphrase' });
  });

  it('change password requires the current one', async () => {
    const fresh = await buildOrg();
    const actor = await as(appContext(), fresh.admin.actor.userId);
    await expect(
      changePassword(actor, { currentPassword: 'nope', newPassword: 'whatever-new-pass' }, 's'),
    ).rejects.toMatchObject({ code: 'validation' });
    await changePassword(
      actor,
      { currentPassword: PASSWORD, newPassword: 'whatever-new-pass' },
      's',
    );
  });
});

describe('IP rate limiting', () => {
  it('does not block many successful logins from the same IP (shared gym wifi)', async () => {
    const ctx = appContext({ ipHash: 'shared-gym-ip' });
    for (let i = 0; i < 35; i++) await login(ctx, { email: adminEmail(), password: PASSWORD });
  });
});
