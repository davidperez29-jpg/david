import { expect, test, type Browser } from '@playwright/test';
import { scanState } from './a11y-helpers';
import { login } from './helpers';

/**
 * Forgotten passwords without an email provider (restructure phase 23): the trainer creates a
 * one-time link in the client's ficha and the client opens it, chooses a password and is in. A
 * client of its own, so no demo account loses its sessions.
 */
const NEW_PASSWORD = 'otra-frase-larga-para-entrar';

async function freshPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

test('the trainer shares a new-password link and the client gets back in with it', async ({
  page,
  browser,
}) => {
  const found: string[] = [];
  const email = `olvido-${Date.now()}@example.com`;
  await login(page, 'nerea.soto@example.com');
  const headers = { Origin: new URL(page.url()).origin };
  const created = await page.request.post('/api/v1/clients', {
    headers,
    data: {
      basics: {
        firstName: 'Olvido',
        lastName: 'Prueba',
        birthDate: '1990-05-05',
        sex: 'female',
        email,
      },
    },
  });
  expect(created.ok()).toBe(true);
  const { id: clientId } = (await created.json()) as { id: string };
  const invited = await page.request.post('/api/v1/invitations', {
    headers,
    data: { role: 'CLIENT', email, clientId },
  });
  const { link: invitation } = (await invited.json()) as { link: string };

  // The client creates the account and is in the app.
  const client = await freshPage(browser);
  await client.goto(invitation);
  await client.getByLabel('Nombre visible').fill('Olvido');
  await client.getByLabel('Contraseña', { exact: true }).fill('la-primera-frase-larga');
  await client.getByLabel('Repite la contraseña').fill('la-primera-frase-larga');
  await client.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(client.getByRole('heading', { name: 'Hola, Olvido' })).toBeVisible();

  // The trainer creates the link from the ficha.
  await page.goto(`/app/clients/${clientId}?tab=ficha#acceso`);
  await expect(page.getByText('El cliente tiene cuenta.')).toBeVisible();
  await page.getByRole('button', { name: 'Crear enlace para nueva contraseña' }).click();
  const shared = page.locator('code', { hasText: '/reset-password?token=' });
  await expect(shared).toBeVisible();
  const link = (await shared.textContent())!;
  await scanState(page, 'ficha con enlace', found);
  await expect(page.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute(
    'href',
    new RegExp(`^https://wa\\.me/\\?text=.*${encodeURIComponent(link).slice(-20)}`),
  );

  // On another phone, the link asks for the new password twice and signs in.
  const phone = await freshPage(browser);
  await phone.goto(link);
  await expect(phone.getByRole('heading', { name: 'Crea tu nueva contraseña' })).toBeVisible();
  await expect(phone.getByText(email)).toBeVisible();
  await scanState(phone, 'nueva contraseña', found);
  await phone.getByLabel('Nueva contraseña').fill(NEW_PASSWORD);
  await phone.getByLabel('Repite la contraseña').fill(`${NEW_PASSWORD}-x`);
  await expect(phone.getByText('Las contraseñas no coinciden.')).toBeVisible();
  await phone.getByLabel('Repite la contraseña').fill(NEW_PASSWORD);
  await phone.getByRole('button', { name: 'Guardar y entrar' }).click();
  await expect(phone.getByRole('heading', { name: 'Hola, Olvido' })).toBeVisible();

  // The old session is closed, and the link works only once.
  await client.reload();
  await expect(client).toHaveURL(/\/login/);
  await client.goto(link);
  await expect(client.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
  await client.getByText('Pide uno nuevo a tu entrenador.').waitFor();
  expect(found).toEqual([]);
});

test('«He olvidado mi contraseña» explains whom to ask', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'He olvidado mi contraseña' }).click();
  await expect(page.getByRole('heading', { name: '¿Has olvidado tu contraseña?' })).toBeVisible();
  await expect(
    page.getByText('Pide a tu entrenador un enlace para crear una nueva.'),
  ).toBeVisible();
});

test('an administrator creates a new-password link for a team account', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/admin/users');
  await page.getByRole('button', { name: /^Nueva contraseña para Pablo/ }).click();
  const dialog = page.getByRole('dialog', { name: /^Nueva contraseña para Pablo/ });
  await expect(dialog.locator('code')).toContainText('/reset-password?token=');
  await expect(dialog.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
  const found: string[] = [];
  await scanState(page, 'diálogo de nueva contraseña', found);
  expect(found).toEqual([]);
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toBeHidden();
});
