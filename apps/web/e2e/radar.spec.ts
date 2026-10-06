import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Restructure phase 5: Comparativa y radar. From the client's Evaluación tab in one click; the
 * radar is an accessible image (title + description) with its table; the scale can be changed.
 */
test('comparativa: radar with its table, A vs B on the same basis, scale selector', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Villalba, Marcos' }).first().click();
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Evaluación' })
    .click();
  await page.getByRole('link', { name: 'Comparativa y radar' }).click();
  await expect(page.getByRole('heading', { name: 'Comparativa y radar' })).toBeVisible();
  const radar = page.getByRole('img', { name: /Radar de Marcos Villalba/ });
  await expect(radar).toBeVisible();
  // Both layers are named in the legend; the table holds the same scores.
  await expect(page.locator('figcaption').getByText(/^A · /)).toBeVisible();
  await expect(page.locator('figcaption').getByText(/^B · /)).toBeVisible();
  const dims = page.getByRole('table', { name: 'Puntuación por dimensión' });
  await expect(dims.getByRole('rowheader', { name: 'Aceleración' })).toBeVisible();
  await expect(dims.getByRole('rowheader', { name: 'Fuerza' })).toBeVisible(); // a gap, not a zero
  await expect(page.getByRole('table', { name: /cambio real por test/ })).toContainText(
    'Sprint lineal 5 m',
  );

  await page.getByLabel('Escala').selectOption('percentile');
  await page.getByRole('button', { name: 'Comparar' }).click();
  await expect(page.getByRole('heading', { name: /Percentil en el grupo/ })).toBeVisible();
  await expect(dims).toContainText(/P\d+/);
});
