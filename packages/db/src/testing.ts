import { createDb } from './client';
import { dropAll, runMigrations } from './migrate';
import { seedCatalog } from './seed/catalog';

/** Recreates the test database from scratch. Called once per integration test run. */
export async function prepareTestDatabase(url: string): Promise<void> {
  await dropAll(url);
  await runMigrations(url);
  const { db, close } = createDb(url, { max: 1 });
  await seedCatalog(db);
  await close();
}
