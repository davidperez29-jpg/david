import 'server-only';
import {
  storageFromEnv,
  MemoryMailer,
  type AppContext,
  type FileStorage,
  type Mailer,
} from '@tp/application';
import { hibpFetcher, keyedHash, keyRingFromBase64, type KeyRing } from '@tp/auth';
import { createDb, type DbHandle } from '@tp/db';
import { randomUUID } from 'node:crypto';

/**
 * Process-wide singletons. Kept on globalThis so Next.js dev hot-reload does not open a new
 * connection pool on every change.
 */
const g = globalThis as unknown as {
  __tp?: { db: DbHandle; keys: KeyRing; mailer: Mailer; storage: FileStorage };
};

function singletons() {
  if (!g.__tp) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    g.__tp = {
      db: createDb(url),
      keys: keyRingFromBase64(
        process.env.APP_ENCRYPTION_KEY,
        process.env.APP_ENCRYPTION_KEYS_PREVIOUS,
      ),
      // No email provider configured yet (Phase 1): messages are kept in memory and logged in dev.
      mailer: new DevMailer(),
      // S3-compatible bucket (EU) when S3_BUCKET is set; local disk otherwise (OPERATIONS.md).
      storage: storageFromEnv(process.env, `${process.cwd()}/.data/files`),
    };
  }
  return g.__tp;
}

class DevMailer extends MemoryMailer {
  override async send(message: { to: string; subject: string; text: string }): Promise<void> {
    await super.send(message);
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[dev-mailer] to=${message.to} subject="${message.subject}"\n${message.text}`);
    }
  }
}

export function baseContext(meta: { ip?: string | null; requestId?: string } = {}): AppContext {
  const s = singletons();
  return {
    db: s.db.db,
    keys: s.keys,
    mailer: s.mailer,
    storage: s.storage,
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    now: () => new Date(),
    requestId: meta.requestId ?? randomUUID(),
    ipHash: meta.ip ? keyedHash(s.keys.hashKey, meta.ip) : null,
    // §14.1 breached-password check (k-anonymity, HIBP); opt-in because it needs outbound HTTPS.
    ...(process.env.PWNED_PASSWORDS_CHECK === 'on' ? { pwnedPasswords: hibpFetcher() } : {}),
  };
}

export function hashUserAgent(ua: string | null): string | null {
  return ua ? keyedHash(singletons().keys.hashKey, ua) : null;
}
