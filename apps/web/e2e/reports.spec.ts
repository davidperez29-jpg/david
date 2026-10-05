import { expect, test } from '@playwright/test';
import { fromMenu, login } from './helpers';

test('client report with 11 sections and PDF; validated import; export', async ({ page }) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  // The client's own link (on training days the list also shows today's sessions by name).
  await page.locator('main').getByRole('link', { name: 'Arrieta, Iker', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Informes', exact: true })
    .click();

  // Generate a report (frozen snapshot) with the trainer's own recommendations.
  await page
    .getByLabel(/Tus recomendaciones/)
    .fill('Dos días de fuerza; reevaluar en la semana 6.');
  await page.getByRole('button', { name: 'Generar informe' }).click();
  await expect(page.getByRole('heading', { name: 'Informe de Iker Arrieta' })).toBeVisible();
  for (const s of [
    '1. Datos',
    '6. Interpretación',
    '10. Recomendaciones',
    '11. Próxima reevaluación',
  ])
    await expect(page.getByRole('heading', { name: s })).toBeVisible();
  await expect(page.getByText('Dos días de fuerza; reevaluar en la semana 6.')).toBeVisible();
  await expect(page.getByText(/· íntegro/)).toBeVisible();
  const pdf = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar PDF' }).click();
  expect((await pdf).suggestedFilename()).toMatch(/^informe-iker-arrieta-\d{4}-\d{2}-\d{2}\.pdf$/);

  // Share it with the client (plain-language version), preview it, stop sharing.
  await page.getByRole('button', { name: 'Compartir con el cliente' }).click();
  await expect(page.getByText(/Compartido con el cliente el/)).toBeVisible();
  await page.getByRole('link', { name: 'Ver la versión del cliente' }).click();
  await expect(page.getByText('Así lo ve el cliente en su app.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu informe, Iker' })).toBeVisible();
  await expect(page.getByText('Dos días de fuerza; reevaluar en la semana 6.')).toBeVisible();
  await page.getByRole('link', { name: '← Informe completo' }).click();
  await page.getByRole('button', { name: 'Dejar de compartir' }).click();
  await expect(page.getByRole('button', { name: 'Compartir con el cliente' })).toBeVisible();

  // Import: errors per row and column before anything is written; only valid rows imported.
  await fromMenu(page, 'Informes');
  await page.getByRole('link', { name: 'Nueva importación' }).click();
  await page.getByLabel('Qué importar').selectOption('clients');
  await page.locator('input[type=file]').setInputFiles({
    name: 'clientes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'Nombre;Apellidos;Fecha nacimiento;Sexo;Email',
        `Marta;E2E;14/03/1995;mujer;marta.e2e.${Date.now()}@example.com`,
        'Pep;E2E;31/02/1990;quizá;',
      ].join('\n'),
    ),
  });
  await page.getByRole('button', { name: 'Validar archivo' }).click();
  await expect(page.getByText(/1 válidas/)).toBeVisible();
  await expect(page.getByText(/Fecha nacimiento: Fecha no válida/)).toBeVisible();
  await expect(page.getByText('Sexo: Sexo no válido')).toBeVisible();
  await page.getByRole('button', { name: 'Importar 1 fila válida' }).click();
  await expect(page.getByRole('status')).toHaveText(/1 filas importadas/);

  // Export: an XLSX download of the clients the trainer can see.
  await page.goto('/app/informes');
  const xlsx = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar' }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.xlsx$/);
});
