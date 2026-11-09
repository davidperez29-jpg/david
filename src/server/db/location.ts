/**
 * Dónde vive la base de datos local (docs/V1_SPEC.md §8.3.1).
 *
 * - Por defecto, `.data/trainpro.sqlite` dentro del proyecto: fuera de Git, y fuera de `.next`
 *   y de `node_modules`, que se borran al compilar o al reinstalar.
 * - Espacios de las E2E (`TRAINPRO_DEMO_SPACES=on`): `<datos>/espacios/<espacio>.sqlite`.
 * - Copias: `<carpeta de la base>/backups/`.
 *
 * Sin `server-only` ni alias `@/`: lo usa también `scripts/db.ts`, que Node ejecuta directamente.
 */
import { isAbsolute, join, relative, resolve } from 'node:path';

export const DEFAULT_DATA_DIR = '.data';
export const DATABASE_FILE = 'trainpro.sqlite';
export const SPACES_DIR = 'espacios';
/** Nombre de un espacio de pruebas: minúsculas, cifras y guiones (también es un nombre de archivo). */
export const SPACE_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;

const isInside = (folder: string, path: string) => {
  const rel = relative(folder, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/** Carpeta de datos absoluta. Rechaza carpetas que se borran al compilar o reinstalar. */
export function resolveDataDir(value: string | undefined, cwd: string = process.cwd()): string {
  const dir = resolve(cwd, value?.trim() || DEFAULT_DATA_DIR);
  for (const volatile of ['.next', 'node_modules']) {
    if (isInside(resolve(cwd, volatile), dir)) {
      throw new Error(
        `TRAINPRO_DATA_DIR="${value}" está dentro de ${volatile}, que se borra al compilar o reinstalar.`,
      );
    }
  }
  return dir;
}

export const isValidSpace = (space: string) => SPACE_PATTERN.test(space);

/** Archivo de la base principal o de un espacio de pruebas. */
export function databaseFile(dataDir: string, space: string | null = null): string {
  if (space === null) return join(dataDir, DATABASE_FILE);
  if (!isValidSpace(space)) throw new Error(`Espacio de pruebas no válido: "${space}".`);
  return join(dataDir, SPACES_DIR, `${space}.sqlite`);
}
