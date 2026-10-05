import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer reviews progress, records a new assessment and sees change against error', async ({
  page,
}) => {
  await login(page, 'pablo.ibarra@example.com');
  // The catalogue shows reliability and references, or says when they are missing.
  await page.getByRole('link', { name: 'Tests', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tests', exact: true })).toBeVisible();
  await expect(page.getByText('Error de medida desconocido').first()).toBeVisible();
  await page
    .getByRole('link', { name: /Salto con contramovimiento|CMJ/ })
    .first()
    .click();
  await expect(page.getByRole('link', { name: /^PMID \d+$/ }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Lozano, Sara' }).click();
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Evaluación' })
    .click();
  await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
  await expect(page.getByText(/Desde la primera evaluación/).first()).toBeVisible();

  // New assessment with one test.
  await page.getByLabel('Batería').selectOption('');
  const firstTest = page.locator('form').getByRole('checkbox').first();
  for (const box of await page.locator('form').getByRole('checkbox').all()) await box.uncheck();
  await firstTest.check();
  await page.getByRole('button', { name: 'Crear evaluación' }).click();
  await expect(page.getByRole('heading', { name: /Evaluación del/ })).toBeVisible();
  // Hoja de intentos: type, leave the row, it saves.
  await page
    .getByLabel(/intento 1/)
    .first()
    .fill('10');
  await page.getByRole('heading', { name: 'Hoja de intentos' }).click();
  await expect(page.getByText('Guardado').first()).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como completada' }).click();
  await expect(page.getByText('Completada', { exact: true })).toBeVisible();
});

test('another trainer cannot open the assessments of a client not assigned to them', async ({
  page,
}) => {
  await login(page, 'nerea.soto@example.com');
  const res = await page.request.get('/api/v1/clients');
  const list = (await res.json()) as { items: { id: string; lastName: string }[] };
  expect(list.items.some((c) => c.lastName === 'Lozano')).toBe(false);
});
