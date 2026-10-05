import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer creates a 12-week, 3-day plan from a template and edits a session', async ({
  page,
}) => {
  const started = Date.now();
  await login(page, 'pablo.ibarra@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name: 'Rey, Claudia' }).click();
  // Programa (default tab) holds the plans.

  // The tab also offers the engine's plan proposal (Phase 11): use the "Nuevo plan" card.
  const form = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Nuevo plan' }),
  });
  await form.getByLabel('Plantilla').selectOption({ label: 'Hipertrofia · 3 días (full body)' });
  await form.getByLabel('Nombre').fill(`Plan E2E ${Date.now()}`);
  await form.getByLabel('Inicio').fill('2026-11-02');
  for (const day of ['Martes', 'Jueves']) {
    const b = form.getByRole('button', { name: day, exact: true });
    if ((await b.getAttribute('aria-pressed')) === 'true') await b.click();
  }
  for (const day of ['Lunes', 'Miércoles', 'Viernes']) {
    const b = form.getByRole('button', { name: day, exact: true });
    if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  }
  await form.getByRole('button', { name: 'Crear plan' }).click();
  await expect(page.getByText('12 semanas · 3 sesiones/semana', { exact: false })).toBeVisible();
  await expect(page.locator('span', { hasText: /^Semana 12$/ })).toBeVisible();

  // Session editor: client text is generated from the prescription; edits are saved.
  await page
    .getByRole('link', { name: /A · Full body A/ })
    .first()
    .click();
  await expect(page.getByText(/Para el cliente:/).first()).toBeVisible();
  await expect(page.getByText(/repeticiones en reserva/).first()).toBeVisible();
  const sets = page.getByLabel('Series').first();
  await sets.fill('4');
  await page.getByRole('button', { name: 'Guardar', exact: true }).first().click();
  await expect(page.getByText(/^4×/).first()).toBeVisible();

  await page.getByRole('link', { name: /← Plan E2E/ }).click();
  await page
    .getByRole('navigation', { name: 'Vista del plan' })
    .getByRole('link', { name: 'Calendario' })
    .click();
  await expect(page.getByText(/noviembre de 2026/i)).toBeVisible();
  await page.getByRole('link', { name: 'Gestión y revisiones' }).click();
  await page.getByRole('button', { name: 'Activar plan' }).click();
  await expect(page.getByText(/Revisión 1/)).toBeVisible();
  // The whole plan as a PDF: team version (internal notes) and client version.
  for (const [link, file] of [
    ['PDF (equipo)', /^plan-plan-e2e-\d+\.equipo\.pdf$/],
    ['PDF (cliente)', /^plan-plan-e2e-\d+\.pdf$/],
  ] as const) {
    const dl = page.waitForEvent('download');
    await page.getByRole('link', { name: link }).click();
    expect((await dl).suggestedFilename()).toMatch(file);
  }
  // Acceptance criterion (§16.2): well under 20 minutes from template to an active plan.
  expect(Date.now() - started).toBeLessThan(20 * 60 * 1000);
});

test('client accounts cannot read plans through the staff API', async ({ page }) => {
  await login(page, 'iker.arrieta@example.com');
  const res = await page.request.get('/api/v1/plan-templates');
  expect(res.status()).toBe(403);
});
