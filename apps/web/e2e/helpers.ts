import { expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-entrenamiento-2026';

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
