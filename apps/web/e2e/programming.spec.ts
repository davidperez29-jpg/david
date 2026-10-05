import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer accepts a load progression, undoes it and turns the plan proposal into a draft', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  // The client's own link (on training days the list also shows today's sessions by name).
  await page.locator('main').getByRole('link', { name: 'Arrieta, Iker', exact: true }).click();

  // Seguimiento points to the pending adjustments (they never change the plan on their own).
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: 'Seguimiento', exact: true })
    .click();
  await page.getByRole('link', { name: 'Ver propuesta de ajuste' }).click();
  const card = page.locator('section').filter({ has: page.locator('#ajustes') });
  const item = card
    .locator('li')
    // The loads depend on which week comes next on the day of the run (e.g. 77,5 → 80 or 80 → 82,5).
    .filter({ hasText: /Sentadilla trasera con barra: subir de [\d,]+ kg a [\d,]+ kg/ })
    .first();
  await expect(item).toBeVisible();
  await item.getByText('¿Por qué?').click();
  await expect(
    item.getByText('El RIR es autoinformado y menos preciso lejos del fallo.'),
  ).toBeVisible();
  await item.getByText(/Qué cambiaría/).click();
  await expect(item.getByText(/^[\d,]+ → [\d,]+$/).first()).toBeVisible();

  await item.getByRole('button', { name: 'Aceptar', exact: true }).click();
  // Applied: it moves to "decided" with its changes, and can be undone.
  const decided = card
    .locator('details')
    .filter({ hasText: /Decididos recientemente/ })
    .last();
  await decided.locator('summary').first().click();
  const done = decided
    .locator('li')
    .filter({ hasText: /Sentadilla trasera/ })
    .first();
  await expect(done.getByText('Aceptada')).toBeVisible();
  await done.getByRole('button', { name: 'Deshacer' }).click();
  await expect(done.getByText('Deshecha')).toBeVisible();

  // Plan proposal from the decision engine → accepted as a draft (the active plan stays).
  await page
    .locator('main')
    .getByRole('link', { name: /^Propuesta · Deporte de equipo/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Propuesta del motor de programación' }),
  ).toBeVisible();
  await expect(page.getByText(/Punto de partida: plantilla/)).toBeVisible();
  await page.getByLabel('Nombre del plan').fill('Pretemporada (propuesta aceptada)');
  await page.getByRole('button', { name: 'Aceptar como plan (borrador)' }).click();
  await expect(
    page.getByRole('heading', { name: 'Pretemporada (propuesta aceptada)' }),
  ).toBeVisible();
  await expect(page.getByText('Borrador').first()).toBeVisible();
});
