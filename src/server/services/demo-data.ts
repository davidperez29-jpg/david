import 'server-only';
import { type DemoDataVM } from '@/contracts/sessions';
import { canManageDemoData } from '@/domain/access';
import { type DataMaintenance, type TrainerContext } from '../context';

/**
 * Datos de la demostración local (Configuración): copias y «Restablecer datos demo».
 * Solo para el entrenador de la demo (`canManageDemoData`). Restaurar una copia se hace con
 * `pnpm db:restore`, con el servidor parado (docs/V1_SPEC.md §8.3.6).
 */
export function getDemoData(ctx: TrainerContext, data: DataMaintenance): DemoDataVM | null {
  if (!canManageDemoData(ctx.actor)) return null;
  const { file, space, seedDate, backups } = data.describe();
  return {
    file,
    space,
    seedDate,
    backups: backups.slice(0, 5).map(({ name, sizeBytes, createdAt }) => ({
      name,
      sizeBytes,
      createdAt,
    })),
  };
}

export async function backupDemoData(ctx: TrainerContext, data: DataMaintenance) {
  if (!canManageDemoData(ctx.actor)) return null;
  const backup = await data.backup();
  return { name: backup.name };
}

export function resetDemoData(ctx: TrainerContext, data: DataMaintenance) {
  if (!canManageDemoData(ctx.actor)) return null;
  const { backup, seedDate } = data.reset();
  return { backupName: backup.name, seedDate };
}
