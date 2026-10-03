import { describe, expect, it } from 'vitest';
import {
  currentTotp,
  decrypt,
  encrypt,
  generateTotpSecret,
  hashPassword,
  keyRingFromBase64,
  sessionLifetimes,
  verifyPassword,
  verifyTotp,
} from '../src';

const keys = keyRingFromBase64(Buffer.alloc(32, 1).toString('base64'));

describe('column encryption', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = encrypt(keys.encryptionKey, '+34 600 000 000');
    const b = encrypt(keys.encryptionKey, '+34 600 000 000');
    expect(a).not.toEqual(b);
    expect(decrypt(keys.encryptionKey, a)).toBe('+34 600 000 000');
  });
  it('detects tampering', () => {
    const c = encrypt(keys.encryptionKey, 'secret');
    const parts = c.split('.');
    parts[3] = Buffer.from('other').toString('base64url');
    expect(() => decrypt(keys.encryptionKey, parts.join('.'))).toThrow();
  });
  it('rejects short master keys', () => {
    expect(() => keyRingFromBase64(Buffer.alloc(8).toString('base64'))).toThrow();
  });
});

describe('passwords', () => {
  it('hashes with argon2id and verifies', async () => {
    const h = await hashPassword('correct-horse-battery-staple');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'correct-horse-battery-staple')).toBe(true);
    expect(await verifyPassword(h, 'wrong-password-123')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('totp', () => {
  it('accepts the current code and rejects malformed ones', () => {
    const s = generateTotpSecret();
    expect(verifyTotp(s, currentTotp(s))).toBe(true);
    expect(verifyTotp(s, '12345')).toBe(false);
    expect(verifyTotp(s, 'abcdef')).toBe(false);
  });
});

describe('session lifetimes', () => {
  it('are shorter for staff than for clients', () => {
    expect(sessionLifetimes(['TRAINER']).idleMs).toBeLessThan(sessionLifetimes(['CLIENT']).idleMs);
    expect(sessionLifetimes(['CLIENT', 'ADMIN']).idleMs).toBe(sessionLifetimes(['ADMIN']).idleMs);
  });
});
