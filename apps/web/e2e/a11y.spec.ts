import { expect, test } from '@playwright/test';
import { a11yIds, CLIENT_TABS, scan } from './a11y-helpers';
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
