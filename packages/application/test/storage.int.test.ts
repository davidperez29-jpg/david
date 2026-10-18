import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DatabaseStorage, S3Storage, storageFromEnv, LocalDiskStorage } from '../src';
import { testDb } from './fixtures';

/**
 * Object storage against a real S3-compatible server (CI starts one; locally set S3_TEST_ENDPOINT,
 * S3_TEST_BUCKET, S3_TEST_ACCESS_KEY_ID and S3_TEST_SECRET_ACCESS_KEY). Skipped otherwise.
 */
const E = process.env;
const cfg = {
  endpoint: E.S3_TEST_ENDPOINT ?? '',
  region: E.S3_TEST_REGION ?? 'us-east-1',
  bucket: E.S3_TEST_BUCKET ?? '',
  accessKeyId: E.S3_TEST_ACCESS_KEY_ID ?? '',
  secretAccessKey: E.S3_TEST_SECRET_ACCESS_KEY ?? '',
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe.skipIf(!cfg.endpoint)('S3-compatible storage (signed requests, real server)', () => {
  it('put, get, delete; missing objects read as null and delete without error', async () => {
    const s = new S3Storage(cfg);
    const key = `test/${randomUUID()}.png`;
    await s.put(key, PNG, 'image/png');
    expect(Array.from((await s.get(key))!)).toEqual(Array.from(PNG));
    await s.delete(key);
    expect(await s.get(key)).toBeNull();
    await s.delete(key);
  });

  it('a wrong secret is refused by the server; bad keys never leave the app', async () => {
    const bad = new S3Storage({ ...cfg, secretAccessKey: 'wrong' });
    await expect(bad.put(`test/${randomUUID()}.png`, PNG, 'image/png')).rejects.toThrow(
      /PUT failed/,
    );
    await expect(new S3Storage(cfg).get('../etc/passwd.png')).rejects.toThrow(
      /invalid storage key/,
    );
  });
});

describe('files in the database (FILE_STORAGE=database, restructure phase 22)', () => {
  it('put, get, delete; missing files read as null and delete without error', async () => {
    const s = new DatabaseStorage(testDb().db);
    const key = `test/${randomUUID()}.png`;
    await s.put(key, PNG, 'image/png');
    expect(Array.from((await s.get(key))!)).toEqual(Array.from(PNG));
    await expect(s.put(key, PNG, 'image/png')).rejects.toThrow();
    await s.delete(key);
    expect(await s.get(key)).toBeNull();
    await s.delete(key);
  });

  it('refuses keys the app does not generate', async () => {
    const s = new DatabaseStorage(testDb().db);
    await expect(s.get('../etc/passwd.png')).rejects.toThrow(/invalid storage key/);
    await expect(s.put('x.svg', PNG, 'image/svg+xml')).rejects.toThrow(/invalid storage key/);
  });
});

describe('storage selection from the environment', () => {
  it('the database with FILE_STORAGE=database, which needs the connection', () => {
    expect(storageFromEnv({ FILE_STORAGE: 'database' }, '/tmp/x', testDb().db)).toBeInstanceOf(
      DatabaseStorage,
    );
    expect(() => storageFromEnv({ FILE_STORAGE: 'database' }, '/tmp/x')).toThrow(
      /needs the database/,
    );
  });

  it('S3 when S3_BUCKET is set (and complete), local disk otherwise', () => {
    expect(storageFromEnv({}, '/tmp/x')).toBeInstanceOf(LocalDiskStorage);
    expect(() => storageFromEnv({ S3_BUCKET: 'b' }, '/tmp/x')).toThrow(/S3_ENDPOINT/);
    expect(
      storageFromEnv(
        {
          S3_BUCKET: 'b',
          S3_ENDPOINT: 'https://s3.example',
          S3_ACCESS_KEY_ID: 'a',
          S3_SECRET_ACCESS_KEY: 's',
        },
        '/tmp/x',
      ),
    ).toBeInstanceOf(S3Storage);
  });
});
