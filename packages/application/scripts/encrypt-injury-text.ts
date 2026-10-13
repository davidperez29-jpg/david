/**
 * Restructure phase 11 (DPIA R-11) and phases 20–21 (A69): moves any injury free text written
 * before encryption into its encrypted columns; the legacy plaintext columns are marked by the
 * running release (APP_VERSION, or RENDER_GIT_COMMIT on Render) and dropped when a different
 * release starts. Idempotent: deploy/start.sh runs it on every start, after the migrations; once
 * the columns are gone it only reads the catalogue.
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
const r = await encryptInjuryText(
  { db, keys },
  process.env.APP_VERSION ?? process.env.RENDER_GIT_COMMIT,
);
await close();
console.log(
  `Injury text encryption: ${r.moved} legacy values encrypted, ${r.marked} legacy columns marked, ${r.dropped} dropped (${r.compacted} tables rewritten).`,
);
