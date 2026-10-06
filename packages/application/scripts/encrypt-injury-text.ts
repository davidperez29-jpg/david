/**
 * Restructure phase 11 (DPIA R-11): moves the injury free text written before encryption into
 * its encrypted columns and empties the plaintext ones. Idempotent: deploy/start.sh runs it on
 * every start, after the migrations.
 */
import 'dotenv/config';
import { keyRingFromBase64 } from '@tp/auth';
import { createDb } from '@tp/db';
import { encryptInjuryText } from '../src';

const { db, close } = createDb(process.env.DATABASE_URL!);
const keys = keyRingFromBase64(
  process.env.APP_ENCRYPTION_KEY,
  process.env.APP_ENCRYPTION_KEYS_PREVIOUS,
);
const r = await encryptInjuryText({ db, keys });
await close();
console.log(`Injury text encryption: ${r.moved} legacy values encrypted.`);
