/**
 * Key rotation (Phase 13). 1) Set APP_ENCRYPTION_KEY to the new key and APP_ENCRYPTION_KEYS_PREVIOUS
 * to the old one(s), comma-separated; the app keeps reading old values. 2) Run pnpm keys:rotate to
 * re-encrypt every encrypted column with the new key. 3) When it reports 0 unreadable values,
 * remove the old key from APP_ENCRYPTION_KEYS_PREVIOUS.
 */
import 'dotenv/config';
import { keyRingFromBase64 } from '@tp/auth';
import { createDb } from '@tp/db';
import { rotateEncryptedColumns } from '../src';

const { db, close } = createDb(process.env.DATABASE_URL!);
const keys = keyRingFromBase64(
  process.env.APP_ENCRYPTION_KEY,
  process.env.APP_ENCRYPTION_KEYS_PREVIOUS,
);
const r = await rotateEncryptedColumns({ db, keys });
await close();
console.log(
  `Key rotation: ${r.rotated} values re-encrypted; ${r.unreadable} unreadable with the configured keys.`,
);
if (r.unreadable) process.exitCode = 1;
