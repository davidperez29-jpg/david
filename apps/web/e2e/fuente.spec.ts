import { expect, test } from '@playwright/test';
import { fromMenu, login } from './helpers';

/**
 * Restructure phase 9: the science shows up where it is used. «Fuente» next to a readaptation
 * criterion opens article, DOI/PMID, population, what it supports and limitations (verified
 * sources only); the searches are logged; a reference that could not be verified says so.
 */
test('«Fuente» next to a criterion, the search log and an unverifiable reference', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Prieto, Elena' }).first().click();
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Readaptación' })
    .click();
  await page.getByRole('link', { name: /Esguince lateral de tobillo/ }).click();

  const criteria = page.getByRole('table', { name: 'Criterios de la fase' });
  const fuente = criteria.locator('summary', { hasText: 'Fuente' }).first();
  await fuente.click();
  const card = criteria.locator('details[open]').first();
  await expect(card.getByRole('link', { name: /^PMID \d+$/ })).toBeVisible();
  await expect(card.getByRole('link', { name: /^DOI 10\./ })).toBeVisible();
  for (const field of ['Población', 'Qué respalda', 'Limitaciones', 'Origen'])
    await expect(card.getByText(field, { exact: true })).toBeVisible();
  await expect(card).toContainText('Verificada');

  // The protocol lists its sources the same way.
  await page.locator('summary', { hasText: 'Fuentes del protocolo' }).click();
  await expect(page.getByText(/Smith .*\(2021\)/).first()).toBeVisible();

  // Ciencia → Búsquedas: the verification of the club workbook's references, query by query.
  await fromMenu(page, 'Ciencia');
  await page.getByRole('link', { name: 'Búsquedas' }).click();
  await page
    .getByRole('navigation', { name: 'Temas' })
    .getByRole('link', { name: 'club_references' })
    .click();
  await expect(page.getByRole('heading', { name: 'Búsquedas · club_references' })).toBeVisible();
  await expect(page.getByText(/Seleccionadas:/).first()).toBeVisible();

  // A reference cited in the workbook and not found: shown, flagged, never support.
  await page.getByRole('link', { name: 'Fuentes' }).click();
  await page.getByLabel('Buscar', { exact: true }).fill('Anthropometric Assessment');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByRole('link', { name: /International Standards for Anthropometric/ }).click();
  await expect(page).toHaveURL(/\/app\/science\/sources\/[0-9a-f-]{36}$/);
  await expect(page.getByText('No verificable', { exact: true })).toBeVisible();
  await expect(page.getByText(/No se usa como respaldo/)).toBeVisible();
  await expect(page.getByText(/Citada en: Informe de rendimiento/)).toBeVisible();
});
