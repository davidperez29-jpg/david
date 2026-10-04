import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  encrypt,
  generateRecoveryCodes,
  hashRecoveryCode,
  keyRingFromBase64,
  looksLikeRecoveryCode,
  openSecret,
  openSecretWithKey,
  pwnedCount,
} from '../src';

describe('key rotation (§14: column encryption)', () => {
  it('reads values written with a previous master key; never with an unknown one', () => {
    const oldMaster = randomBytes(32).toString('base64');
    const newMaster = randomBytes(32).toString('base64');
    const old = keyRingFromBase64(oldMaster);
    const sealed = encrypt(old.encryptionKey, '+34 600 000 000');
    const rotated = keyRingFromBase64(newMaster, oldMaster);
    expect(openSecretWithKey(rotated, sealed)).toEqual({
      plaintext: '+34 600 000 000',
      current: false,
    });
    expect(openSecretWithKey(rotated, encrypt(rotated.encryptionKey, 'x'))).toEqual({
      plaintext: 'x',
      current: true,
    });
    expect(() => openSecret(keyRingFromBase64(newMaster), sealed)).toThrow();
  });
});

describe('2FA recovery codes', () => {
  it('10 distinct XXXX-XXXX codes; hash ignores case and dashes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((c) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c))).toBe(true);
    expect(hashRecoveryCode(codes[0]!.toLowerCase().replace('-', ' '))).toBe(
      hashRecoveryCode(codes[0]!),
    );
    expect(looksLikeRecoveryCode(codes[0]!)).toBe(true);
    expect(looksLikeRecoveryCode('123456')).toBe(false);
  });
});

describe('breached passwords with k-anonymity', () => {
  it('sends only the 5-char SHA-1 prefix and finds the suffix in the range', async () => {
    const sha = createHash('sha1').update('password123!').digest('hex').toUpperCase();
    const seen: string[] = [];
    const count = await pwnedCount('password123!', async (prefix) => {
      seen.push(prefix);
      return `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${sha.slice(5)}:4521\r\nFFFF:0`;
    });
    expect(seen).toEqual([sha.slice(0, 5)]);
    expect(count).toBe(4521);
    expect(await pwnedCount('another', async () => 'ABC:1')).toBe(0);
    // Fails open: no network, no blocking.
    expect(await pwnedCount('x', async () => Promise.reject(new Error('offline')))).toBeNull();
  });
});
