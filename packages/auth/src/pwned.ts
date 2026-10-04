import { createHash } from 'node:crypto';

/**
 * Breached-password check with k-anonymity (§14.1, Have I Been Pwned "range" API): only the first
 * 5 hex characters of the SHA-1 leave the server. Fails open (returns null) on network errors or
 * timeouts, so sign-up never depends on a third party; the local policy still applies.
 */
export type RangeFetcher = (prefix: string) => Promise<string>;

export async function pwnedCount(
  password: string,
  fetchRange: RangeFetcher,
): Promise<number | null> {
  const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const body = await fetchRange(prefix);
    for (const line of body.split(/\r?\n/)) {
      const [s, count] = line.trim().split(':');
      if (s === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return null;
  }
}

/** HTTP fetcher for api.pwnedpasswords.com with padding and a short timeout. */
export function hibpFetcher(timeoutMs = 2000): RangeFetcher {
  return async (prefix) => {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'training-platform' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HIBP ${res.status}`);
    return res.text();
  };
}
