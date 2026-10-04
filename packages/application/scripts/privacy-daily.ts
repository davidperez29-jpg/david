/**
 * Daily privacy job (Phase 13): anonymizes archived clients whose retention period (set by the
 * controller per organization) has ended, and purges expired security records (sessions, login
 * attempts, reset tokens, rows of finished imports). Usage: pnpm privacy:daily (cron, once a day).
 */
import 'dotenv/config';
import { createDb } from '@tp/db';
import { applyRetention, LocalDiskStorage } from '../src';

const { db, close } = createDb(process.env.DATABASE_URL!);
const r = await applyRetention({
  db,
  now: () => new Date(),
  storage: new LocalDiskStorage(process.env.FILE_STORAGE_DIR ?? '.data/files'),
});
await close();
console.log(
  `Privacy: ${r.anonymized} clients anonymized; purged ${r.sessions} sessions, ${r.attempts} login attempts, ${r.resets} reset tokens, ${r.importJobs} import jobs' rows.`,
);
