import { expect, test } from '@playwright/test';
import { collectErrors, expectNoSeriousA11yIssues } from './helpers';

const TRAINER_PAGES = [
  ['/entrenador', 'Hola, Alex'],
  ['/entrenador/clientes', 'Clientes'],
  ['/entrenador/evaluaciones', 'Evaluaciones'],
  ['/entrenador/analisis', 'Análisis de resultados'],
  ['/entrenador/planificacion', 'Planificación'],
  ['/entrenador/ejercicios', 'Biblioteca de ejercicios'],
  ['/entrenador/ejercicios/ex-pause-squat', 'Sentadilla con pausa'],
  ['/entrenador/ejercicios/ex-band-row', 'Remo con banda en casa'],
  ['/entrenador/carga', 'Carga y volumen'],
  ['/entrenador/readaptacion', 'Readaptación'],
  ['/entrenador/informes', 'Informes'],
  ['/entrenador/configuracion', 'Configuración'],
] as const;

const CLIENT_TABS = [
  ['', 'Información', 'Información del cliente'],
  ['/objetivos', 'Objetivos', 'Mejorar el salto vertical'],
  ['/evaluaciones', 'Evaluaciones', 'Historial de evaluaciones'],
  ['/resultados', 'Resultados', 'Evolución de las evaluaciones'],
  ['/planificacion', 'Planificación', 'Próxima sesión'],
  ['/sesiones', 'Sesiones', 'Sesiones anteriores'],
  ['/registro', 'Registro', 'Registro de entrenamiento'],
  ['/informes', 'Informes', 'Sin informes todavía'],
  ['/salud', 'Salud', 'Salud y readaptación'],
  ['/compartido', 'Compartido', 'Lo que ve el cliente'],
] as const;

