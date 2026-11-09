/**
 * Configuración del servidor de pruebas (la usan `playwright.config.ts` y la prueba de reinicio,
 * que arranca su propio servidor): modo local, espacios aislados y datos en `.data/e2e`.
 */
export const E2E_SERVER_ENV = {
  TRAINPRO_MODE: 'local-demo',
  TRAINPRO_DEMO_SPACES: 'on',
  TRAINPRO_DATA_DIR: '.data/e2e',
  TRAINPRO_TIME_ZONE: 'Europe/Madrid',
} as const;
