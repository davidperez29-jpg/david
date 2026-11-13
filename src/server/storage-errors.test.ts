import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeStorageFailure,
  parseStorageDigest,
  STORAGE_FAILURE_KINDS,
  storageDigest,
} from '@/contracts/storage';
import { type TrainerActor } from '@/domain/access';
import { type TrainerContext } from './context';
import { DataLocationBusyError } from './db/lock';
import { MigrationError } from './db/migrate';
import { openSqlite } from './db/sqlite';
import { StorageUnavailableError } from './db/store';
import { seededTestDatabase } from './db/test-support';
import { DEMO_NEW_CLIENT_ID, DEMO_TRAINER_ID } from './repositories/demo/dataset';
import { createSessionDraft, getTrainerSessions } from './services/trainer-sessions';
import {
  asReadFailure,
  asWriteFailure,
  classifyStorageError,
  StorageFailureError,
  storageFailureKind,
  withStorageFailures,
} from './storage-errors';
import { runWrite, writeOutcome } from './write-operations';

/**
 * B3.0 · Errores de almacenamiento tipados (docs/BLOCK3_SPEC.md §14, ADR-34): clasificación,
 * `digest` sin datos, etiquetado en los repositorios y escrituras que no se duplican ni se
 * presentan como hechas cuando no lo están.
 */
const sqliteError = (code: string) =>
  Object.assign(new Error(`${code}: /ruta/secreta/trainpro.sqlite`), { code });

describe('clasificación', () => {
  it.each([
    ['SQLITE_BUSY', 'busy'],
    ['SQLITE_BUSY_SNAPSHOT', 'busy'],
    ['SQLITE_LOCKED', 'busy'],
    ['SQLITE_FULL', 'full'],
    ['SQLITE_READONLY', 'readonly'],
    ['SQLITE_READONLY_DBMOVED', 'readonly'],
    ['SQLITE_IOERR_READ', 'io'],
    ['SQLITE_IOERR_WRITE', 'io'],
    ['SQLITE_CANTOPEN', 'io'],
    ['SQLITE_CORRUPT', 'corrupt'],
    ['SQLITE_NOTADB', 'corrupt'],
  ])('%s → %s', (code, kind) => {
    expect(storageFailureKind(sqliteError(code))).toBe(kind);
  });

  it('base borrada o sustituida, otro proceso con ella o migraciones incompatibles', () => {
    expect(storageFailureKind(new StorageUnavailableError('x'))).toBe('unavailable');
    expect(storageFailureKind(new DataLocationBusyError('/x', null))).toBe('unavailable');
    expect(storageFailureKind(new MigrationError('x'))).toBe('corrupt');
  });

  it('lo que no es de almacenamiento no se clasifica (restricciones, programación)', () => {
    expect(storageFailureKind(sqliteError('SQLITE_CONSTRAINT_UNIQUE'))).toBeNull();
    expect(storageFailureKind(new TypeError('x'))).toBeNull();
    expect(storageFailureKind('texto')).toBeNull();
  });

  it('los códigos de la API y del constructor se conservan (ADR-29)', () => {
    expect(classifyStorageError(sqliteError('SQLITE_BUSY'))).toBe('storage_busy');
    expect(classifyStorageError(new StorageUnavailableError('x'))).toBe('storage_unavailable');
    expect(classifyStorageError(sqliteError('SQLITE_FULL'))).toBe('storage_error');
    expect(classifyStorageError(new StorageFailureError('busy', 'read'))).toBe('storage_busy');
    expect(classifyStorageError(new StorageFailureError('unexpected', 'write'))).toBeNull();
    expect(classifyStorageError(new TypeError('x'))).toBeNull();
  });
});

describe('resultado y categoría', () => {
  it('una lectura no cambia nada; una escritura no aplicada o desconocida según el tipo', () => {
    const table = STORAGE_FAILURE_KINDS.map((kind) => [
      kind,
      describeStorageFailure(kind, 'read').outcome,
      describeStorageFailure(kind, 'write').outcome,
      describeStorageFailure(kind, 'write').category,
    ]);
    expect(table).toEqual([
      ['busy', 'none', 'not_applied', 'recoverable'],
      ['unavailable', 'none', 'not_applied', 'intervention'],
      ['full', 'none', 'not_applied', 'intervention'],
      ['readonly', 'none', 'not_applied', 'intervention'],
      ['io', 'none', 'unknown', 'unknown'],
      ['corrupt', 'none', 'unknown', 'unknown'],
      ['unexpected', 'none', 'unknown', 'unknown'],
    ]);
    expect(describeStorageFailure('busy', 'read').category).toBe('recoverable');
    expect(describeStorageFailure('corrupt', 'read').category).toBe('intervention');
  });

  it('el digest solo lleva el tipo y la operación, y se lee igual en el navegador', () => {
    const error = asReadFailure(sqliteError('SQLITE_BUSY')) as StorageFailureError;
    expect(error.digest).toBe('TRAINPRO_STORAGE:busy:read');
    expect(error.digest).not.toContain('/ruta');
    expect(error.message).not.toContain('/ruta');
    expect(parseStorageDigest(error.digest)).toEqual(describeStorageFailure('busy', 'read'));
    expect(parseStorageDigest(storageDigest('io', 'write'))?.outcome).toBe('unknown');
  });

  it.each([
    undefined,
    '123456',
    'TRAINPRO_STORAGE:busy',
    'TRAINPRO_STORAGE:hack:read',
    'TRAINPRO_STORAGE:busy:delete',
    'TRAINPRO_STORAGE:busy:read:extra',
    'OTRO:busy:read',
  ])('un digest ajeno o mal formado (%s) no se interpreta', (digest) => {
    expect(parseStorageDigest(digest)).toBeNull();
  });

  it('una escritura siempre queda etiquetada; lo inesperado, con resultado desconocido', () => {
    expect(asWriteFailure(sqliteError('SQLITE_BUSY')).digest).toBe('TRAINPRO_STORAGE:busy:write');
    expect(asWriteFailure(new TypeError('x')).digest).toBe('TRAINPRO_STORAGE:unexpected:write');
    const read = new StorageFailureError('full', 'read');
    expect(asWriteFailure(read).operation).toBe('write');
  });
});

