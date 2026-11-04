import { expect, test } from '@playwright/test';
import { collectErrors, expectNoSeriousA11yIssues } from './helpers';

const TRAINER_PAGES = [
  ['/entrenador', 'Hola, Alex'],
  ['/entrenador/clientes', 'Clientes'],
  ['/entrenador/clientes/c-diego', 'Diego Alonso'],
  ['/entrenador/evaluaciones', 'Evaluaciones'],
  ['/entrenador/planificacion', 'Planificación'],
  ['/entrenador/ejercicios', 'Biblioteca de ejercicios'],
  ['/entrenador/ejercicios/ex-rdl', 'Peso muerto rumano'],
  ['/entrenador/carga', 'Carga y volumen'],
  ['/entrenador/readaptacion', 'Readaptación'],
  ['/entrenador/informes', 'Informes'],
  ['/entrenador/configuracion', 'Configuración'],
] as const;

test.describe('área del entrenador', () => {
  for (const [path, heading] of TRAINER_PAGES) {
    test(`${path} carga sin errores y es accesible`, async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
      await expect(page.getByRole('note')).toContainText('Demostración');
      await expectNoSeriousA11yIssues(page);
      expect(errors).toEqual([]);
    });
  }

  test('la navegación lateral lleva a cada sección y marca la actual', async ({ page }) => {
    await page.goto('/entrenador');
    const nav = page.getByRole('navigation', { name: 'Secciones' });
    await nav.getByRole('link', { name: 'Carga y volumen' }).click();
    await expect(page).toHaveURL(/\/entrenador\/carga$/);
    await expect(nav.getByRole('link', { name: 'Carga y volumen' })).toHaveAttribute(
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

  test('la biblioteca filtra por patrón de movimiento', async ({ page }) => {
    await page.goto('/entrenador/ejercicios');
    await page.getByRole('button', { name: 'Tracción' }).click();
    await expect(page.getByText('2 ejercicios')).toBeVisible();
  });

  test('el selector de métrica cambia todos los gráficos de carga', async ({ page }) => {
    await page.goto('/entrenador/carga');
    await page.getByText('Tonelaje', { exact: true }).first().click();
    await expect(page.getByText('Cálculo · training.volume-load v1.0.0')).toBeVisible();
  });

  test('un cliente inexistente devuelve 404', async ({ page }) => {
    const response = await page.goto('/entrenador/clientes/no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('No hemos encontrado');
  });
});
