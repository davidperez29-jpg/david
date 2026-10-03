import 'dotenv/config';
import { createDb } from '../src/client';
import { seedCatalog } from '../src/seed/catalog';
import { loadEvidenceFiles, seedEvidence } from '../src/seed/evidence';
import { EVIDENCE_DIR } from './evidence-path';

const { db, close } = createDb(process.env.DATABASE_URL!);
await seedCatalog(db);
const evidence = await seedEvidence(db, loadEvidenceFiles(EVIDENCE_DIR));
console.log(
  `Scientific library: ${evidence.sources} sources, ${evidence.findings} findings, ${evidence.claims.published}/${evidence.claims.total} claims and ${evidence.methods.published}/${evidence.methods.total} methods published.`,
);
for (const e of evidence.qaErrors) console.warn(`  QA ${e.code}: ${e.target.key} — ${e.message}`);
await close();
console.log('Catalogue seeded (roles, permissions, goals, sports, equipment).');
