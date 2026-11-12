import { collectErrors, expectNoSeriousA11yIssues, todayInMadrid } from './helpers';
import { createSessionForLucia, enterAs, expect, test } from './fixtures';

/**
 * Bloque 1 · Lucía ve en el móvil (Pixel 7) lo que Alex publica, y nada más.
 * Alex publica desde la misma interfaz, en el mismo espacio de datos.
 */
test.describe('Hoy y detalle del cliente (bloque 1)', () => {
  test('publicar → aparece en Hoy: protagonista «Mañana» y «Tarde» en «También hoy»', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    const errors = collectErrors(page);
    const today = todayInMadrid();
    await enterAs(page, 'Alex, entrenador');
    await createSessionForLucia(page, { date: today, label: 'Mañana', title: 'Fuerza · pierna' });
    await createSessionForLucia(page, {
      date: today,
      label: 'Tarde',
      title: 'Movilidad',
      exercise: 'Peso muerto rumano',
    });
    const draft = await createSessionForLucia(page, {
      date: today,
      label: 'Club',
      title: 'Sin publicar',
      publish: false,
    });

    await enterAs(page, 'Lucía, clienta');
    await expect(page.getByRole('note')).toContainText('Estás viendo la app como Lucía');
    const hero = page.getByRole('region', { name: 'Fuerza · pierna' });
    await expect(hero).toContainText('Hoy · Mañana');
    await expect(hero.getByRole('link', { name: /Empezar entrenamiento/ })).toBeInViewport();
    const alsoToday = page.getByRole('region', { name: 'También hoy' });
    await expect(alsoToday).toContainText('Tarde · Movilidad');
    // El borrador no lo ve.
    await expect(page.getByText('Sin publicar')).toHaveCount(0);
    await expectNoSeriousA11yIssues(page);

    // B2 · detalle de la sesión, con la prescripción y sin notas privadas.
    await hero.getByRole('link', { name: 'Ver el detalle de la sesión' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Fuerza · pierna' })).toBeVisible();
    await expect(page.getByText('3 × 10')).toBeVisible();
    await expect(page.getByText('16 kg')).toBeVisible();
    await expect(page.getByText('RIR 2')).toBeVisible();
    await expectNoSeriousA11yIssues(page);

    // Bloque 2: el reproductor ya guarda en el servidor; se abre en su pantalla de inicio, sin
    // empezar nada hasta que ella lo pide (y sin el aviso de la Fase 1).
    await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
    await expect(page).toHaveURL(/\/entrenar$/);
    await expect(page.getByRole('button', { name: 'Empezar entrenamiento' })).toBeVisible();
    await expect(page.getByText('Lo que marques aquí todavía no se guarda')).toHaveCount(0);

    expect(errors).toEqual([]);

    // Un borrador no existe para ella (404, sin revelar nada).
    const draftId = draft.split('/').at(-2)!;
    expect((await page.goto(`/cliente/sesion/${draftId}`))?.status()).toBe(404);
  });

  test('B1-04 · Lucía no ve las sesiones de Marta, ni Marta las de Lucía', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    const today = todayInMadrid();
    await enterAs(page, 'Alex, entrenador');
    const published = await createSessionForLucia(page, {
      date: today,
      label: 'Mañana',
      title: 'Solo de Lucía',
    });
    const luciaSession = published.split('/').at(-1)!;

    await enterAs(page, 'Lucía, clienta');
    await expect(page.getByText('Fuerza · tren inferior')).toHaveCount(0);
    expect((await page.goto(`/cliente/sesion/s-marta-${today}`))?.status()).toBe(404);
    expect((await page.goto(`/cliente/sesion/s-marta-${today}/entrenar`))?.status()).toBe(404);

    await enterAs(page, 'Marta, clienta');
    await expect(page.getByRole('region', { name: 'Fuerza · tren inferior' })).toBeVisible();
    await expect(page.getByText('Solo de Lucía')).toHaveCount(0);
    expect((await page.goto(`/cliente/sesion/${luciaSession}`))?.status()).toBe(404);
  });

  test('B1-12 · Hoy y el detalle caben en 360 px sin desbordar', async ({ page, space }) => {
    expect(space).toBeTruthy();
    await page.setViewportSize({ width: 360, height: 740 });
    await enterAs(page, 'Marta, clienta');
    for (const url of ['/cliente', `/cliente/sesion/s-marta-${todayInMadrid()}`]) {
      await page.goto(url);
      await expectNoSeriousA11yIssues(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, url).toBeLessThanOrEqual(0);
    }
  });
});
