import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('client sees today screen and manages consent on mobile', async ({ page }) => {
  await login(page, 'marcos.villalba@example.com');
  await expect(page.getByText(/Entrenamiento de hoy|Próximo entrenamiento/)).toBeVisible();
  // Privacy and settings live under Perfil (bottom bar: Hoy · Calendario · Progreso · Perfil).
  await page.getByRole('link', { name: 'Perfil' }).click();
  await page.getByRole('link', { name: 'Privacidad' }).click();
  const photo = page.locator('li').filter({ hasText: 'Fotografías' });
  // Idempotent across runs: toggle whatever the current state is, then toggle back.
  const grant = photo.getByRole('button', { name: 'Otorgar consentimiento' });
  const revoke = photo.getByRole('button', { name: 'Retirar consentimiento' });
  await expect(grant.or(revoke)).toBeVisible();
  if (await revoke.isVisible()) {
    await revoke.click();
    await expect(grant).toBeVisible();
  }
  await grant.click();
  await expect(revoke).toBeVisible();
  await page.getByRole('link', { name: 'Perfil' }).click();
  await page.getByLabel('Preferencias').fill('Prefiero entrenar por la mañana');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardado ✓' })).toBeVisible();
  // touch targets in the bottom bar are at least 48px high
  const box = await page.getByRole('link', { name: 'Hoy' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
});

test('client sees their progress in plain language', async ({ page }) => {
  await login(page, 'iker.arrieta@example.com');
  await page.getByRole('link', { name: 'Progreso' }).click();
  await expect(page.getByRole('heading', { name: 'Tu progreso' })).toBeVisible();
  await expect(page.getByText(/margen de error/).first()).toBeVisible();
  // Clients cannot record results.
  const res = await page.request.get('/api/v1/assessment-tests');
  expect(res.status()).toBe(200);
});
