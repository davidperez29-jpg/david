import { createDb } from './client';
import { dropAll, runMigrations } from './migrate';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedCatalog } from './seed/catalog';
import { seedKnowledgeBase } from './seed/knowledge';

export const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../seed-data');
export const EVIDENCE_DIR = join(SEED_DIR, 'evidence');

/** Recreates the test database from scratch. Called once per integration test run. */
export async function prepareTestDatabase(url: string): Promise<void> {
  await dropAll(url);
  await runMigrations(url);
  const { db, close } = createDb(url, { max: 1 });
  await seedCatalog(db);
  await seedKnowledgeBase(db, SEED_DIR);
  await close();
}
