'use server';

import { refresh } from 'next/cache';
import { getDataMaintenance, getTrainerContext } from '@/server/context';
import { backupDemoData, resetDemoData } from '@/server/services/demo-data';
import { runWrite } from '@/server/write-operations';

/**
 * Copia de seguridad en línea de la base de la demostración (solo el entrenador). Si falla, la
 * página de error lo explica (B3.0); no se reintenta sola.
 */
export async function backupAction() {
  await runWrite('Hacer una copia', async () =>
    backupDemoData(await getTrainerContext(), await getDataMaintenance()),
  );
  refresh();
}

/** «Restablecer datos demo»: copia del estado actual y base nueva con la semilla de hoy. */
export async function resetAction() {
  await runWrite('Restablecer los datos demo', async () =>
    resetDemoData(await getTrainerContext(), await getDataMaintenance()),
  );
  refresh();
}
