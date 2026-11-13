import { type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { todayInMadrid } from './helpers';
import { createSessionForLucia, enterAs, expect, joinSpace, test } from './fixtures';

/**
 * Constructor sin pérdida de trabajo (docs/AUDIT_BLOCK1.md A-05, A-06 y A-07): guardado
 * automático, errores del servidor, recargas, cierres, navegación con cambios pendientes y
 * conflictos entre la copia local y el servidor. Cada prueba en su propio espacio de datos.
 */
const status = (page: Page) => page.getByRole('status').filter({ hasText: /guard|Guardando/i });
const exercises = (page: Page, name: string) =>
  page.getByRole('heading', { level: 3 }).filter({ hasText: name });

/** Las acciones de servidor (guardar, publicar) son POST con la cabecera `Next-Action`. */
const isServerAction = (request: { method(): string; headers(): Record<string, string> }) =>
  request.method() === 'POST' && 'next-action' in request.headers();

async function addExercise(page: Page, search: string, name: RegExp) {
  if (!(await page.getByRole('searchbox').isVisible())) {
    await page.getByRole('button', { name: 'Añadir ejercicio' }).click();
  }
  await page.getByRole('searchbox').fill(search);
  await page.getByRole('button', { name }).first().click();
}

async function newDraft(page: Page, title: string) {
  await enterAs(page, 'Alex, entrenador');
  return createSessionForLucia(page, {
    date: todayInMadrid(),
    label: 'Tarde',
    title,
    publish: false,
  });
}

test.describe('constructor: el trabajo no se pierde', () => {
  test('A-07 · guardado automático: sin pulsar «Guardar», el servidor lo confirma y sobrevive a recargar', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    await newDraft(page, 'Automático');
    await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
    await expect(status(page)).toHaveText(/Cambios pendientes de guardar|Guardando/);
    // «Borrador guardado» solo cuando el servidor lo ha confirmado.
    await expect(status(page)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
    await page.reload();
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
    await expect(page.getByText('Tienes cambios sin guardar de una visita anterior')).toHaveCount(
      0,
    );
  });

  test('A-05 · la base bloqueada al guardar: el contenido sigue, se avisa y se guarda al liberarse', async ({
    page,
    space,
  }) => {
    await newDraft(page, 'Base bloqueada');
    // Otro proceso reserva la escritura de la base del espacio (el caso exacto de la auditoría).
    const db = new Database(`.data/e2e/espacios/${space}.sqlite`);
    db.exec('BEGIN IMMEDIATE');
    try {
      await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByText('No se ha podido guardar').first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/la base de datos está ocupada/)).toBeVisible();
      // Nada de «Algo no ha ido bien»: el trabajo sigue en pantalla.
      await expect(page.getByText('Algo no ha ido bien')).toHaveCount(0);
      await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
    } finally {
      db.exec('ROLLBACK');
      db.close();
    }
    // Se reintenta solo y queda guardado de verdad.
    await expect(status(page)).toHaveText(/^Borrador guardado/, { timeout: 15_000 });
    await page.reload();
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
  });

  test('A-05 · el servidor falla (500) o no responde: el contenido sigue y «reintentar ahora» lo guarda', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    await newDraft(page, 'Servidor caído');
    await page.route('**/*', (route) =>
      isServerAction(route.request())
        ? route.fulfill({ status: 500, body: 'error' })
        : route.continue(),
    );
    await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('No se ha podido guardar').first()).toBeVisible();
    await expect(page.getByText('Algo no ha ido bien')).toHaveCount(0);
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
    await expect(status(page)).toHaveText(/No se ha podido guardar/);
    await page.unroute('**/*');
    await page.getByRole('button', { name: 'reintentar ahora' }).click();
    await expect(status(page)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
  });

  test('A-07 · recargar (o cerrar) antes de guardar: se ofrece recuperar los cambios y se recuperan', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    await newDraft(page, 'Recargar');
    // El servidor no recibe nada: los cambios solo están en pantalla y en la copia local.
    await page.route('**/*', (route) =>
      isServerAction(route.request()) ? route.abort('failed') : route.continue(),
    );
    await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
    await page.waitForTimeout(500);
    await page.unroute('**/*');
    // Cerrar la pestaña avisa (beforeunload); aquí se simula aceptando y abriendo otra.
    const context = page.context();
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.type());
      await d.accept();
    });
    const url = page.url();
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => dialogs).toContain('beforeunload');
    const again = await context.newPage();
    await again.goto(url);
    await expect(
      again.getByText('Tienes cambios sin guardar de una visita anterior'),
    ).toBeVisible();
    await expect(exercises(again, 'Peso muerto rumano')).toHaveCount(0);
    await again.getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await expect(exercises(again, 'Peso muerto rumano')).toHaveCount(1);
    await expect(status(again)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
    await again.reload();
    await expect(exercises(again, 'Peso muerto rumano')).toHaveCount(1);
  });

  test('A-06 · salir por el menú con cambios pendientes: aviso con salida segura y copia recuperable', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    const builder = await newDraft(page, 'Menú');
    await page.route('**/*', (route) =>
      isServerAction(route.request()) ? route.abort('failed') : route.continue(),
    );
    await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
    const menu = page.getByRole('navigation').getByRole('link', { name: 'Panel' }).first();
    await menu.click();
    const leave = page.getByRole('dialog', { name: 'Tienes cambios sin guardar' });
    await expect(leave).toBeVisible();
    await expect(leave).toContainText('Se conserva una copia en este navegador');
    await leave.getByRole('button', { name: 'Seguir editando' }).click();
    await expect(page).toHaveURL(/\/editar$/);
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
    // «Guardar y salir» sin servidor: no sale y lo dice.
    await menu.click();
    await leave.getByRole('button', { name: 'Guardar y salir' }).click();
    await expect(leave).toContainText('No se han podido guardar ahora mismo');
    await expect(page).toHaveURL(/\/editar$/);
    // Salir conservando la copia; al volver, se ofrece recuperarla.
    await leave.getByRole('button', { name: 'Salir (se conserva una copia)' }).click();
    await page.waitForURL(/\/entrenador$/);
    await page.unroute('**/*');
    await page.goto(builder);
    await expect(page.getByText('Tienes cambios sin guardar de una visita anterior')).toBeVisible();
    await page.getByRole('button', { name: 'Recuperar mis cambios' }).click();
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
    await expect(status(page)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
  });

  test('A-07 · copia local frente a una versión posterior del servidor: se elige, nada se pisa en silencio', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    expect(space).toBeTruthy();
    const builder = await newDraft(page, 'Conflicto');
    // Pestaña A: cambios que no llegan al servidor (quedan en la copia local).
    await page.route('**/*', (route) =>
      isServerAction(route.request()) ? route.abort('failed') : route.continue(),
    );
    await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
    await page.waitForTimeout(300);
    // Otro dispositivo (otro navegador, sin esa copia local) guarda un cambio: revisión posterior.
    const laptop = await browser.newContext({ baseURL });
    await joinSpace(laptop, space, baseURL!);
    const other = await laptop.newPage();
    await enterAs(other, 'Alex, entrenador');
    await other.goto(builder);
    await expect(other.getByText('Tienes cambios sin guardar de una visita anterior')).toHaveCount(
      0,
    );
    await addExercise(other, 'plancha lateral', /^Añadir Plancha lateral/);
    await expect(status(other)).toHaveText(/Cambios pendientes de guardar|Guardando/);
    await expect(status(other)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
    await laptop.close();
    // A vuelve a abrir el borrador: se avisa de que el servidor tiene una versión posterior.
    await page.unroute('**/*');
    page.on('dialog', (d) => d.accept());
    await page.reload();
    await expect(page.getByText('el borrador se ha guardado después en otro sitio')).toBeVisible();
    await expect(exercises(page, 'Plancha lateral')).toHaveCount(1);
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(0);
    // Hasta decidir, no se edita (nada pisa la copia ni la versión guardada).
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    // Decide quedarse con la del servidor: la copia local se descarta, la guardada no cambia.
    await page.getByRole('button', { name: 'Quedarme con la versión guardada' }).click();
    await page.reload();
    await expect(page.getByText('Tienes cambios sin guardar de una visita anterior')).toHaveCount(
      0,
    );
    await expect(exercises(page, 'Plancha lateral')).toHaveCount(1);
  });

  test('A-07 · dos pestañas del mismo navegador: la copia de la otra se ofrece y se retira cuando esa pestaña guarda', async ({
    page,
    space,
  }) => {
    expect(space).toBeTruthy();
    const builder = await newDraft(page, 'Dos pestañas');
    // Pestaña 1: cambios aún sin confirmar (la copia local es compartida por el navegador).
    await page.route('**/*', (route) =>
      isServerAction(route.request()) ? route.abort('failed') : route.continue(),
    );
    await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
    await page.waitForTimeout(300);
    // Pestaña 2 del mismo navegador: ve esos cambios como recuperables y no edita encima.
    const second = await page.context().newPage();
    await second.goto(builder);
    await expect(
      second.getByText('Tienes cambios sin guardar de una visita anterior'),
    ).toBeVisible();
    await expect(second.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    // La pestaña 1 consigue guardar: la copia ya no hace falta y la pestaña 2 deja de ofrecerla.
    await page.unroute('**/*');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(status(page)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
    await expect(second.getByText('Tienes cambios sin guardar de una visita anterior')).toHaveCount(
      0,
    );
    await expect(second.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    // Lo que tenga abierto la pestaña 2 es anterior: guardar ahí no pisa lo de la pestaña 1.
    await second.getByLabel('Título').fill('Desde la pestaña 2');
    await second.getByRole('button', { name: 'Guardar' }).click();
    await expect(second.getByText('Hay una versión más reciente de este borrador')).toBeVisible();
    await second.close({ runBeforeUnload: false });
    await page.reload();
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
    await expect(page.getByLabel('Título')).toHaveValue('Dos pestañas');
  });

  test('A-07 · «Usar mi copia» frente a una versión posterior: se guarda la copia porque se ha elegido', async ({
    page,
    browser,
    space,
    baseURL,
  }) => {
    const builder = await newDraft(page, 'Usar mi copia');
    await page.route('**/*', (route) =>
      isServerAction(route.request()) ? route.abort('failed') : route.continue(),
    );
    await addExercise(page, 'peso muerto rumano', /^Añadir Peso muerto rumano/);
    await page.waitForTimeout(300);
    const laptop = await browser.newContext({ baseURL });
    await joinSpace(laptop, space, baseURL!);
    const other = await laptop.newPage();
    await enterAs(other, 'Alex, entrenador');
    await other.goto(builder);
    await addExercise(other, 'plancha lateral', /^Añadir Plancha lateral/);
    await expect(status(other)).toHaveText(/Cambios pendientes de guardar|Guardando/);
    await expect(status(other)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
    await laptop.close();
    await page.unroute('**/*');
    page.on('dialog', (d) => d.accept());
    await page.reload();
    await page.getByRole('button', { name: 'Usar mi copia' }).click();
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
    await expect(exercises(page, 'Plancha lateral')).toHaveCount(0);
    await expect(status(page)).toHaveText(/^Borrador guardado/, { timeout: 10_000 });
    await page.reload();
    await expect(exercises(page, 'Peso muerto rumano')).toHaveCount(1);
  });
});
