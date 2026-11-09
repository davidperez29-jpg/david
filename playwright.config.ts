import { defineConfig, devices } from '@playwright/test';
import { E2E_SERVER_ENV } from './e2e/server-env';

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Pruebas de extremo a extremo contra la build de producción (`pnpm test:e2e` compila antes).
 * Si el navegador no está instalado: `pnpm exec playwright install chromium`.
 *
 * - El servidor escucha solo en 127.0.0.1, como en desarrollo (P-87).
 * - Los datos de la ejecución anterior se borran al arrancar; cada prueba que escribe usa su
 *   propio espacio (un archivo SQLite aparte, ver `e2e/fixtures.ts`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /client-.*\.spec\.ts/,
    },
    {
      name: 'movil',
      use: { ...devices['Pixel 7'] },
      testMatch: /(client-.*|responsive)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `node scripts/e2e-clean.ts && pnpm exec next start -H 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    env: { ...E2E_SERVER_ENV },
    // Nunca se reutiliza un servidor ya arrancado: sus datos y su configuración serían otros.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
