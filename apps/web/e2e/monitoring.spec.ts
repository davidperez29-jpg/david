import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer sees alerts by severity, reviews a client follow-up and resolves an alert', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  // Demo data: alerts of every colour, red first.
  const alerts = page.getByRole('heading', { name: /^Alertas \(/ });
  await expect(alerts).toBeVisible();
  await expect(page.getByText('🔴 Roja').first()).toBeVisible();
  await expect(page.getByText('🟡 Amarilla').first()).toBeVisible();
  await expect(page.getByText('🟢 Propuesta').first()).toBeVisible();
  await expect(page.getByText(/Adherencia 28 d/i)).toBeVisible();

  await page
    .getByRole('link', { name: /^Alertas/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Alertas', exact: true })).toBeVisible();
  const pain = page
    .locator('li')
    .filter({ hasText: 'Requiere valoración por profesional sanitario' })
    .first();
  await expect(pain).toBeVisible();

  // Client follow-up: adherence, weekly load with its evidence, alerts.
  await pain.getByRole('link', { name: /Tomás Garrido/ }).click();
  await expect(page.getByRole('heading', { name: 'Adherencia 4 semanas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Carga interna semanal/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Haddad 2017' })).toHaveAttribute(
    'href',
    'https://doi.org/10.3389/fnins.2017.00612',
  );

  // Resolve the green proposal of another client from the alerts page (audited, idempotent).
  await page.goto('/app/alerts?gravedad=green');
  const items = page.locator('main li').filter({ hasText: 'Propuesta' });
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

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login(page, 'lucia.moreno@example.com');
  await page.goto('/app/settings/alertas');
  await page.getByLabel('Motivo del cambio (se audita)').fill('Ajuste E2E');
  await page.getByRole('button', { name: 'Guardar nueva versión' }).click();
  await expect(page.getByText('Guardado')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Versión \d+ del centro/)).toBeVisible();
});
