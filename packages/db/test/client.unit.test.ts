import { describe, expect, it } from 'vitest';
import { normalizeDatabaseUrl } from '../src/client';

describe('normalizeDatabaseUrl (restructure phase 22: Neon free plan)', () => {
  it('keeps sslmode and drops the libpq-only channel_binding', () => {
    const url = normalizeDatabaseUrl(
      'postgresql://neondb_owner:secret@ep-cool-sun-a1b2c3d4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    );
    const u = new URL(url);
    expect(u.searchParams.get('sslmode')).toBe('require');
    expect(u.searchParams.has('channel_binding')).toBe(false);
    expect(u.password).toBe('secret');
  });

  it('uses the direct Neon host instead of the pooler', () => {
    const url = normalizeDatabaseUrl(
      'postgresql://u:p@ep-cool-sun-a1b2c3d4-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    );
    expect(new URL(url).hostname).toBe('ep-cool-sun-a1b2c3d4.eu-central-1.aws.neon.tech');
  });

  it('leaves other hosts and plain URLs as they are', () => {
    expect(normalizeDatabaseUrl('postgres://app:app@localhost:5432/app')).toBe(
      'postgres://app:app@localhost:5432/app',
    );
    expect(new URL(normalizeDatabaseUrl('postgres://u:p@db-pooler.example.com/x')).hostname).toBe(
      'db-pooler.example.com',
    );
  });

  it('keeps special characters of the password', () => {
    const url = normalizeDatabaseUrl(
      'postgres://u:p%40ss%2Fw@host.neon.tech/db?channel_binding=prefer',
    );
    expect(decodeURIComponent(new URL(url).password)).toBe('p@ss/w');
    expect(url).not.toContain('channel_binding');
  });
});
