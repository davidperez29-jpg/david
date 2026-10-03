import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer reviews the footballer’s needs with their “why”, decides and sees rule metrics', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.locator('main').getByRole('link', { name: /Iker/ }).first().click();
  await page.getByRole('link', { name: 'Necesidades', exact: true }).click();

  // Demo: centre thresholds for footballers (1.5 × BW) and a recent 1RM of 98 kg at 75 kg.
  await expect(
    page.getByText('1,31 ×PC frente al umbral del centro 1,5 ×PC.', { exact: true }),
  ).toBeVisible();
  const priorities = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Prioridades' }),
  });
  await expect(priorities.getByText('P1 · Fuerza máxima')).toBeVisible();

  // "¿Por qué?": data → interpretation → rule → evidence (with DOI) → … → confidence.
  const needs = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Necesidades' }),
  });
  const strength = needs.locator('li').filter({ hasText: 'Fuerza máxima' }).first();
  await strength.getByText('¿Por qué?').click();
  await expect(strength.getByText('needs.max_strength.relative_strength_low (v1)')).toBeVisible();
  await expect(strength.getByRole('link', { name: /^DOI 10\./ }).first()).toHaveAttribute(
    'href',
    /^https:\/\/doi\.org\/10\./,
  );
  await expect(strength.getByText('Limitaciones', { exact: true })).toBeVisible();

  // The trainer has the last word: reject a method with a reason (audited).
  const methods = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Métodos', exact: true }),
  });
  const method = methods.locator('li').filter({ hasText: 'Pliometría' }).first();
  await method.getByRole('button', { name: 'Rechazar' }).click();
  await method.getByLabel('Motivo').fill('Sin superficie adecuada esta semana');
  await method.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(method.getByText('Rechazada')).toBeVisible();

  // Rules page: version, thresholds and per-rule override metrics.
  await page.goto('/app/settings/decision');
  await expect(page.getByRole('heading', { name: 'Reglas del motor de decisión' })).toBeVisible();
  await expect(page.getByText(/Versión 1 del centro/)).toBeVisible();
  await expect(page.getByLabel(/^Umbral de fuerza relativa/)).toHaveValue('1.5');
  await expect(page.getByText(/1 decididas · 0 rechazadas/).first()).toBeVisible();
});
