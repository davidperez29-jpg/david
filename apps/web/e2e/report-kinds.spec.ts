import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Restructure phase 6: the 8 report kinds. A comparative report with the radar (screen and PDF)
 * from the client's Informes tab, and the group «rendimiento» report from the group report.
 */
test('comparative report: kind selector, radar on screen, PDF download', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Villalba, Marcos' }).first().click();
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Informes' })
    .click();
  await page.getByLabel('Tipo de informe').selectOption('comparative');
  await expect(page.getByRole('combobox', { name: 'Evaluación A', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Referencia', exact: true })).toHaveValue(
    'group',
  );
  await page.getByRole('button', { name: 'Generar informe' }).click();
  await expect(
    page.getByRole('heading', { name: 'Informe comparativo', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /Radar por dimensiones/ })).toBeVisible();
  await expect(page.getByText(/solo para el equipo/)).toBeVisible();
  const pdf = await page.request.get(
    (await page.getByRole('link', { name: 'Descargar PDF' }).getAttribute('href'))!,
  );
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');

  // The language rules: the trainer's text cannot say «previene lesiones».
  await page.goBack();
  await page.getByLabel('Tipo de informe').selectOption('follow_up');
  await page.getByLabel('Tus recomendaciones').fill('Este trabajo previene lesiones.');
  await page.getByRole('button', { name: 'Generar informe' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'previene lesiones' })).toBeVisible();
});

test('rendimiento (group) report: individual sheets with radar, downloads', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Grupos y equipos' }).click();
  await page
    .getByRole('link', { name: /Último informe/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Generar informe de rendimiento' }).click();
  await expect(
    page.getByRole('heading', { name: 'Informe de rendimiento', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '2. Resumen del grupo' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Perfil de/ }).first()).toBeVisible();
  for (const f of ['pdf', 'xlsx', 'csv']) {
    const href = await page
      .getByRole('link', { name: f === 'pdf' ? 'Descargar PDF' : f === 'xlsx' ? 'Excel' : 'CSV' })
      .getAttribute('href');
    expect((await page.request.get(href!)).status()).toBe(200);
  }
});