describe('repositorios con los fallos etiquetados', () => {
  const target = {
    things: {
      value: 3,
      ok(this: { value: number }) {
        return this.value;
      },
      async busy() {
        throw sqliteError('SQLITE_BUSY');
      },
      sync() {
        throw sqliteError('SQLITE_IOERR_READ');
      },
      async constraint() {
        throw sqliteError('SQLITE_CONSTRAINT_TRIGGER');
      },
    },
  };

  it('etiqueta los fallos de almacenamiento y deja intactos los demás y los resultados', async () => {
    const repos = withStorageFailures(target);
    expect(repos.things.ok()).toBe(3);
    expect(repos.things.value).toBe(3);
    await expect(repos.things.busy()).rejects.toMatchObject({ kind: 'busy', operation: 'read' });
    expect(() => repos.things.sync()).toThrow(StorageFailureError);
    const original = await target.things.constraint().catch((e: unknown) => e);
    const wrapped = await repos.things.constraint().catch((e: unknown) => e);
    expect(wrapped).not.toBeInstanceOf(StorageFailureError);
    expect((wrapped as { code: string }).code).toBe((original as { code: string }).code);
    expect(withStorageFailures(target)).toBe(repos);
  });
});

describe('escrituras de las acciones', () => {
  it('una redirección de Next.js pasa intacta; un fallo se etiqueta como escritura', async () => {
    const redirected = await runWrite('x', async () => redirect('/entrenador')).catch(
      (e: unknown) => e,
    );
    expect(redirected).not.toBeInstanceOf(StorageFailureError);
    expect(String((redirected as { digest?: string }).digest)).toMatch(/^NEXT_REDIRECT/);
    const failed = await runWrite('x', async () => {
      throw sqliteError('SQLITE_BUSY');
    }).catch((e: unknown) => e);
    expect(failed).toMatchObject({ kind: 'busy', operation: 'write' });
  });

  it('con resultado, el fallo se devuelve tipado y la redirección pasa', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await writeOutcome('x', async () => {
        throw sqliteError('SQLITE_BUSY');
      }),
    ).toEqual({ ok: false, reason: 'storage_busy' });
    expect(
      await writeOutcome('x', async () => {
        throw new TypeError('x');
      }),
    ).toEqual({ ok: false, reason: 'server_error' });
    await expect(writeOutcome('x', async () => redirect('/'))).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT/),
    });
    quiet.mockRestore();
  });
});

describe('con SQLite real y otro proceso escribiendo', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'trainpro-b30-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('base ocupada al crear: no se aplica nada, se conserva lo que había y repetir no duplica', async () => {
    const path = join(dir, 'b30.sqlite');
    const { db, repos } = seededTestDatabase('2026-11-13', { path });
    const ctx: TrainerContext = {
      actor: { role: 'trainer', trainerId: DEMO_TRAINER_ID } satisfies TrainerActor,
      today: '2026-11-13',
      timeZone: 'Europe/Madrid',
      repos: withStorageFailures(repos),
    };
    const count = () => (db.prepare('SELECT COUNT(*) AS n FROM session').get() as { n: number }).n;
    const before = count();
    const input = {
      sessionId: 's-b30-ocupada-0001',
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: '2026-11-13',
      label: 'Tarde',
      title: 'Con la base ocupada',
      focus: 'Fuerza',
      estimatedMinutes: 40,
    };
    // Otra conexión (otro «programa») reserva la escritura.
    const other = openSqlite(path);
    other.exec('BEGIN IMMEDIATE');
    const started = Date.now();
    const failed = await createSessionDraft(ctx, input).catch((e: unknown) => e);
    expect(Date.now() - started).toBeLessThan(2500);
    expect(failed).toMatchObject({ kind: 'busy', operation: 'read' });
    expect(asWriteFailure(failed).digest).toBe('TRAINPRO_STORAGE:busy:write');
    other.exec('ROLLBACK');
    other.close();
    expect(count()).toBe(before);
    // Al liberarse, repetir lo crea una vez; repetir otra vez no lo duplica.
    expect(await createSessionDraft(ctx, input)).toMatchObject({ ok: true });
    expect(await createSessionDraft(ctx, input)).toMatchObject({ ok: true });
    expect(count()).toBe(before + 1);
    const sessions = await getTrainerSessions(ctx, DEMO_NEW_CLIENT_ID);
    expect(JSON.stringify(sessions)).toContain('Con la base ocupada');
    db.close();
  });
});
