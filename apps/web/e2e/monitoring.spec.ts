import { expect, test } from '@playwright/test';
import { fromMenu, login, logoutStaff } from './helpers';

test('trainer sees alerts by severity, reviews a client follow-up and resolves an alert', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  // Home: the clients to review come first, with the reason in their row.
  const rows = page.locator('main ul').first().locator(':scope > li');
  await expect(rows.first().getByText('Revisar', { exact: true })).toBeAttached();
  await expect(
    rows.filter({ hasText: 'Garrido, Tomás' }).getByRole('link', { name: /Adherencia del/ }),
  ).toBeVisible();
  // Urgent alerts are counted in the header; the counter opens the alerts page.
  await page.getByRole('link', { name: /alertas pendientes$/ }).click();
  await expect(page.getByRole('heading', { name: 'Alertas', exact: true })).toBeVisible();
  // Demo data: alerts of every colour.
  await expect(page.getByText('🔴 Roja').first()).toBeVisible();
  await expect(page.getByText('🟡 Amarilla').first()).toBeVisible();
  await expect(page.getByText('🟢 Propuesta').first()).toBeVisible();
  // Tomás has red alerts in the demo (adherence; the pain one is resolved by the UX review).
  const red = page
    .getByRole('list', { name: 'Lista de alertas' })
    .locator(':scope > li')
    .filter({ hasText: '🔴 Roja' })
    .filter({ hasText: 'Tomás Garrido' })
    .first();
  await expect(red).toBeVisible();

  // Client follow-up: adherence, weekly load with its evidence, alerts.
  await red.getByRole('link', { name: /Tomás Garrido/ }).click();
  await expect(page.getByRole('heading', { name: 'Adherencia 4 semanas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Carga interna semanal/ })).toBeVisible();
  // Estimated strength (phase 14): informative, always with its limits.
  await expect(
    page.getByRole('heading', { name: 'Fuerza estimada (1RM orientativo)' }),
  ).toBeVisible();
  await expect(page.getByText(/No sustituye un 1RM medido/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Haddad 2017' })).toHaveAttribute(
    'href',
    'https://doi.org/10.3389/fnins.2017.00612',
  );

  // Resolve the green proposal of another client from the alerts page (audited, idempotent).
  await page.goto('/app/alerts?gravedad=green');
  // The alerts list (the pending adjustments card above also has «Propuesta» badges).
  const items = page
    .getByRole('list', { name: 'Lista de alertas' })
    .locator(':scope > li')
    .filter({ hasText: 'Propuesta' });
  const before = await items.count();
  if (before) {
    const item = items.first();
    await item.getByRole('button', { name: 'Resolver…' }).click();
    await item.getByLabel('Nota de resolución').fill('Revisado en E2E');
    await item.getByRole('button', { name: 'Resolver', exact: true }).click();
    await expect(items).toHaveCount(before - 1);
    await page.goto('/app/alerts?estado=resueltas');
    await expect(page.getByText(/Revisado en E2E/).first()).toBeVisible();
  }
});

test('alert thresholds: trainers read, ADMIN saves a new version', async ({ page }) => {
  await login(page, 'pablo.ibarra@example.com');
  await page.goto('/app/settings/alertas');
  await expect(page.getByText('Solo la administración puede cambiar los umbrales.')).toBeVisible();
  const res = await page.request.put('/api/v1/monitoring/rules', {
    headers: { Origin: new URL(page.url()).origin },
    data: { rules: [{ key: 'pain', enabled: true, parameters: {} }] },
  });
  expect(res.status()).toBe(403);

  await logoutStaff(page);
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/settings/alertas');
  await page.getByLabel('Motivo del cambio (se audita)').fill('Ajuste E2E');
  await page.getByRole('button', { name: 'Guardar nueva versión' }).click();
  await expect(page.getByText('Guardado')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Versión \d+ del centro/)).toBeVisible();
});

test('global calendar: month and week, filtered by client with phases and rest weeks', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await fromMenu(page, 'Calendario');
  await expect(page.getByRole('heading', { name: /de 20\d\d$/ })).toBeVisible();
  await page.getByLabel('Cliente', { exact: true }).selectOption({ label: 'Villalba, Marcos' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByText(/fase del plan/)).toBeVisible();
  await expect(page.getByText('📋 Evaluación').first()).toBeVisible();
  // Trainers only see their own clients' sessions; clients cannot use the staff calendar.
  const res = await page.request.get('/api/v1/calendar?from=2026-01-01&to=2026-12-31');
  expect(res.status()).toBe(422);
});
