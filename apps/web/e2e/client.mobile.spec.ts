import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('client sees today screen and manages consent on mobile', async ({ page }) => {
  await login(page, 'marcos.villalba@example.com');
  await expect(page.getByText('Entrenamiento de hoy')).toBeVisible();
  await page.getByRole('link', { name: 'Privacidad' }).click();
  const photo = page.locator('li').filter({ hasText: 'Fotografías' });
  await photo.getByRole('button', { name: 'Otorgar consentimiento' }).click();
  await expect(photo.getByRole('button', { name: 'Retirar consentimiento' })).toBeVisible();
  await page.getByRole('link', { name: 'Perfil' }).click();
  await page.getByLabel('Preferencias').fill('Prefiero entrenar por la mañana');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardado ✓' })).toBeVisible();
  // touch targets in the bottom bar are at least 48px high
  const box = await page.getByRole('link', { name: 'Hoy' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
});
