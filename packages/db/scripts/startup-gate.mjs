/**
 * Start-up gate (restructure phase 22, deploy/start.sh). A free instance sleeps after 15 min
 * without visits and starts from scratch on the next one. The one-off setup (migrations,
 * catalogues, legacy text encryption, first administrator, demo data) takes about 12 s of CPU,
 * close to two minutes on a 0.1 CPU instance, although nothing has changed. This remembers that
 * the setup is done for a release and a set of start-up settings:
 *
 *   node scripts/startup-gate.mjs check   exit 0 when it is done (start.sh skips it), 1 otherwise
 *   node scripts/startup-gate.mjs done    records it, once the setup has succeeded
 *
 * Without a release id (APP_VERSION, or RENDER_GIT_COMMIT on Render) or an encryption key it
 * always answers «not done», so other deployments keep running the setup on every start. Plain
 * JavaScript on purpose: no TypeScript compiler on the wake-up path.
 */
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { normalizeDatabaseUrl } from '../src/database-url.mjs';

/** Everything the setup steps read: a change in any of them runs the setup again. */
export const SETUP_SETTINGS = [
  'APP_VERSION',
  'RENDER_GIT_COMMIT',
  'ADMIN_EMAIL',
  'ADMIN_NAME',
  'ADMIN_PASSWORD',
  'ORG_NAME',
  'REQUIRE_ADMIN_2FA',
  'DEMO_DATA',
  'DEMO_PASSWORD',
  'DEMO_SKIP_BANK',
  'APP_ENCRYPTION_KEYS_PREVIOUS',
  'APP_BASE_URL',
  'RENDER_EXTERNAL_URL',
];

/**
 * The release and a fingerprint of the settings, or null when the setup must always run. Keyed
 * with the encryption key (a new key runs the setup too), because the settings include the
 * administrator's password: the stored value reveals nothing without the key.
 */
export function startupFingerprint(env) {
  const release = env.APP_VERSION || env.RENDER_GIT_COMMIT;
  if (!release || !env.APP_ENCRYPTION_KEY) return null;
  const settings = JSON.stringify(SETUP_SETTINGS.map((k) => [k, env[k] ?? null]));
  return {
    release: release.slice(0, 64),
    fingerprint: createHmac('sha256', env.APP_ENCRYPTION_KEY).update(settings).digest('hex'),
  };
}

async function main(mode, env) {
  const f = startupFingerprint(env);
  if (!f || !env.DATABASE_URL) return mode === 'done' ? 0 : 1;
  const sql = postgres(normalizeDatabaseUrl(env.DATABASE_URL), {
    max: 1,
    connect_timeout: 30,
    onnotice: () => {},
  });
  try {
    if (mode === 'done') {
      await sql`INSERT INTO app_releases (fingerprint, release) VALUES (${f.fingerprint}, ${f.release})
        ON CONFLICT (fingerprint) DO UPDATE SET finished_at = now()`;
      return 0;
    }
    const rows = await sql`SELECT 1 FROM app_releases WHERE fingerprint = ${f.fingerprint}`;
    if (!rows.length) return 1;
    console.log(`Start-up setup already done for release ${f.release}: skipped.`);
    return 0;
  } catch (e) {
    // A new database has no app_releases yet (42P01): the setup runs and creates it. Anything
    // else (database not reachable…) also runs the setup, which then reports it.
    if (e?.code !== '42P01') console.log(`Start-up gate: ${e?.message ?? e}; running the setup.`);
    return mode === 'done' ? 0 : 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode !== 'check' && mode !== 'done') {
    console.error('Usage: node scripts/startup-gate.mjs check|done');
    process.exit(2);
  }
  process.exit(await main(mode, process.env));
}
