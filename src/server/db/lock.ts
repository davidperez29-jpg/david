/**
 * Marca de «base en uso por el servidor»: un archivo `<base>.pid` con el número del proceso.
 *
 * Sirve para que `pnpm db:restore` se niegue a sustituir la base mientras el servidor la tiene
 * abierta (docs/V1_SPEC.md §8.3.6). Si el servidor murió sin borrar la marca (por ejemplo, con
 * `SIGKILL`), el proceso ya no existe y la marca se ignora.
 *
 * Sin `server-only` ni alias `@/`: lo usa también `scripts/db.ts`.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const markerFile = (databasePath: string) => `${databasePath}.pid`;

export function markInUse(databasePath: string): void {
  writeFileSync(markerFile(databasePath), String(process.pid), { mode: 0o600 });
}

/** Borra la marca si es de este proceso. */
export function releaseInUse(databasePath: string): void {
  try {
    if (Number(readFileSync(markerFile(databasePath), 'utf8').trim()) === process.pid) {
      rmSync(markerFile(databasePath), { force: true });
    }
  } catch {
    // Sin marca: nada que hacer.
  }
}

/** Proceso (distinto de este) que tiene la base abierta, o `null` si no hay ninguno vivo. */
export function processUsing(databasePath: string): number | null {
  let pid: number;
  try {
    pid = Number(readFileSync(markerFile(databasePath), 'utf8').trim());
  } catch {
    return null;
  }
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
  try {
    process.kill(pid, 0); // Solo comprueba si el proceso existe.
    return pid;
  } catch (error) {
    return (error as { code?: string }).code === 'EPERM' ? pid : null;
  }
}
