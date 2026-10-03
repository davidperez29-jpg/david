import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Curated evidence lives in the repository (seed-data/evidence). */
export const EVIDENCE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../seed-data/evidence',
);
