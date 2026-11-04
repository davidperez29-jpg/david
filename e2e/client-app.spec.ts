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

    await page.getByRole('button', { name: 'Terminar sesión' }).click();
    await expect(page.getByRole('heading', { name: '¡Sesión terminada!' })).toBeVisible();
    await expect(page.getByText('Has completado 2 de 16 series.')).toBeVisible();
    // 6 + 8 repeticiones (la primera serie usa el mínimo del rango prescrito: 6).
    await expect(page.locator('dd').nth(1)).toHaveText('14');
    await expectNoSeriousA11yIssues(page);
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
