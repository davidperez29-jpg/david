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
  /** AES-256-GCM key for column encryption. */
  encryptionKey: Buffer;
  /** HMAC key for pseudonymisation (derived from the master key). */
  hashKey: Buffer;
}

/** Derives the key ring from a base64 master key (APP_ENCRYPTION_KEY). */
export function keyRingFromBase64(masterB64: string | undefined): KeyRing {
  if (!masterB64) throw new Error('APP_ENCRYPTION_KEY is not set');
  const master = Buffer.from(masterB64, 'base64');
  if (master.length < 32) throw new Error('APP_ENCRYPTION_KEY must decode to at least 32 bytes');
  return {
    encryptionKey: createHmac('sha256', master).update('enc:v1').digest(),
    hashKey: createHmac('sha256', master).update('hash:v1').digest(),
  };
}
