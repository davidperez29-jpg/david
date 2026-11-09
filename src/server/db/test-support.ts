import 'server-only';
import { type IsoDate } from '@/domain/time';
import { type Repositories } from '../repositories/ports';
import { openSqlite, type SqlDatabase } from './sqlite.ts';
import { createStoreRepositories, prepareDatabase } from './store';

/**
 * SOLO PARA PRUEBAS: una base SQLite real (en memoria o en un archivo), migrada y sembrada con
 * la demostración del día indicado, y sus repositorios.
 */
export function seededTestDatabase(
  today: IsoDate,
  options: { path?: string; timeZone?: string } = {},
): { db: SqlDatabase; repos: Repositories; seedDate: IsoDate } {
  const db = openSqlite(options.path ?? ':memory:');
  const { seedDate } = prepareDatabase(db, {
    today,
    timeZone: options.timeZone ?? 'Europe/Madrid',
    now: `${today}T07:00:00.000Z`,
  });
  return { db, seedDate, repos: createStoreRepositories(db, seedDate) };
}
