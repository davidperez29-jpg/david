import { expect, test } from '@playwright/test';
import { collectErrors, expectNoSeriousA11yIssues, mondayOf, todayInMadrid } from './helpers';

test.describe('app del cliente (móvil)', () => {
  test('la pantalla principal da protagonismo a la sesión de hoy', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/cliente');
    const hero = page.getByRole('region', { name: /Fuerza · tren inferior/ });
    await expect(hero).toContainText('Hoy toca');
    const start = page.getByRole('link', { name: /Empezar sesión/ });
    await expect(start).toBeInViewport(); // visible sin hacer scroll
    // El progreso no ocupa la pantalla principal: vive en su propia pestaña.
    await expect(page.getByRole('heading', { name: 'Mi progreso' })).toHaveCount(0);
    await expectNoSeriousA11yIssues(page);
    expect(errors).toEqual([]);
  });

  test('registrar una sesión con pocas acciones', async ({ page }) => {
    await page.goto('/cliente');
    await page.getByRole('link', { name: /Empezar sesión/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fuerza · tren inferior');
    await expect(page.getByText('0 de 16 series')).toBeVisible();

    // Un toque por serie: los valores prescritos vienen ya rellenos.
    await page
      .getByRole('button', { name: 'Marcar como hecha la serie 1 de Sentadilla trasera con barra' })
      .click();
    await expect(page.getByText('1 de 16 series')).toBeVisible();
    await expect(page.getByRole('timer')).toContainText('Descanso');
    await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.getByRole('timer')).toHaveCount(0);

    // Una entrada no válida no se da por buena.
    const reps = page.getByLabel('Repeticiones, serie 2 de Sentadilla trasera con barra');
    await reps.fill('ocho');
    await page
      .getByRole('button', { name: 'Marcar como hecha la serie 2 de Sentadilla trasera con barra' })
      .click();
    // (Next.js añade su propio role="alert" para anunciar cambios de ruta: filtramos por texto.)
    await expect(
      page.getByRole('alert').filter({ hasText: 'Escribe las repeticiones' }),
    ).toBeVisible();
    await expect(page.getByText('1 de 16 series')).toBeVisible();
    await reps.fill('8');
    await page
      .getByRole('button', { name: 'Marcar como hecha la serie 2 de Sentadilla trasera con barra' })
      .click();
    await expect(page.getByText('2 de 16 series')).toBeVisible();

    // RIR real del ejercicio (prescrito con RIR) y un toque para completar el resto de series.
    await page
      .getByRole('group', { name: /Repeticiones en reserva de Sentadilla trasera/ })
      .getByText('2', { exact: true })
      .click();
    await expect(page.getByRole('radio', { name: '2' }).first()).toBeChecked();
    await page.getByRole('button', { name: 'Marcar todas como hechas' }).first().click();
    await expect(page.getByText('4 de 16 series')).toBeVisible();

    // Mientras se entrena, la sesión está «En curso».
    await expect(page.getByText('En curso').first()).toBeVisible();

    // Terminar con series pendientes pide confirmación y no la da por completada.
    await page.getByRole('button', { name: 'Terminar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Te faltan 12 series' })).toBeVisible();
    await page.getByRole('button', { name: 'Seguir entrenando' }).click();
    await page.getByRole('button', { name: 'Terminar sesión' }).click();
    await page.getByRole('button', { name: 'Terminar igualmente' }).click();

    await expect(
      page.getByRole('heading', { name: 'Sesión terminada parcialmente' }),
    ).toBeVisible();
    await expect(page.getByText('Parcial o interrumpida').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '¡Sesión completada!' })).toHaveCount(0);
    await expect(
      page.getByText('Has completado 4 de 16 series y 1 de 5 ejercicios.'),
    ).toBeVisible();
    await expect(page.getByText('4/4 series')).toBeVisible();
    await expect(page.getByText('0/3 series').first()).toBeVisible();
    const notes = page.getByLabel('Observaciones para tu entrenador');
    await notes.fill('La última serie me ha costado.');
    await expect(page.getByText('30/500')).toBeVisible();
    // 6 + 8 + 6 + 6 repeticiones (las series sin editar usan el mínimo del rango prescrito: 6).
    await expect(page.locator('dl dd').nth(1)).toHaveText('26');
    await expectNoSeriousA11yIssues(page);
  });

  test('solo se da por completada si están hechas todas las series', async ({ page }) => {
    await page.goto('/cliente');
    await page.getByRole('link', { name: /Empezar sesión/ }).click();
    await expect(page.getByText('Pendiente').first()).toBeVisible();
    const completeAll = page.getByRole('button', { name: 'Marcar todas como hechas' });
    while ((await completeAll.count()) > 0) await completeAll.first().click();
    await expect(page.getByText('16 de 16 series')).toBeVisible();
    await page.getByRole('button', { name: 'Terminar sesión' }).click(); // sin confirmación: no falta nada
    await expect(page.getByRole('heading', { name: '¡Sesión completada!' })).toBeVisible();
    await expect(
      page.getByText('Has completado 16 de 16 series y 5 de 5 ejercicios.'),
    ).toBeVisible();
  });

  test('el cliente no puede abrir la sesión de otro cliente', async ({ page }) => {
    const today = todayInMadrid();
    const own = await page.goto(`/cliente/sesion/s-marta-${today}`);
    expect(own?.status()).toBe(200);
    // Diego (otro cliente) entrena los lunes: su sesión de esta semana existe, pero no es de Marta.
    const foreign = await page.goto(`/cliente/sesion/s-diego-${mondayOf(today)}`);
    expect(foreign?.status()).toBe(404);
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
