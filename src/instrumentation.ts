/**
 * Se ejecuta una vez al arrancar el servidor de Next.js y antes de atender peticiones (ver
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
 * Comprobaciones de arranque de TrainPro: `src/server/startup.ts`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // La compilación no abre la base ni escucha en ninguna dirección.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { runStartupChecks } = await import('./server/startup');
  await runStartupChecks();
}
