import { randomInt } from 'node:crypto';
import { sha256 } from './crypto';

/** No 0/O, 1/I/L: codes are read and typed by people. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** One-time 2FA recovery codes (§14.1): 10 × XXXX-XXXX (~80 bits each). Only hashes are stored. */
export function generateRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const c = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    return `${c.slice(0, 4)}-${c.slice(4)}`;
  });
}

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return sha256(`recovery:${normalizeRecoveryCode(code)}`);
}

/** A recovery code looks like XXXX-XXXX (a TOTP code is 6 digits). */
export function looksLikeRecoveryCode(input: string): boolean {
  return normalizeRecoveryCode(input).length === 8 && !/^\d+$/.test(input.trim());
}
