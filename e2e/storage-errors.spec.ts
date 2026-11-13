import { renameSync } from 'node:fs';
import { type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { expectNoSeriousA11yIssues, todayInMadrid } from './helpers';
import { createSessionForLucia, enterAs, expect, test } from './fixtures';

/**
 * B3.0 · Errores de la base de datos en el área del entrenador (docs/BLOCK3_SPEC.md §14, ADR-34),
 * sobre la compilación de producción (donde Next.js oculta los mensajes de error): la página dice
 * qué ha pasado y qué hacer, nunca da por hecho lo que no se hizo y no muestra detalles internos.
 */
const dbFile = (space: string) => `.data/e2e/espacios/${space}.sqlite`;

/** Otro programa reserva la escritura de la base del espacio (como un visor de SQLite). */
function lockDatabase(space: string) {
  const db = new Database(dbFile(space));
  db.exec('BEGIN IMMEDIATE');
  return () => {
    db.exec('ROLLBACK');
    db.close();
  };
}

/** Nada técnico en pantalla: ni rutas, ni SQL, ni trazas. */
async function expectNoInternals(page: Page, space: string) {
  const text = await page.locator('body').innerText();
  expect(text).not.toContain(space);
  expect(text).not.toMatch(/\.sqlite|SQLITE|SqliteError|\/home\/|node_modules|at [A-Za-z]+ \(/);
}

test.describe('errores de la base (entrenador)', () => {
  test('B3.0 · base ocupada al crear una sesión: aviso en el formulario, se conserva lo escrito y repetir no duplica', async ({
    page,
    space,
  }) => {
    await enterAs(page, 'Alex, entrenador');
    await page.goto(`/entrenador/clientes/c-lucia/sesiones/nueva?fecha=${todayInMadrid()}`);
    await page.getByLabel('Contexto').fill('Tarde');
    await page.getByLabel('Título').fill('Con la base ocupada');
    await page.getByLabel(/^Objetivo/).fill('Fuerza');
    await page.getByLabel('Duración (min)').fill('40');
    const unlock = lockDatabase(space);
    try {
      await page.getByRole('button', { name: 'Crear borrador' }).click();
      await expect(
        page.getByText(
          'La base de datos está ocupada en este momento y la sesión no se ha creado.',
          {
            exact: false,
          },
        ),
      ).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/\/nueva/);
      // Lo escrito sigue en el formulario.
      await expect(page.getByLabel('Título')).toHaveValue('Con la base ocupada');
      await expect(page.getByLabel('Contexto')).toHaveValue('Tarde');
      await expect(page.getByLabel(/^Objetivo/)).toHaveValue('Fuerza');
    } finally {
      unlock();
    }
    // Repetir es seguro: se crea una sola vez.
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await page.waitForURL(/\/editar$/);
    await page.goto('/entrenador/clientes/c-lucia/sesiones');
    await expect(page.getByText('Con la base ocupada')).toHaveCount(1);
  });

  test('B3.0 · base ocupada al eliminar un borrador: página de error dentro del área, nada aplicado, y se puede repetir', async ({
    page,
    space,
  }) => {
    await enterAs(page, 'Alex, entrenador');
    await createSessionForLucia(page, {
      date: todayInMadrid(),
      label: 'Tarde',
      title: 'Borrador a eliminar',
      publish: false,
    });
    await page.goto('/entrenador/clientes/c-lucia/sesiones');
    page.on('dialog', (dialog) => dialog.accept());
    const unlock = lockDatabase(space);
    try {
      await page
        .getByRole('button', { name: /^Eliminar el borrador «.*Borrador a eliminar»$/ })
        .click();
      const view = page.locator('[data-storage-kind="busy"][data-storage-operation="write"]');
      await expect(view).toBeVisible({ timeout: 10_000 });
      await expect(view).toHaveAttribute('data-storage-outcome', 'not_applied');
      await expect(
        page.getByRole('heading', { name: 'La base de datos está ocupada' }),
      ).toBeVisible();
      await expect(
        page.getByText('La operación no se ha realizado: no se ha guardado nada.'),
      ).toBeVisible();
      await expect(page.getByText('Se puede reintentar')).toBeVisible();
      // Dentro del área: el menú del entrenador sigue ahí.
      await expect(
        page.getByRole('navigation').getByRole('link', { name: 'Panel' }).first(),
      ).toBeVisible();
      await expectNoInternals(page, space);
      await expectNoSeriousA11yIssues(page);
    } finally {
      unlock();
    }
    // «Volver a la página» solo vuelve a leer: el borrador sigue ahí.
    await page.getByRole('button', { name: 'Volver a la página' }).click();
    await expect(page.getByText('Borrador a eliminar')).toBeVisible();
    // Ahora sí se elimina, una vez.
    await page
      .getByRole('button', { name: /^Eliminar el borrador «.*Borrador a eliminar»$/ })
      .click();
    await expect(page.getByText('Borrador a eliminar')).toHaveCount(0);
  });

  test('B3.0 · base inaccesible: el entrenador ve qué pasa y qué hacer, sin detalles internos', async ({
    page,
    space,
  }) => {
    await enterAs(page, 'Alex, entrenador');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Alguien mueve el archivo de la base con el servidor en marcha (A-20).
    renameSync(dbFile(space), `${dbFile(space)}.movida`);
    await page.goto('/entrenador');
    const view = page.locator('[data-storage-kind="unavailable"]');
    await expect(view).toBeVisible();
    await expect(view).toHaveAttribute('data-storage-operation', 'read');
    await expect(
      page.getByRole('heading', { name: 'No se puede acceder a los datos' }),
    ).toBeVisible();
    await expect(page.getByText('No se ha modificado nada.')).toBeVisible();
    await expect(page.getByText('Necesita intervención')).toBeVisible();
    await expect(page.getByText(/Reinicia el servidor de TrainPro/)).toBeVisible();
    await expectNoInternals(page, space);
    await expectNoSeriousA11yIssues(page);
    // Reintentar no cambia nada ni rompe la página: sigue sin poder acceder, y lo dice.
    await page.getByRole('button', { name: 'Volver a intentarlo' }).click();
    await expect(page.locator('[data-storage-kind="unavailable"]')).toBeVisible();
  });
});
