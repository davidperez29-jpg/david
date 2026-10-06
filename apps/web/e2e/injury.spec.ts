import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Restructure phase 7: lesiones, readaptación y vuelta al deporte. The software never says
 * «apto» nor advances by itself: alerts block [Avanzar de fase] until reviewed, the decision is
 * recorded by a person with name and role.
 */
const clientTab = async (page: import('@playwright/test').Page, name: string, tab: string) => {
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('link', { name }).first().click();
  await page
    .getByRole('navigation', { name: 'Secciones del cliente' })
    .getByRole('link', { name: tab })
    .click();
};

test('an open alert blocks advancing until reviewed; the decision is human and never «apto»', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await clientTab(page, 'Prieto, Elena', 'Readaptación');
  await page.getByRole('link', { name: /Esguince lateral de tobillo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Esguince lateral/ })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/\bapt[oa]\b/i);

  const alerts = page.getByRole('region', { name: /Alertas de seguridad sin revisar/ });
  await expect(alerts).toContainText('Inestabilidad');
  const advance = page.getByRole('button', { name: /Avanzar de fase/ });
  await expect(advance).toBeDisabled();
  await expect(page.getByText(/alerta\(s\) de seguridad sin revisar/)).toBeVisible();

  await alerts.getByLabel('Qué se ha valorado y con quién').fill('Valorado con fisioterapia.');
  await alerts.getByRole('button', { name: 'Marcar como revisada' }).click();
  await expect(alerts).toBeHidden();
  await expect(page.getByText(/alerta\(s\) de seguridad sin revisar/)).toBeHidden();

  // A new symptom record over the protocol threshold raises an alert again.
  await page.getByLabel('Dolor (0–10)').fill('8');
  await page.getByRole('button', { name: 'Registrar síntomas' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Alertas generadas' })).toContainText(
    'Revisar antes de progresar',
  );
  await expect(page.getByRole('region', { name: /Alertas de seguridad/ })).toBeVisible();

  // The return-to-sport decision: free text is checked (no «apto»), then recorded with a name.
  await page.getByText('Registrar una decisión del equipo responsable').click();
  await page.getByLabel('Quién decide').fill('Equipo médico');
  await page.getByLabel('Rol', { exact: true }).fill('Medicina deportiva');
  await page.getByLabel('Motivo (opcional)').fill('Está apta para competir');
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: /Revisa el texto/ })
      .first(),
  ).toBeVisible();
  await page.getByLabel('Motivo (opcional)').fill('Completar la fase de fuerza.');
  await page.getByRole('button', { name: 'Registrar decisión' }).click();
  await expect(page.getByText(/Todavía no · Equipo médico \(Medicina deportiva\)/)).toBeVisible();
});

test('open a case from Ficha → Salud, check the criteria and advance the phase by hand', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await clientTab(page, 'Villalba, Marcos', 'Ficha');
  await page.getByRole('link', { name: 'Lesiones y readaptación →' }).click();
  await page
    .getByLabel('Lesión', { exact: true })
    .selectOption({ label: 'Lesión muscular de isquiosurales (Isquiosurales)' });
  await page.getByLabel('Lado').selectOption('left');
  await page.getByLabel('Fecha de la lesión').fill('2026-09-20');
  await page.getByRole('button', { name: 'Abrir caso' }).click();
  await expect(page.getByRole('heading', { name: /^Fase 1: / })).toBeVisible();
  const advance = page.getByRole('button', { name: /Avanzar de fase/ });
  await expect(advance).toBeDisabled();
  // Mark every mandatory progression criterion of phase 1 as met.
  const rows = page.getByRole('table', { name: 'Criterios de la fase' }).getByRole('row');
  const groups = rows.filter({ hasText: '(obligatorio)' }).getByRole('group');
  for (const g of await groups.all()) {
    await g.getByRole('button', { name: 'Cumplido', exact: true }).click();
    await expect(g.getByRole('button', { name: 'Cumplido', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await expect(advance).toBeEnabled();
  await advance.click();
  await expect(page.getByRole('heading', { name: /^Fase 2: / })).toBeVisible();
  await expect(page.getByText(/\(actual\)/).first()).toBeVisible();
});