test.describe('área del entrenador', () => {
  for (const [path, heading] of TRAINER_PAGES) {
    test(`${path} carga sin errores y es accesible`, async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
      // Bloque 1 (B0): el aviso dice «Modo demostración» y como quién se ve la app.
      await expect(page.getByRole('note')).toContainText('Modo demostración');
      await expect(page.getByRole('note')).toContainText('Estás viendo la app como Alex');
      await expectNoSeriousA11yIssues(page);
      expect(errors).toEqual([]);
    });
  }

  test('la ficha del cliente se navega con pestañas horizontales accesibles', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/entrenador/clientes/c-marta');
    const tabs = page.getByRole('navigation', { name: 'Pestañas de la ficha' });
    for (const [suffix, label, content] of CLIENT_TABS) {
      await tabs.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/entrenador/clientes/c-marta${suffix}$`));
      await expect(tabs.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marta Ríos');
      await expect(page.getByText(content).first()).toBeVisible();
    }
    await expectNoSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });

  test('las pestañas con datos son accesibles (axe)', async ({ page }) => {
    for (const suffix of ['/objetivos', '/registro', '/salud', '/planificacion']) {
      await page.goto(`/entrenador/clientes/c-diego${suffix}`);
      await expectNoSeriousA11yIssues(page);
    }
  });

  test('el registro muestra lo que hizo el cliente, su valoración y sus observaciones', async ({
    page,
  }) => {
    await page.goto('/entrenador/clientes/c-marta/registro');
    const first = page.locator('details').first();
    await first.locator('summary').click();
    await expect(first.getByRole('table')).toBeVisible();
    await expect(first.getByRole('columnheader', { name: 'Valoración' })).toBeVisible();
  });

  test('la navegación lateral lleva a cada sección y marca la actual', async ({ page }) => {
    await page.goto('/entrenador');
    const nav = page.getByRole('navigation', { name: 'Secciones' });
    await nav.getByRole('link', { name: 'Análisis de resultados' }).click();
    await expect(page).toHaveURL(/\/entrenador\/analisis$/);
    await expect(nav.getByRole('link', { name: 'Análisis de resultados' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('la búsqueda de clientes filtra sin distinguir tildes', async ({ page }) => {
    await page.goto('/entrenador/clientes');
    await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill('rios');
    const cards = page.getByRole('main').getByRole('listitem');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Marta Ríos');
  });

  test('biblioteca: filtros combinables en modo Y/O, con chips que se pueden quitar', async ({
    page,
  }) => {
    await page.goto('/entrenador/ejercicios');
    const filters = page.getByRole('complementary', { name: 'Filtros' });
    const count = page.getByText(/^\d+ ejercicios?$/);
    await expect(count).toHaveText('44 ejercicios');

    // Ejemplo: Potencia Y Pliometría Y Salto vertical → drop jump y saltos verticales continuos.
    await filters.getByRole('button', { name: 'Potencia', exact: true }).click();
    await filters.getByRole('button', { name: 'Pliometría', exact: true }).click();
    await filters
      .getByRole('group', { name: 'Saltos' })
      .getByRole('button', { name: 'Vertical', exact: true })
      .click();
    await expect(count).toHaveText('2 ejercicios');
    await expect(page.getByRole('link', { name: /Drop jump/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Saltos verticales continuos/ })).toBeVisible();
    await expect(page.getByLabel('Filtros activos')).toContainText('Cumple todos:');
    await page.getByRole('button', { name: 'Quitar todos' }).click();
    await expect(count).toHaveText('44 ejercicios');

    // Ejemplo: Fuerza máxima Y Dominante de rodilla → sentadillas trasera y frontal.
    await filters.getByRole('button', { name: 'Fuerza máxima', exact: true }).click();
    await filters.getByRole('button', { name: 'Dominante de rodilla', exact: true }).click();
    await expect(count).toHaveText('2 ejercicios');
    await page.getByRole('button', { name: 'Quitar todos' }).click();

    // Potencia Y Dominante de rodilla → solo la sentadilla con intención máxima de velocidad.
    await filters.getByRole('button', { name: 'Potencia', exact: true }).click();
    await filters.getByRole('button', { name: 'Dominante de rodilla', exact: true }).click();
    await expect(count).toHaveText('1 ejercicio');
    await expect(
      page.getByRole('link', { name: /Sentadilla con intención máxima de velocidad/ }),
    ).toBeVisible();

    // Modo O: cumple al menos uno de los dos filtros.
    await filters.getByText('Alguno (O)').click();
    await expect(count).not.toHaveText('1 ejercicio');

    // Quitar los filtros desde los chips activos.
    await page.getByRole('button', { name: 'Quitar todos' }).click();
    await filters.getByText('Todos (Y)').click();
    await filters.getByRole('button', { name: 'Isométrico', exact: true }).click();
    await filters.getByRole('button', { name: 'Core', exact: true }).click();
    await expect(count).toHaveText('2 ejercicios');
    await page.getByRole('button', { name: 'Quitar filtro Core' }).click();
    await expect(page.getByRole('button', { name: 'Quitar filtro Core' })).toHaveCount(0);

    // Un grupo de patrones incluye sus subtipos y se combina con la ejecución.
    await page.getByRole('button', { name: 'Quitar todos' }).click();
    await filters.getByRole('button', { name: 'Todo: Tracción', exact: true }).click();
    await filters.getByText('Ejecución', { exact: true }).click(); // grupo plegado por defecto
    await filters.getByRole('button', { name: 'Unilateral', exact: true }).click();
    await expect(count).toHaveText('1 ejercicio');
    await expect(page.getByRole('link', { name: /Remo con mancuerna a una mano/ })).toBeVisible();
  });

  test('la búsqueda por palabras combina datos distintos («salto unilateral»)', async ({
    page,
  }) => {
    await page.goto('/entrenador/ejercicios');
    await page.getByRole('searchbox', { name: 'Buscar ejercicios' }).fill('salto unilateral');
    await expect(page.getByRole('link', { name: /Salto vertical a una pierna/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Salto horizontal a pies juntos/ })).toHaveCount(0);
  });

  test('una copia personalizada indica su original, que no cambia', async ({ page }) => {
    await page.goto('/entrenador/ejercicios/ex-split-squat-pause');
    await expect(page.getByText('Copia personalizada', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Sentadilla búlgara', exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sentadilla búlgara');
    await expect(page.getByText('Ejercicio del catálogo global')).toBeVisible();
  });

  test('la ficha de ejercicio muestra clasificación, variantes y progresiones', async ({
    page,
  }) => {
    await page.goto('/entrenador/ejercicios/ex-goblet-squat');
    await expect(page.getByText('Variante de Sentadilla').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Sentadilla trasera con barra' }).first(),
    ).toBeVisible();
    await expect(page.getByText('Dominante de rodilla')).toBeVisible();
    await page.getByRole('link', { name: 'Sentadilla trasera con barra' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Sentadilla trasera con barra',
    );
    await expect(page.getByText('Con Marta: profundidad hasta paralelo')).toBeVisible();
  });

  test('el selector de métrica cambia todos los gráficos de carga', async ({ page }) => {
    await page.goto('/entrenador/carga');
    await page.getByText('Tonelaje', { exact: true }).first().click();
    await expect(page.getByText('Cálculo · training.volume-load v1.0.0')).toBeVisible();
  });

  test('un cliente o un ejercicio inexistente devuelven 404', async ({ page }) => {
    expect((await page.goto('/entrenador/clientes/no-existe'))?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('No hemos encontrado');
    expect((await page.goto('/entrenador/clientes/no-existe/registro'))?.status()).toBe(404);
    expect((await page.goto('/entrenador/ejercicios/no-existe'))?.status()).toBe(404);
  });
});
