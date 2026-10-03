import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer traces a method dose to verified PubMed sources', async ({ page }) => {
  await login(page, 'pablo.ibarra@example.com');
  await page.getByRole('link', { name: 'Ciencia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca científica' })).toBeVisible();

  await page.getByRole('link', { name: 'Fuerza máxima (cargas altas)' }).click();
  await expect(page.getByText('Global (solo lectura)')).toBeVisible();
  const dose = page.locator('li').filter({ hasText: 'pct_1rm' }).first();
  await expect(dose).toContainText('80–100');
  await dose.locator('summary').click();
  await expect(dose.getByRole('link', { name: /^PMID \d+$/ }).first()).toBeVisible();
  await expect(dose.getByRole('link', { name: /^DOI 10\./ }).first()).toBeVisible();

  // Trainers can propose evidence but not publish it.
  await page.getByRole('link', { name: 'Fuentes' }).click();
  await page.getByLabel('Buscar').fill('19204579');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByRole('link', { name: /Progression models in resistance training/ }).click();
  await expect(page.getByText('Según PubMed (NCBI).', { exact: false })).toBeVisible();
  await expect(page.getByText('Verificada', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Control de calidad' }).click();
  await expect(page.getByRole('heading', { name: /Errores que bloquean/ })).toBeVisible();
  await expect(page.getByText('Artículo retractado', { exact: false })).toBeVisible();
});

test('admin creates, verifies and grades an organization source', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/science/sources/new');
  const title = `Ensayo E2E ${Date.now()}`;
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Diseño').selectOption('rct');
  await page.getByLabel('URL').fill('https://example.org/estudio');
  await page.getByRole('button', { name: 'Crear fuente' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.locator('span', { hasText: /^Sin verificar$/ })).toBeVisible();

  await page.getByLabel('Resultado medido').selectOption({ label: 'Altura de salto' });
  await page
    .getByLabel('Población', { exact: true })
    .selectOption({ label: 'Adultos sanos físicamente activos' });
  await page.getByLabel('Cita literal de la fuente').fill('Jump height improved after training.');
  await page.getByRole('button', { name: 'Añadir hallazgo' }).click();
  await expect(page.getByText('H · No verificada').first()).toBeVisible();

  await page.getByLabel('Cómo se ha verificado').fill('Lectura del texto completo');
  await page.getByRole('button', { name: 'Registrar verificación' }).click();
  await expect(page.getByText('B · Evidencia moderada').first()).toBeVisible();
});

test('client accounts cannot read the scientific library API', async ({ page }) => {
  await login(page, 'elena.prieto@example.com');
  const res = await page.request.get('/api/v1/science/claims');
  expect(res.status()).toBe(403);
});
