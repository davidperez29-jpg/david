import { expect, test } from '@playwright/test';
import { a11yIds, CLIENT_TABS, scan, scanState } from './a11y-helpers';
import { login } from './helpers';

/** WCAG 2.2 AA on every trainer page (desktop), light and dark. See a11y-helpers.ts. */
test('trainer pages meet WCAG 2.2 AA (axe, light and dark)', async ({ page }) => {
  test.setTimeout(600_000);
  const i = await a11yIds();
  const found: string[] = [];
  for (const url of ['/login', '/forgot-password']) await scan(page, url, found);
  await login(page, 'lucia.moreno@example.com');
  const pages = [
    '/app',
    '/app/clients',
    '/app/clients/new',
    ...CLIENT_TABS.map((t) => `/app/clients/${i.client}?tab=${t}`),
    `/app/clients/${i.client}/assessments/${i.assessment}`,
    `/app/clients/${i.client}/assessments/comparativa`,
    `/app/clients/${i.injuryClient}?tab=readaptacion`,
    `/app/clients/${i.injuryClient}/lesiones/${i.injury}`,
    '/app/groups',
    '/app/assessments/formulas',
    `/app/clients/${i.client}/informes/${i.report}`,
    `/app/clients/${i.client}/informes/${i.report}/cliente`,
    `/app/clients/${i.client}/sessions/${i.session}`,
    `/app/clients/${i.client}/sessions/${i.session}/sala`,
    '/app/calendar',
    '/app/alerts',
    '/app/library',
    '/app/library/new',
    `/app/library/${i.exercise}`,
    '/app/assessments',
    `/app/assessments/tests/${i.test}`,
    '/app/plans',
    `/app/plans/${i.plan}`,
    `/app/plans/${i.plan}/sessions/${i.session}`,
    `/app/plans/templates/${i.template}`,
    '/app/science',
    '/app/science/claims',
    `/app/science/claims/${i.claim}`,
    '/app/science/claims/new',
    `/app/science/methods/${i.method}`,
    '/app/science/qa',
    '/app/science/sources',
    `/app/science/sources/${i.source}`,
    '/app/science/sources/new',
    '/app/science/busquedas',
    '/app/informes',
    '/app/informes/importar',
    `/app/informes/importar/${i.importJob}`,
    '/app/admin/users',
    '/app/admin/privacidad',
    '/app/settings',
    '/app/settings/alertas',
    '/app/settings/decision',
  ];
  for (const url of pages) await scan(page, url, found);
  console.log(found.join('\n') || 'Sin infracciones graves.');
  expect(found).toEqual([]);
});

/**
 * Restructure phase 18: states that only appear after an action (open proposals with their
 * table and edit form, a new population row, an error summary, «Mover» open), scanned too, and
 * where the keyboard focus lands.
 */
test('interactive states of the engine, rules and calendar meet WCAG 2.2 AA', async ({ page }) => {
  test.setTimeout(300_000);
  const found: string[] = [];
  await login(page, 'lucia.moreno@example.com');

  // Alertas: a client's proposals open, with «Qué cambiaría» and the edit form.
  await page.goto('/app/alerts');
  const card = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /Ajustes propuestos/ }) });
  if (await card.count()) {
    await card.locator('details > summary').first().click();
    const item = card.locator('li').first();
    await item.locator('summary', { hasText: 'Qué cambiaría' }).click();
    await expect(item.getByRole('region', { name: /Qué cambiaría/ })).toBeVisible();
    const edit = item.getByRole('button', { name: 'Editar' });
    if (await edit.count()) await edit.click();
    await scanState(page, '/app/alerts (ajuste abierto)', found);
  }
  await expect(page.getByRole('heading', { name: 'Alertas activas' })).toBeVisible();

  // Decision rules: a new population row takes the focus; saving it empty shows the summary.
  await page.goto('/app/settings/decision');
  await page.getByRole('button', { name: 'Añadir valores por población' }).first().click();
  await expect(page.locator('[data-pv] select:focus')).toHaveCount(1);
  await expect(page.getByText(/^Población \d+$/).first()).toBeVisible();
  const save = page.getByRole('button', { name: 'Guardar nueva versión' });
  await save.click();
  const summary = page.getByRole('group', { name: /Revisa (este campo|estos \d+ campos)/ });
  await expect(summary).toBeFocused();
  // The button fades back from its disabled look (opacity 0.5, CSS transition): scan the settled
  // page, not a frame of the animation (a disabled control is exempt from contrast anyway).
  await expect(save).toBeEnabled();
  await expect(save).toHaveCSS('opacity', '1');
  await scanState(page, '/app/settings/decision (fila nueva y errores)', found);

  // Calendar, week view: «Mover» open.
  await page.goto('/app/calendar?vista=semana');
  const mover = page.locator('summary', { hasText: 'Mover' }).first();
  if (await mover.count()) {
    await mover.click();
    await scanState(page, '/app/calendar (Mover abierto)', found);
  }
  console.log(found.join('\n') || 'Sin infracciones graves.');
  expect(found).toEqual([]);
});
