import { devices, expect, test } from '@playwright/test';
import { scanState } from './a11y-helpers';
import { login, offerInstall } from './helpers';

/**
 * «Tenla como una app» on the client's «Hoy» (restructure phase 24): the browser's prompt on
 * Android, the steps on the iPhone, and «Ahora no» is remembered.
 */
test('Android: «Instalar la app» on Hoy, and «Ahora no» is remembered', async ({ page }) => {
  await login(page, 'marcos.villalba@example.com');
  const card = page.getByRole('region', { name: 'Tenla como una app' });
  // Nothing to suggest until the browser says the app can be installed.
  await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
  await expect(card).toHaveCount(0);
  await offerInstall(page);
  await expect(card.getByRole('button', { name: 'Instalar la app' })).toBeVisible();
  const found: string[] = [];
  await scanState(page, 'hoy con «Instalar la app»', found);
  expect(found).toEqual([]);

  await card.getByRole('button', { name: 'Ahora no' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await offerInstall(page);
  await expect(page.getByRole('heading', { name: /^Hola,/ })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test('iPhone: Hoy explains how to add the app to the home screen', async ({ browser }) => {
  // The iPhone's screen and browser identity, in Chromium (the browser the suite runs).
  const iphone: Record<string, unknown> = { ...devices['iPhone 13'] };
  delete iphone.defaultBrowserType;
  const context = await browser.newContext(iphone);
  const page = await context.newPage();
  await login(page, 'iker.arrieta@example.com');
  const card = page.getByRole('region', { name: 'Tenla como una app' });
  await expect(card).toContainText('Añadir a pantalla de inicio');
  const found: string[] = [];
  await scanState(page, 'hoy en iPhone', found);
  expect(found).toEqual([]);
  await card.getByRole('button', { name: 'Entendido' }).click();
  await expect(card).toHaveCount(0);
  await context.close();
});
