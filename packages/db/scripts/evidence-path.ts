import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Curated knowledge base lives in the repository (seed-data/). */
export const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../seed-data');
