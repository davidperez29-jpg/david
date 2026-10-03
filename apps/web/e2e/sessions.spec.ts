import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer reviews executed sessions and logs one in room mode', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await expect(page.getByRole('heading', { name: 'Revisión de sesiones' })).toBeVisible();
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Villalba, Marcos' }).click();
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Sesiones' })
    .click();
  await expect(page.getByText(/Completada/).first()).toBeVisible();
  await page.locator('a[href*="/sessions/"]').first().click();
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
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Planificación' })
    .click();
  await page.locator('a[href^="/app/plans/"]').first().click();
  await expect(page.getByText(/sesiones publicadas al cliente/)).toBeVisible();
  await expect(page.getByText('· publicada').first()).toBeVisible();
});
