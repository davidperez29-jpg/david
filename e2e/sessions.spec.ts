import { collectErrors, expectNoSeriousA11yIssues, todayInMadrid } from './helpers';
import { addDays, createSessionForLucia, enterAs, expect, test, joinSpace } from './fixtures';

/**
 * Bloque 1 · el entrenador crea y publica sesiones (A3–A7) sobre SQLite.
 * Cada prueba usa su propio espacio de datos.
 */
test.describe('sesiones del entrenador (bloque 1)', () => {
  test('B1-03 · dos sesiones el mismo día y otra para otro día, con su orden; se publican y se borra un borrador', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    const errors = collectErrors(page);
    page.on('dialog', (dialog) => dialog.accept());
    const today = todayInMadrid();
    await enterAs(page, 'Alex, entrenador');

    await page.goto('/entrenador/clientes/c-lucia/sesiones');
    await expect(page.getByText('Todavía no hay sesiones para Lucía')).toBeVisible();

    await createSessionForLucia(page, { date: today, label: 'Mañana', title: 'Fuerza · pierna' });
    await expect(page.getByRole('heading', { level: 2, name: 'Fuerza · pierna' })).toBeVisible();
    await expect(page.getByText(/Versión vigente 1 · Alex Navarro/)).toBeVisible();
    await expect(page.getByText('16 kg').first()).toBeVisible();

    await createSessionForLucia(page, {
      date: today,
      label: 'Tarde',
      title: 'Movilidad',
      exercise: 'Peso muerto rumano',
    });
    await createSessionForLucia(page, {
      date: addDays(today, 2),
      label: 'Club',
      title: 'Otro día',
      publish: false,
    });
    await createSessionForLucia(page, {
      date: addDays(today, 2),
      label: 'Recuperación',
      title: 'Para borrar',
      publish: false,
    });

    await page.goto('/entrenador/clientes/c-lucia/sesiones');
    const todayGroup = page.getByRole('listitem').filter({
      has: page.locator(`#dia-${today}`),
    });
    await expect(todayGroup.getByText('2 sesiones')).toBeVisible();
    const rows = todayGroup.getByRole('listitem');
    await expect(rows.nth(0)).toContainText('1.Mañana · Fuerza · pierna');
    await expect(rows.nth(1)).toContainText('2.Tarde · Movilidad');
    await expect(rows.nth(0)).toContainText('Publicada v1');

    // Los borradores del otro día se reordenan y uno se elimina (nunca se publicó).
    const otherDay = page.getByRole('listitem').filter({
      has: page.locator(`#dia-${addDays(today, 2)}`),
    });
    await page
      .getByRole('button', { name: 'Subir «Recuperación · Para borrar» en el día' })
      .click();
    await expect(otherDay.getByRole('listitem').nth(0)).toContainText('Recuperación');
    await page
      .getByRole('button', { name: 'Eliminar el borrador «Recuperación · Para borrar»' })
      .click();
    await expect(page.getByText('Para borrar')).toHaveCount(0);
    await expect(otherDay.getByText('1 sesión')).toBeVisible();
    await expect(otherDay).toContainText('Borrador');

    // B1-02 · persiste al recargar y al cerrar y abrir el navegador (contexto nuevo).
    await page.reload();
    await expect(page.getByText('Movilidad')).toBeVisible();
    const fresh = await page.context().browser()!.newContext();
    await joinSpace(fresh, space, test.info().project.use.baseURL!);
    const again = await fresh.newPage();
    await again.goto('/entrenador/clientes/c-lucia/sesiones');
    await expect(again.getByText('Fuerza · pierna')).toBeVisible();
    await expect(again.getByText('Otro día')).toBeVisible();
    await fresh.close();

    expect(errors).toEqual([]);
  });

  test('B1-07 · reenviar «Crear borrador» no duplica, y una revisión antigua no pisa la nueva', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    await enterAs(page, 'Alex, entrenador');
    await page.goto(`/entrenador/clientes/c-lucia/sesiones/nueva`);
    await page.getByLabel('Título').fill('Reenviada');
    // Dos envíos del mismo formulario (mismo identificador emitido al mostrarlo).
    await page.locator('form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.waitForURL(/\/editar$/);
    await page.goto('/entrenador/clientes/c-lucia/sesiones');
    await expect(page.getByText('Reenviada')).toHaveCount(1);

    // Dos pestañas sobre el mismo borrador: la segunda no pisa lo que guardó la primera.
    await page.getByRole('link', { name: 'Editar «Reenviada»' }).click();
    await page.waitForURL(/\/editar$/);
    const builder = page.url();
    const other = await page.context().newPage();
    await other.goto(builder);
    await page.getByLabel('Título').fill('Desde la pestaña 1');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(/^Borrador guardado/)).toBeVisible();
    await other.getByLabel('Título').fill('Desde la pestaña 2');
    await other.getByRole('button', { name: 'Guardar' }).click();
    await expect(other.getByText('Hay una versión más reciente de este borrador')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Título')).toHaveValue('Desde la pestaña 1');
  });

  test('las validaciones aparecen junto al campo y no se publica una sesión incompleta', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    await enterAs(page, 'Alex, entrenador');
    await page.goto('/entrenador/clientes/c-lucia/sesiones/nueva');
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await expect(page.getByText(/El título es obligatorio/)).toBeVisible();
    await expect(page.getByLabel('Título')).toBeFocused();
    await page.getByLabel('Título').fill('Incompleta');
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await page.waitForURL(/\/editar$/);
    await expect(page.getByText('Añade al menos un ejercicio.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publicar versión 1' })).toBeDisabled();
  });

  test('Configuración: la copia de seguridad queda en la lista', async ({ page, space }) => {
    expect(space).toBeTruthy();
    await enterAs(page, 'Alex, entrenador');
    await page.goto('/entrenador/configuracion');
    await expect(page.getByText(/espacios/)).toBeVisible();
    await page.getByRole('button', { name: 'Hacer una copia ahora' }).click();
    await expect(page.getByText(/-manual\.sqlite$/)).toBeVisible();
  });

  test('B1-12 · A3, A4, A5 y A7 son accesibles y caben en 360 px', async ({ page, space }) => {
    expect(space).toBeTruthy();
    const today = todayInMadrid();
    await enterAs(page, 'Alex, entrenador');
    const published = await createSessionForLucia(page, {
      date: today,
      label: 'Mañana',
      title: 'Accesible',
    });
    await createSessionForLucia(page, {
      date: today,
      label: 'Tarde',
      title: 'Borrador',
      publish: false,
    });
    const builder = page.url();
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 800 });
      for (const url of [
        '/entrenador/clientes/c-lucia/sesiones',
        '/entrenador/clientes/c-lucia/sesiones/nueva',
        builder,
        published,
      ]) {
        await page.goto(url);
        await expectNoSeriousA11yIssues(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${url} a ${width} px`).toBeLessThanOrEqual(0);
      }
    }
  });
});
