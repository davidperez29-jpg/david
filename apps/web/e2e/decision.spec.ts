import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('trainer reviews the footballer’s needs with their “why”, decides and sees rule metrics', async ({
  page,
}) => {
  await login(page, 'lucia.moreno@example.com');
  await page.getByRole('link', { name: 'Clientes', exact: true }).click();
  // The client's own link (on training days the list also shows today's sessions by name).
  await page.locator('main').getByRole('link', { name: 'Arrieta, Iker', exact: true }).click();
  // The decision engine opens from Programa (it is not a tab of its own).
  await page
    .getByRole('link', { name: /necesidades/i })
    .first()
    .click();

  // Demo: the centre's thresholds are values for its footballers (1.5 × BW, restructure phase 17)
  // and Iker has a recent 1RM of 98 kg at 75 kg.
  await expect(
    page.getByText('1,31 ×PC frente al umbral del centro para fútbol 1,5 ×PC.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Umbral de fuerza relativa: 1,5 ×PC \(fútbol\)/).first(),
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
  const strengthRule = page.getByRole('group', { name: 'profile.relative_strength_low' });
  // No general value: only the footballers' one.
  await expect(strengthRule.getByLabel(/^Umbral de fuerza relativa/).first()).toHaveValue('');
  const football = strengthRule.getByRole('group', { name: 'Valores por población 1' });
  await expect(football.getByLabel('Deporte')).toHaveValue('football');
  await expect(football.getByLabel(/^Umbral de fuerza relativa/)).toHaveValue('1.5');
  await expect(page.getByText(/1 decididas · 0 rechazadas/).first()).toBeVisible();

  // ADMIN adds a value for women footballers (the most specific match wins) as a new version…
  const cmj = page.getByRole('group', { name: 'profile.cmj_low' });
  await cmj.getByRole('button', { name: 'Añadir valores por población' }).click();
  const women = cmj.getByRole('group', { name: 'Valores por población 2' });
  await women.getByLabel('Sexo').selectOption('female');
  await women.getByLabel('Deporte').selectOption('football');
  await women.getByLabel(/^Umbral de CMJ/).fill('30');
  await page.getByLabel('Motivo del cambio (se audita)').fill('CMJ del equipo femenino');
  await page.getByRole('button', { name: 'Guardar nueva versión' }).click();
  await expect(page.getByText('Guardado')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Versión 2 del centro/)).toBeVisible();
  const saved = cmj.getByRole('group', { name: 'Valores por población 2' });
  await expect(saved.getByLabel('Sexo')).toHaveValue('female');
  await expect(saved.getByLabel(/^Umbral de CMJ/)).toHaveValue('30');
  // …and removes it again (the demo stays as it was).
  await saved.getByRole('button', { name: 'Quitar' }).click();
  await page.getByRole('button', { name: 'Guardar nueva versión' }).click();
  await expect(page.getByText('Guardado')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Versión 3 del centro/)).toBeVisible();
  await expect(cmj.getByRole('group', { name: 'Valores por población 2' })).toHaveCount(0);
});
