import { expect, test } from '@playwright/test';
import { a11yIds, CLIENT_TABS, scan, scanState } from './a11y-helpers';
import { login } from './helpers';

/** WCAG 2.2 AA on every trainer page (desktop), light and dark. See a11y-helpers.ts. */
test('trainer pages meet WCAG 2.2 AA (axe, light and dark)', async ({ page }) => {
  test.setTimeout(600_000);
  const i = await a11yIds();
  const found: string[] = [];
  for (const url of ['/login', '/forgot-password', '/reset-password?token=caducado'])
    await scan(page, url, found);
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
    '/app/library/revision',
    '/app/library/revision?gap=missing_level',
    '/app/library/revision/videos',
    `/app/library/${i.bankExercise}?revision=gap%3Dpending_review`,
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

  // Bank review (phase 21): a row selected with «Valor», the archive confirmation, and a result
  // with the skipped exercises listed (publishing drafts that are not complete).
  await page.goto('/app/library/revision');
  await page
    .getByRole('checkbox', { name: /^Seleccionar «/ })
    .first()
    .check();
  await page.getByLabel('Cambio').selectOption('set_level');
  await scanState(page, '/app/library/revision (selección y valor)', found);
  await page.getByLabel('Cambio').selectOption('archive');
  await page.getByRole('button', { name: 'Aplicar a 1 ejercicio' }).click();
  await expect(page.getByRole('button', { name: 'Sí, archivar' })).toBeFocused();
  await scanState(page, '/app/library/revision (confirmar archivo)', found);
  await page.keyboard.press('Escape');
  await page.getByLabel('Cambio').selectOption('publish');
  await page.getByRole('button', { name: 'Aplicar a 1 ejercicio' }).click();
  await expect(page.getByText(/0 cambiados · 0 ya estaban así · 1 sin cambiar/)).toBeVisible();
  await scanState(page, '/app/library/revision (resultado con omitidos)', found);

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

/** WCAG 1.4.10 Reflow (phase 21): at 320 CSS px only tables scroll sideways, never the page. */
test('trainer pages reflow at 320 px without horizontal scrolling', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, 'lucia.moreno@example.com');
  await page.setViewportSize({ width: 320, height: 800 });
  const wide: string[] = [];
  for (const url of [
    '/app',
    '/app/clients',
    '/app/alerts',
    '/app/calendar',
    '/app/plans',
    '/app/informes',
    '/app/groups',
    '/app/library',
    '/app/library/revision',
    '/app/library/revision/videos',
    '/app/assessments',
    '/app/science',
    '/app/science/sources',
    '/app/science/claims',
    '/app/admin/users',
    '/app/admin/privacidad',
    '/app/settings',
    '/app/settings/alertas',
    '/app/settings/decision',
  ]) {
    await page.goto(url);
    const extra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (extra > 0) wide.push(`${url}: ${extra} px`);
  }
  expect(wide).toEqual([]);
});
