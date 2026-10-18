import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { startupFingerprint } from '../scripts/startup-gate.mjs';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../scripts/startup-gate.mjs',
);
const KEY = Buffer.alloc(32, 9).toString('base64');

/** Runs the gate as deploy/start.sh does; returns its exit code. */
function gate(mode: 'check' | 'done', env: Record<string, string | undefined>): number {
  const r = spawnSync(process.execPath, [SCRIPT, mode], {
    env: { PATH: process.env.PATH, DATABASE_URL: process.env.TEST_DATABASE_URL, ...env },
    encoding: 'utf8',
  });
  return r.status ?? -1;
}

describe('start-up gate (restructure phase 22: waking a free instance)', () => {
  it('the setup runs until it is recorded for this release, then wake-ups skip it', () => {
    const env = {
      APP_VERSION: `test-${randomUUID()}`,
      APP_ENCRYPTION_KEY: KEY,
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'clave-de-prueba-larga',
    };
    expect(gate('check', env)).toBe(1);
    expect(gate('done', env)).toBe(0);
    expect(gate('check', env)).toBe(0);
    expect(gate('done', env)).toBe(0);
    // A new release, a changed setting (the demo, the administrator) or a new key run it again.
    expect(gate('check', { ...env, APP_VERSION: `${env.APP_VERSION}-2` })).toBe(1);
    expect(gate('check', { ...env, DEMO_DATA: 'true' })).toBe(1);
    expect(gate('check', { ...env, ADMIN_PASSWORD: 'otra-clave-de-prueba' })).toBe(1);
    expect(
      gate('check', { ...env, APP_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64') }),
    ).toBe(1);
  });

  it('without a release id or a key the setup always runs, and nothing is recorded', () => {
    const env = { APP_ENCRYPTION_KEY: KEY, APP_VERSION: undefined, RENDER_GIT_COMMIT: undefined };
    expect(gate('done', env)).toBe(0);
    expect(gate('check', env)).toBe(1);
    expect(gate('check', { APP_VERSION: `test-${randomUUID()}` })).toBe(1);
  });

  it('a database that cannot be reached runs the setup (which reports it)', () => {
    const env = {
      APP_VERSION: `test-${randomUUID()}`,
      APP_ENCRYPTION_KEY: KEY,
      DATABASE_URL: 'postgres://nobody:wrong@127.0.0.1:1/none',
    };
    expect(gate('check', env)).toBe(1);
    expect(gate('done', env)).toBe(0);
  });

  it('the fingerprint is keyed: it never contains the settings, and it uses RENDER_GIT_COMMIT', () => {
    const f = startupFingerprint({
      RENDER_GIT_COMMIT: 'abc123',
      APP_ENCRYPTION_KEY: KEY,
      ADMIN_PASSWORD: 'clave-de-prueba-larga',
    })!;
    expect(f.release).toBe('abc123');
    expect(f.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(f.fingerprint).not.toContain('clave');
    expect(startupFingerprint({ APP_ENCRYPTION_KEY: KEY })).toBeNull();
  });
});
