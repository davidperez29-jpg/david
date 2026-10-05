import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Restructure phase 4: a team assessed together. From «Mis clientes» to the group report in
 * 3 clicks; attempts pasted from Excel into the sheet; the centre's own formula constants.
 */
test('group: report in 3 clicks, attempts pasted from Excel, Z and bands', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Grupos y equipos' }).click();
  await page
    .getByRole('link', { name: /Último informe/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Resumen del grupo' })).toBeVisible();
  const summary = page.getByRole('table', { name: 'Resumen por prueba' });
  await expect(summary.getByRole('rowheader', { name: /Σ6 pliegues/ })).toBeVisible();
  await expect(summary.getByRole('rowheader', { name: /% graso \(Faulkner\)/ })).toBeVisible();
  await expect(summary.getByRole('rowheader', { name: /Asimetría/ })).toBeVisible();
  await expect(page.getByRole('table', { name: /Z de cada persona/ })).toContainText('Z ');

  // Attempts sheet: paste a 2×3 block copied from Excel into the triceps skinfold.
  await page.getByRole('link', { name: 'Hoja de intentos' }).click();
  await page.getByRole('link', { name: /Pliegue tríceps/ }).click();
  const first = page.getByLabel(/, intento 1 \(mm\)/).first();
  await first.focus();
  await page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement;
    const data = new DataTransfer();
    data.setData('text/plain', '9,1\t9,3\t9,0\n7,4\t7,2\t7,6\n');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await expect(page.getByText('Guardado')).toHaveCount(2);
  // Median of 9,1 / 9,3 / 9,0 = 9,1.
  await expect(page.getByRole('table', { name: /intentos por jugador/ })).toContainText('9,1');
});

test('the centre edits Faulkner constants and goes back to the platform ones', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Tests', exact: true }).click();
  await page.getByRole('link', { name: 'Fórmulas y constantes' }).click();
  const form = page.getByRole('form', { name: 'Constantes de % graso (Faulkner)' });
  await form.getByLabel('Constante a').fill('0,16');
  await form.getByRole('button', { name: 'Guardar constantes' }).click();
  await expect(page.getByText('body_fat_faulkner = sum_4_skinfolds * 0,16 + 5,783')).toBeVisible();
  await form.getByRole('button', { name: 'Volver a las de la plataforma' }).click();
  await expect(page.getByText('body_fat_faulkner = sum_4_skinfolds * 0,153 + 5,783')).toBeVisible();
});
