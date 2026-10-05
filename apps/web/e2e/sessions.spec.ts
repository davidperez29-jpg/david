import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer reviews executed sessions and logs one in room mode', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  // The client's Programa tab lists the executed sessions.
  await page.getByRole('link', { name: 'Villalba, Marcos' }).click();
  await expect(
    page
      .locator('#sesiones')
      .getByText(/Completada/)
      .first(),
  ).toBeVisible();
  // What needs review is in the client's row of the home: one click to the session.
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: 'Villalba, Marcos' }) });
  await row
    .getByRole('link', { name: /revisar la sesión/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Cumplimiento' })).toBeVisible();

  // Pending substitution (demo data): the trainer decides.
  const reject = page.getByRole('button', { name: 'Rechazar' });
  if (await reject.count()) {
    await reject.first().click();
    await expect(page.getByText('Sustitución rechazada').first()).toBeVisible();
  }

  await page.getByRole('link', { name: 'Modo sala' }).click();
  await expect(page.getByText('Modo sala: registras en nombre del cliente.')).toBeVisible();
  const tick = page.getByRole('button', { name: /^Registrar serie/ }).first();
  await tick.click();
  await expect(tick).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Guardado').first()).toBeVisible({ timeout: 10_000 });
});

test('publishing requires an active plan and is shown per session', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Villalba, Marcos' }).click();
  // Programa is the default tab: the active plan comes first.
  await expect(
    page.getByRole('navigation', { name: 'Secciones del cliente' }).getByRole('link', {
      name: 'Programa',
    }),
  ).toHaveAttribute('aria-current', 'page');
  await page.locator('a[href^="/app/plans/"]').first().click();
  await expect(page.getByText(/sesiones publicadas al cliente/)).toBeVisible();
  await expect(page.getByText('· publicada').first()).toBeVisible();
});
