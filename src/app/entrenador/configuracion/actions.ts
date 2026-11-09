'use server';

import { refresh } from 'next/cache';
import { getDataMaintenance, getTrainerContext } from '@/server/context';
import { backupDemoData, resetDemoData } from '@/server/services/demo-data';

/** Copia de seguridad en línea de la base de la demostración (solo el entrenador). */
export async function backupAction() {
  await backupDemoData(await getTrainerContext(), await getDataMaintenance());
  refresh();
}

/** «Restablecer datos demo»: copia del estado actual y base nueva con la semilla de hoy. */
export async function resetAction() {
  resetDemoData(await getTrainerContext(), await getDataMaintenance());
  refresh();
}
