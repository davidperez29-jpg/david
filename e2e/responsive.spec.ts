import { expect, test } from '@playwright/test';
import { collectErrors, expectNoSeriousA11yIssues } from './helpers';

/**
 * Todas las pantallas en escritorio (1280 px) y móvil (Pixel 7): sin desplazamiento horizontal,
 * con su título y sin errores de consola. En móvil, además, análisis de accesibilidad.
 */
const ROUTES = [
  '/',
  '/entrenador',
  '/entrenador/clientes',
  '/entrenador/clientes/c-marta',
  '/entrenador/clientes/c-marta/objetivos',
  '/entrenador/clientes/c-marta/evaluaciones',
  '/entrenador/clientes/c-marta/resultados',
  '/entrenador/clientes/c-marta/planificacion',
  '/entrenador/clientes/c-marta/sesiones',
  '/entrenador/clientes/c-lucia/sesiones',
  '/entrenador/clientes/c-lucia/sesiones/nueva',
  '/entrenador/clientes/c-marta/registro',
  '/entrenador/clientes/c-marta/informes',
  '/entrenador/clientes/c-diego/salud',
  '/entrenador/clientes/c-marta/compartido',
  '/entrenador/evaluaciones',
  '/entrenador/analisis',
  '/entrenador/planificacion',
  '/entrenador/ejercicios',
  '/entrenador/ejercicios/ex-cmj',
  '/entrenador/carga',
  '/entrenador/readaptacion',
  '/entrenador/informes',
  '/entrenador/configuracion',
  '/cliente',
  '/cliente/semana',
  '/cliente/progreso',
];

for (const route of ROUTES) {
  test(`${route} se adapta al ancho de la pantalla`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, 'desplazamiento horizontal en píxeles').toBeLessThanOrEqual(1);
    if (testInfo.project.name === 'movil') await expectNoSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });
}

test('en móvil, los filtros de la biblioteca están plegados y se pueden abrir', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'movil', 'Solo aplica a pantallas estrechas');
  await page.goto('/entrenador/ejercicios');
  const filters = page.getByRole('complementary', { name: 'Filtros' });
  await expect(filters).toBeHidden();
  await expect(page.getByRole('link', { name: /Sentadilla trasera con barra/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar filtros' }).click();
  await expect(filters).toBeVisible();
  await filters.getByRole('button', { name: 'Potencia', exact: true }).click();
  await expect(page.getByRole('button', { name: /Ocultar filtros/ })).toContainText('1');
});

test('en móvil, el menú del entrenador abre las secciones', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'movil', 'Solo aplica a pantallas estrechas');
  await page.goto('/entrenador');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('link', { name: 'Biblioteca de ejercicios' })
    .click();
  await expect(page).toHaveURL(/\/entrenador\/ejercicios$/);
});

/**
 * Bloque 2: pantallas cuya dirección depende de la semilla (ids de sesión). Solo se leen: el
 * reproductor empezado, que escribe, se prueba a 360 px en `client-execution.spec.ts` (B2-UI).
 */
test('B2 · detalle de la sesión, inicio del reproductor y comparación del entrenador se adaptan', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  const fits = async (label: string) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `desplazamiento horizontal en ${label}`).toBeLessThanOrEqual(1);
    if (testInfo.project.name === 'movil') await expectNoSeriousA11yIssues(page);
  };

  await page.goto('/cliente');
  const player = await page
    .getByRole('link', { name: /Empezar entrenamiento/ })
    .getAttribute('href');
  expect(player).toMatch(/^\/cliente\/sesion\/[^/]+\/entrenar$/);
  await page.goto(player!.replace(/\/entrenar$/, ''));
  await fits('el detalle de la sesión (B2)');
  await page.goto(player!);
  // La semilla es igual cualquier día (A-13): Marta tiene una sesión a medias de hace 3 días, así
  // que el inicio avisa (P-21) y ofrece «Empezar igualmente».
  await expect(page.getByText(/a medias\. Podrás continuarla después/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar igualmente' })).toBeVisible();
  await fits('el inicio del reproductor');

  // A7 de una sesión de Marta ya registrada: prescrito frente a realizado.
  await page.goto('/entrenador/clientes/c-marta/sesiones');
  const hrefs = await page
    .locator('a[href^="/entrenador/clientes/c-marta/sesiones/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!));
  let reviewed = false;
  for (const href of hrefs.filter((h) => !h.endsWith('/nueva')).slice(0, 12)) {
    await page.goto(href);
    if (await page.getByRole('heading', { name: /prescrito frente a realizado/ }).count()) {
      reviewed = true;
      break;
    }
  }
  expect(reviewed, 'una sesión sembrada con ejecución').toBe(true);
  await fits('la comparación del entrenador (A7)');
  expect(errors).toEqual([]);
});
