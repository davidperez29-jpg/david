import { authenticator } from 'otplib';

authenticator.options = { window: 1, step: 30, digits: 6 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20);
}

export function totpUri(secret: string, account: string, issuer = 'Training Platform'): string {
  return authenticator.keyuri(account, issuer, secret);
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}

/**
 * Time step (30 s counter) the code belongs to, or null if invalid. Callers store the last step
 * used so the same code cannot be replayed within its validity window (ASVS 2.8).
 */
export function totpMatchedStep(secret: string, code: string, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  try {
    const delta = authenticator.clone({ epoch: nowMs }).checkDelta(code, secret);
    return delta == null ? null : Math.floor(nowMs / 30_000) + delta;
  } catch {
    return null;
  }
}

export function currentTotp(secret: string): string {
  return authenticator.generate(secret);
}

/** The code at a given instant (tests and clock-skew diagnostics). */
export function totpAt(secret: string, nowMs: number): string {
  return authenticator.clone({ epoch: nowMs }).generate(secret);
}
