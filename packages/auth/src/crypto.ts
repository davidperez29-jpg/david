import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

/** Opaque random token, base64url (default 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed hash for pseudonymising IPs/emails in security tables and logs. */
export function keyedHash(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(key: Buffer, plaintext: string): string {
  if (key.length !== 32) throw new Error('encryption key must be 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(
    '.',
  );
}

export function decrypt(key: Buffer, payload: string): string {
  const [v, iv, tag, ct] = payload.split('.');
  if (v !== 'v1' || !iv || !tag || ct === undefined) throw new Error('invalid ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString(
    'utf8',
  );
}

export interface KeyRing {
  /** AES-256-GCM key for column encryption (current master key). */
  encryptionKey: Buffer;
  /** HMAC key for pseudonymisation (derived from the master key). */
  hashKey: Buffer;
  /**
   * Encryption keys of previous master keys (APP_ENCRYPTION_KEYS_PREVIOUS), only to read values
   * written before a rotation until `pnpm keys:rotate` re-encrypts them (Phase 13).
   */
  previousEncryptionKeys?: Buffer[];
}

function masterFrom(b64: string, name: string): Buffer {
  const master = Buffer.from(b64.trim(), 'base64');
  if (master.length < 32) throw new Error(`${name} must decode to at least 32 bytes`);
  return master;
}

/** Derives the key ring from a base64 master key (APP_ENCRYPTION_KEY) and optional old ones. */
export function keyRingFromBase64(masterB64: string | undefined, previousB64?: string): KeyRing {
  if (!masterB64) throw new Error('APP_ENCRYPTION_KEY is not set');
  const master = masterFrom(masterB64, 'APP_ENCRYPTION_KEY');
  return {
    encryptionKey: createHmac('sha256', master).update('enc:v1').digest(),
    hashKey: createHmac('sha256', master).update('hash:v1').digest(),
    previousEncryptionKeys: (previousB64 ?? '')
      .split(',')
      .filter((x) => x.trim())
      .map((k) =>
        createHmac('sha256', masterFrom(k, 'APP_ENCRYPTION_KEYS_PREVIOUS'))
          .update('enc:v1')
          .digest(),
      ),
  };
}

/**
 * Decrypts with the current key or, after a rotation, with a previous one (AES-GCM authenticates,
 * so a wrong key fails instead of returning garbage). Returns which key opened it.
 */
export function openSecret(ring: KeyRing, payload: string): string {
  return openSecretWithKey(ring, payload).plaintext;
}

export function openSecretWithKey(
  ring: KeyRing,
  payload: string,
): { plaintext: string; current: boolean } {
  try {
    return { plaintext: decrypt(ring.encryptionKey, payload), current: true };
  } catch (first) {
    for (const k of ring.previousEncryptionKeys ?? []) {
      try {
        return { plaintext: decrypt(k, payload), current: false };
      } catch {
        /* next key */
      }
    }
    throw first;
  }
}
