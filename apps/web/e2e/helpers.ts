import { expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-entrenamiento-2026';

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Opens an entry of the trainer's user menu (everything that is not one of the four sections). */
export async function fromMenu(page: Page, name: string) {
  const menu = page.locator('details', { has: page.locator('summary', { hasText: 'Menú' }) });
  await menu.locator('summary').click();
  await menu.getByRole('link', { name }).click();
}

/** Signs out from the trainer area (the button is in the user menu). */
export async function logoutStaff(page: Page) {
  const menu = page.locator('details', { has: page.locator('summary', { hasText: 'Menú' }) });
  await menu.locator('summary').click();
  await menu.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
}
