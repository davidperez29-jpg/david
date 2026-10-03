import { createDb } from './client';
import { dropAll, runMigrations } from './migrate';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedCatalog } from './seed/catalog';
import { loadEvidenceFiles, seedEvidence } from './seed/evidence';

export const EVIDENCE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../seed-data/evidence',
);

/** Recreates the test database from scratch. Called once per integration test run. */
export async function prepareTestDatabase(url: string): Promise<void> {
  await dropAll(url);
  await runMigrations(url);
  const { db, close } = createDb(url, { max: 1 });
  await seedCatalog(db);
  await seedEvidence(db, loadEvidenceFiles(EVIDENCE_DIR));
  await close();
}
