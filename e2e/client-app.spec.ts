import { expect, test } from '@playwright/test';
import { enterAs, joinSpace, logVisibleSet, startTraining, test as spaceTest } from './fixtures';
import { collectErrors, expectNoSeriousA11yIssues, mondayOf, todayInMadrid } from './helpers';

test.describe('app del cliente (móvil)', () => {
  test('la pantalla principal da protagonismo a la sesión de hoy', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/cliente');
    const hero = page.getByRole('region', { name: /Fuerza · tren inferior/ });
    await expect(hero).toContainText('Hoy toca');
    // Bloque 1: «Empezar sesión» pasa a «Empezar entrenamiento» (V1_SPEC §3 B1).
    const start = page.getByRole('link', { name: /Empezar entrenamiento/ });
    await expect(start).toBeInViewport(); // visible sin hacer scroll
    // El progreso no ocupa la pantalla principal: vive en su propia pestaña.
    await expect(page.getByRole('heading', { name: 'Mi progreso' })).toHaveCount(0);
    await expectNoSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });

  // Bloque 2: el reproductor por pasos sustituye al de la Fase 1 y ahora GUARDA en el servidor;
  // por eso estas dos pruebas trabajan en su propio espacio de datos (fixtures.ts).
  spaceTest('registrar una sesión con pocas acciones', async ({ page, space }) => {
    expect(space).toBeTruthy();
    await enterAs(page, 'Marta, clienta');
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await expect(page).toHaveURL(/\/entrenar$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fuerza · tren inferior');
    await startTraining(page);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sentadilla trasera con barra' }),
    ).toBeVisible();
    await expect(page.getByText('0 de 16 series')).toBeVisible();

    // Un toque por serie: los valores prescritos vienen ya rellenos.
    await logVisibleSet(page);
    await expect(page.getByText('1 de 16 series')).toBeVisible();

    // Una entrada no válida no se da por buena: el error aparece junto al campo.
    await page.getByLabel(/^Repeticiones$/).fill('ocho');
    await page.getByRole('button', { name: 'Serie hecha' }).click();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Las repeticiones deben ser un entero de 1 a 100.' }),
    ).toBeVisible();
    await expect(page.getByText('1 de 16 series')).toBeVisible();
    await page.getByLabel(/^Repeticiones$/).fill('8');
    await logVisibleSet(page);
    await expect(page.getByText('2 de 16 series')).toBeVisible();

    // Terminar con series pendientes pide elegir y no la da por completada.
    await page.getByRole('button', { name: /tu sesión/i }).click();
    await page
      .getByRole('dialog', { name: 'Tu sesión' })
      .getByRole('button', { name: 'Terminar sesión' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Te quedan 14 series sin registrar' });
    await dialog.getByRole('button', { name: 'Seguir entrenando' }).click();
    await page.getByRole('button', { name: /tu sesión/i }).click();
    await page
      .getByRole('dialog', { name: 'Tu sesión' })
      .getByRole('button', { name: 'Terminar sesión' })
      .click();
    await dialog.getByRole('button', { name: 'Terminar igualmente (cierre parcial)' }).click();
    await expect(
      page.getByRole('heading', { name: 'Sesión terminada parcialmente' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '¡Sesión completada!' })).toHaveCount(0);
    await expect(page.getByText('2 de 16 series hechas · 14 sin registrar')).toBeVisible();
    await expectNoSeriousA11yIssues(page);
  });

  spaceTest(
    'solo se da por completada si están hechas todas las series',
    async ({ page, space }) => {
      spaceTest.setTimeout(90_000);
      expect(space).toBeTruthy();
      await enterAs(page, 'Marta, clienta');
      await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
      await startTraining(page);
      for (let set = 1; set <= 16; set += 1) await logVisibleSet(page);
      const finish = page.getByRole('dialog', { name: 'Terminar la sesión' });
      await finish.getByRole('button', { name: 'Terminar sesión' }).click();
      await expect(page.getByRole('heading', { name: '¡Sesión completada!' })).toBeVisible();
      await expect(page.getByText('16 de 16 series hechas')).toBeVisible();
    },
  );

  spaceTest(
    'se registra lo que pide cada ejercicio: segundos, metros con tiempo opcional y carga descrita',
    async ({ page, browser, space, baseURL }) => {
      // 1) Plancha lateral (30 s, peso corporal) de la sesión de hoy: segundos y ningún kg.
      await enterAs(page, 'Marta, clienta');
      await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
      await startTraining(page);
      await page.getByRole('button', { name: /tu sesión/i }).click();
      await page
        .getByRole('dialog', { name: 'Tu sesión' })
        .getByRole('button', { name: /Plancha lateral/ })
        .click();
      await expect(page.getByRole('heading', { level: 1, name: 'Plancha lateral' })).toBeVisible();
      await expect(page.getByLabel(/^Segundos$/)).toHaveValue('30');
      await expect(page.getByLabel(/^Repeticiones$/)).toHaveCount(0);
      await expect(page.getByLabel(/^Carga$/)).toHaveCount(0);
      await expect(page.getByText('Con tu peso corporal')).toBeVisible();
      await page.getByLabel(/^Segundos$/).fill('35');
      await logVisibleSet(page);
      await expect(page.getByText(/Hecho:\s*35 s/)).toBeVisible();
      await expect(page.getByText('Confirmada')).toHaveCount(1);

      // 2) Paseo del granjero (30 m, «2 × 16 kg») de una sesión próxima: metros, tiempo
      //    opcional y la carga como descripción, sin kg.
      const trainer = await browser.newContext({ baseURL });
      await joinSpace(trainer, space, baseURL!);
      const alex = await trainer.newPage();
      await enterAs(alex, 'Alex, entrenador');
      await alex.goto('/entrenador/clientes/c-marta/sesiones');
      const href = await alex
        .locator('li li')
        .filter({ hasText: 'Fuerza · tren superior y core' })
        .filter({ hasText: 'Programada' })
        .first()
        .locator('a[href*="/sesiones/"]')
        .first()
        .getAttribute('href');
      await trainer.close();
      const sessionId = href!.split('/').filter(Boolean).at(-1)!;
      await page.goto(`/cliente/sesion/${sessionId}/entrenar`);
      await startTraining(page);
      await page.getByRole('button', { name: /tu sesión/i }).click();
      await page
        .getByRole('dialog', { name: 'Tu sesión' })
        .getByRole('button', { name: /Paseo del granjero/ })
        .click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Paseo del granjero' }),
      ).toBeVisible();
      await expect(page.getByLabel(/^Metros$/)).toHaveValue('30');
      await expect(page.getByLabel(/^Carga: menos/)).toHaveCount(0);
      await expect(page.getByPlaceholder('Banda verde, nivel 3…')).toBeVisible();
      await page.getByLabel('Tiempo (opcional)', { exact: true }).fill('40');
      await logVisibleSet(page);
      await expect(page.getByText(/Hecho:\s*30 m en 40 s/)).toBeVisible();
      await expect(page.getByText('Confirmada')).toHaveCount(1);
    },
  );

  test('el cliente no puede abrir la sesión de otro cliente', async ({ page }) => {
    const today = todayInMadrid();
    const own = await page.goto(`/cliente/sesion/s-marta-${today}`);
    expect(own?.status()).toBe(200);
    // Diego (otro cliente) entrena los lunes: su sesión de esta semana existe, pero no es de Marta.
    const foreign = await page.goto(`/cliente/sesion/s-diego-${mondayOf(today)}`);
    expect(foreign?.status()).toBe(404);
    // Tampoco su reproductor (bloque 1: ruta nueva).
    const foreignPlayer = await page.goto(`/cliente/sesion/s-diego-${mondayOf(today)}/entrenar`);
    expect(foreignPlayer?.status()).toBe(404);
  });

  test('semana y progreso son secciones secundarias navegables', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/cliente');
    const nav = page.getByRole('navigation', { name: 'Secciones' });
    await nav.getByRole('link', { name: 'Semana' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi semana');
    await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(7);
    await expectNoSeriousA11yIssues(page);

    await nav.getByRole('link', { name: 'Progreso' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi progreso');
    await expect(page.getByRole('heading', { name: 'Volumen semanal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mis evaluaciones' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });
});
