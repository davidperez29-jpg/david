import { schema } from '@tp/db';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyHostAdminPassword, changePassword, login, resolveSession } from '../src';
import { appContext, buildOrg, PASSWORD, testDb } from './fixtures';

const KEY = Buffer.alloc(32, 3).toString('base64');
const { db } = testDb();

beforeEach(async () => {
  await db.delete(schema.appState).where(eq(schema.appState.key, 'host_admin_password'));
});

describe('ADMIN_PASSWORD changed in the host (restructure phase 23)', () => {
  it('replaces a forgotten password, and never undoes one changed in the app', async () => {
    const o = await buildOrg();
    const email = `admin-${o.tag}@example.com`;
    const apply = (password: string) => applyHostAdminPassword(db, { email, password, key: KEY });
    expect(await apply(PASSWORD)).toBe('remembered');
    expect(await apply(PASSWORD)).toBe('unchanged');

    // Changed in the app: a new release with the same ADMIN_PASSWORD keeps it.
    await changePassword(
      o.admin,
      { currentPassword: PASSWORD, newPassword: 'cambiada-en-la-app-1' },
      's',
    );
    expect(await apply(PASSWORD)).toBe('unchanged');
    const ctx = appContext();
    const open = await login(ctx, { email, password: 'cambiada-en-la-app-1' });

    // Forgotten: the owner types a new value in the host.
    expect(await apply('nueva-desde-el-alojamiento')).toBe('replaced');
    await login(ctx, { email, password: 'nueva-desde-el-alojamiento' });
    await expect(login(ctx, { email, password: 'cambiada-en-la-app-1' })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect((await resolveSession(ctx, open.token)).status).toBe('anonymous');
    const audit = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.action, 'password_reset'),
          eq(schema.auditLogs.entityId, o.admin.actor.userId),
        ),
      );
    expect(audit.map((a) => a.reason)).toContain('ADMIN_PASSWORD cambiada en el alojamiento');
    expect(await apply('nueva-desde-el-alojamiento')).toBe('unchanged');
  });

  it('a value that breaks the policy changes nothing and is tried again on the next start', async () => {
    const o = await buildOrg();
    const email = `admin-${o.tag}@example.com`;
    const apply = (password: string) => applyHostAdminPassword(db, { email, password, key: KEY });
    await apply(PASSWORD);
    await expect(apply('corta')).rejects.toMatchObject({ code: 'validation' });
    await login(appContext(), { email, password: PASSWORD });
    expect(await apply('una-buena-frase-larga')).toBe('replaced');
  });

  it('does nothing when ADMIN_EMAIL is not an administrator', async () => {
    const o = await buildOrg();
    const email = `trainer2-${o.tag}@example.com`;
    const apply = (password: string) => applyHostAdminPassword(db, { email, password, key: KEY });
    await apply(PASSWORD);
    expect(await apply('una-buena-frase-larga')).toBe('not_admin');
    await login(appContext(), { email, password: PASSWORD });
  });
});
