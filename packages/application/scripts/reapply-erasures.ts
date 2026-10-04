/**
 * After restoring a backup (docs/OPERATIONS.md §6): re-applies the erasures made after the backup
 * was taken, so no erased person comes back. Input: the `subject_erased` events of the logs since
 * the backup (JSON lines on stdin) or client ids as arguments.
 *
 *   grep subject_erased app.log | pnpm privacy:reapply-erasures
 *   pnpm privacy:reapply-erasures <clientId> [<clientId>…]
 */
import 'dotenv/config';
import { createDb, schema } from '@tp/db';
import { eq } from 'drizzle-orm';
import { anonymizeClient, LocalDiskStorage } from '../src';

async function readIds(): Promise<string[]> {
  const args = process.argv.slice(2);
  if (args.length) return args;
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text
    .split('\n')
    .filter((l) => l.includes('subject_erased'))
    .map((l) => (JSON.parse(l.slice(l.indexOf('{'))) as { clientId?: string }).clientId)
    .filter((x): x is string => !!x);
}

const ids = [...new Set(await readIds())];
const { db, close } = createDb(process.env.DATABASE_URL!);
const app = {
  db,
  now: () => new Date(),
  storage: new LocalDiskStorage(process.env.FILE_STORAGE_DIR ?? '.data/files'),
};
let applied = 0;
let already = 0;
let missing = 0;
for (const id of ids) {
  const [c] = await db.select().from(schema.clients).where(eq(schema.clients.id, id));
  if (!c) missing++;
  else if (c.anonymizedAt) already++;
  else {
    await anonymizeClient(app, id);
    applied++;
  }
}
await close();
console.log(
  `Erasures: ${applied} re-applied, ${already} already erased, ${missing} not in this database.`,
);
