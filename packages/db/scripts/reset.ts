import 'dotenv/config';
import { createDb } from '../src/client';
import { dropAll, runMigrations } from '../src/migrate';
import { seedCatalog } from '../src/seed/catalog';
import { seedKnowledgeBase } from '../src/seed/knowledge';
import { SEED_DIR } from './evidence-path';

const url = process.env.DATABASE_URL!;
await dropAll(url);
await runMigrations(url);
const { db, close } = createDb(url);
await seedCatalog(db);
const { evidence, assessment, exercises, templates, injury } = await seedKnowledgeBase(
  db,
  SEED_DIR,
);
console.log(
  `Global library: ${exercises.exercises} exercises, ${exercises.progressions} progressions, ${templates.templates} plan templates.`,
);
console.log(
  `Scientific library: ${evidence.sources} sources, ${evidence.findings} findings, ${evidence.claims.published}/${evidence.claims.total} claims and ${evidence.methods.published}/${evidence.methods.total} methods published; ${evidence.unverifiable} cited references not verifiable (never used as support), ${evidence.searches} logged searches.`,
);
console.log(
  `Assessment catalogue: ${assessment.tests} tests, ${assessment.reliability} reliability rows, ${assessment.references} reference rows, ${assessment.batteries} batteries.`,
);
console.log(
  `Injury catalogue: ${injury.conditions} conditions, ${injury.protocols} new protocol versions.`,
);
for (const e of evidence.qaErrors) console.warn(`  QA ${e.code}: ${e.target.key} — ${e.message}`);
await close();
console.log('Database reset: schema dropped, migrated and catalogue seeded.');
