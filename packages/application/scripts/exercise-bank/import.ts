/**
 * Imports seed-data/exercise-bank/bank.json into an organization as reviewable drafts.
 * Usage: pnpm --filter @tp/application exercise-bank:import -- --org <slug> --as <admin email> [--limit N]
 */
import 'dotenv/config';
import { keyRingFromBase64 } from '@tp/auth';
import { createDb, schema } from '@tp/db';
import { eq, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  importExerciseBank,
  loadActor,
  MemoryMailer,
  MemoryStorage,
  type ImportedBankEntry,
} from '../../src';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const org = arg('org');
const email = arg('as');
if (!org || !email) {
  console.error('Usage: import.ts --org <slug> --as <admin email> [--limit N]');
  process.exit(1);
}
const { db, close } = createDb(process.env.DATABASE_URL!);
const [o] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, org));
const [u] = await db
  .select()
  .from(schema.users)
  .where(sql`lower(${schema.users.email}) = ${email.toLowerCase()}`);
if (!o || !u || u.organizationId !== o.id) throw new Error('Organization or user not found');
const actor = await loadActor(db, u.id);
if (!actor?.roles.some((r) => r === 'ADMIN' || r === 'TRAINER'))
  throw new Error('User must be staff');
const file = path.resolve(import.meta.dirname, '../../../../seed-data/exercise-bank/bank.json');
const { entries } = JSON.parse(readFileSync(file, 'utf8')) as { entries: ImportedBankEntry[] };
const limit = Number(arg('limit') ?? entries.length);
const t0 = Date.now();
const report = await importExerciseBank(
  {
    db,
    keys: keyRingFromBase64(process.env.APP_ENCRYPTION_KEY),
    mailer: new MemoryMailer(),
    storage: new MemoryStorage(),
    baseUrl: '',
    now: () => new Date(),
    actor,
  },
  entries.slice(0, limit),
);
await close();
console.log(
  JSON.stringify(
    {
      ...report,
      failed: report.failed.slice(0, 20),
      failedCount: report.failed.length,
      seconds: Math.round((Date.now() - t0) / 1000),
    },
    null,
    2,
  ),
);
