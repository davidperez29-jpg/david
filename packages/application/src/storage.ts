import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Storage port for binary files (silhouettes, images, reports). S3-compatible adapter later. */
export interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  /** Erasure (RGPD art. 17): removing a missing key is not an error. */
  delete(key: string): Promise<void>;
}

export class MemoryStorage implements FileStorage {
  private readonly files = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.files.set(key, bytes);
  }
  async get(key: string): Promise<Uint8Array | null> {
    return this.files.get(key) ?? null;
  }
  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }
}

/** Local disk adapter for single-server deployments and development. */
export class LocalDiskStorage implements FileStorage {
  constructor(private readonly root: string) {}
  private resolve(key: string): string {
    if (!/^[a-z0-9/_-]+\.(png|jpg|webp)$/.test(key)) throw new Error('invalid storage key');
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep))
      throw new Error('invalid storage key');
    return full;
  }
  async put(key: string, bytes: Uint8Array): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes, { flag: 'wx' });
  }
  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Detects the real image type from magic bytes (the declared Content-Type is not trusted).
 * SVG is deliberately not accepted: it can carry scripts.
 */
export function sniffImage(
  bytes: Uint8Array,
): { contentType: string; ext: 'png' | 'jpg' | 'webp' } | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { contentType: 'image/png', ext: 'png' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { contentType: 'image/jpeg', ext: 'jpg' };
  if (
    b.length > 12 &&
    String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === 'RIFF' &&
    String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === 'WEBP'
  ) {
    return { contentType: 'image/webp', ext: 'webp' };
  }
  return null;
}
