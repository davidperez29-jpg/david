import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  openSync,
  rmSync,
  statSync,
  writeSync,
  closeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BackupError,
  createBackup,
  journalFile,
  recoverInterruptedRestore,
  restoreBackup,
  type RestorePhase,
  verifyDatabaseFile,
} from './backup.ts';
import { lockDataLocation } from './lock.ts';
import { migrate } from './migrate.ts';
import { openSqlite } from './sqlite.ts';

/**
 * Restauración segura (docs/AUDIT_BLOCK1.md A-01 y A-02): interrumpida en cada fase, la base
 * activa nunca queda dañada y la recuperación la deja en el estado anterior o en el restaurado,
 * nunca en otro. Las interrupciones con un proceso real (SIGKILL) están en `concurrency.test.ts`.
 */
let dir: string;
let dbPath: string;
let backup: string;

const trainers = (file: string) => {
  const db = openSqlite(file, { readonly: true });
  try {
    return db
      .prepare('SELECT id FROM trainer ORDER BY id')
      .all<{ id: string }>()
      .map((r) => r.id);
  } finally {
    db.close();
    // Lectura de comprobación: no deja archivos auxiliares que confundan a la restauración.
    for (const s of ['-wal', '-shm']) {
      if (existsSync(`${file}${s}`) && statSync(`${file}${s}`).size === 0) rmSync(`${file}${s}`);
    }
  }
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trainpro-restaurar-'));
  dbPath = join(dir, 'trainpro.sqlite');
  const db = openSqlite(dbPath);
  migrate(db);
  db.exec("INSERT INTO trainer (id, display_name) VALUES ('t-copia', 'En la copia')");
  backup = (await createBackup(db, { label: 'prueba' })).file;
  db.exec('DELETE FROM trainer');
  db.exec("INSERT INTO trainer (id, display_name) VALUES ('t-actual', 'Estado actual')");
  db.close();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('restauración segura', () => {
  it('recupera exactamente la copia y guarda verificado el estado anterior', async () => {
    const lock = lockDataLocation(dbPath, 'pruebas');
    const result = await restoreBackup(lock, backup);
    lock.release();
    expect(trainers(dbPath)).toEqual(['t-copia']);
    expect(result.previousVerified).toBe(true);
    expect(trainers(result.previous!)).toEqual(['t-actual']);
    expect(existsSync(journalFile(dbPath))).toBe(false);
    expect(existsSync(`${dbPath}.restaurando`)).toBe(false);
    if (process.platform !== 'win32') {
      expect(statSync(result.previous!).mode & 0o777).toBe(0o600);
      expect(statSync(backup).mode & 0o777).toBe(0o600);
    }
    // Las copias son autosuficientes: sin -wal ni -shm a su lado.
    expect(existsSync(`${backup}-wal`) || existsSync(`${result.previous}-wal`)).toBe(false);
  });

  it('A-01 · tras un corte, la copia previa conserva lo confirmado que solo estaba en el WAL', async () => {
    const live = openSqlite(dbPath);
    live.exec("INSERT INTO trainer (id, display_name) VALUES ('t-wal', 'Solo en el WAL')");
    // Imagen del disco en el momento del corte: la conexión sigue abierta y el WAL sin volcar.
    const crashedDir = mkdtempSync(join(tmpdir(), 'trainpro-corte-'));
    const crashed = join(crashedDir, 'trainpro.sqlite');
    for (const s of ['', '-wal', '-shm']) {
      if (existsSync(`${dbPath}${s}`)) copyFileSync(`${dbPath}${s}`, `${crashed}${s}`);
    }
    live.close();
    expect(statSync(`${crashed}-wal`).size).toBeGreaterThan(0);

    const lock = lockDataLocation(crashed, 'pruebas');
    const result = await restoreBackup(lock, backup);
    lock.release();
    expect(trainers(crashed)).toEqual(['t-copia']);
    expect(result.previousVerified).toBe(true);
    expect(trainers(result.previous!)).toEqual(['t-actual', 't-wal']);
    rmSync(crashedDir, { recursive: true, force: true });
  });

  const expected: [RestorePhase, 'anulada' | 'completada'][] = [
    ['preparando', 'anulada'],
    ['copia-previa', 'anulada'],
    ['escribiendo', 'anulada'],
    ['escrito', 'anulada'],
    ['validando', 'anulada'],
    ['sustituyendo', 'anulada'],
    ['sustituido', 'completada'],
  ];

  it.each(expected)(
    'interrumpida en «%s»: la base activa sigue íntegra y la recuperación la deja %s',
    async (phase, outcome) => {
      const lock = lockDataLocation(dbPath, 'pruebas');
      const cut = (p: RestorePhase) => {
        if (p === phase) throw new Error('corte');
      };
      await expect(restoreBackup(lock, backup, { pause: cut })).rejects.toThrow('corte');
      // Nunca una base activa dañada, ni siquiera antes de recuperar.
      expect(() => verifyDatabaseFile(dbPath, 'La base activa')).not.toThrow();
      expect(trainers(dbPath)).toEqual(phase === 'sustituido' ? ['t-copia'] : ['t-actual']);

      expect(recoverInterruptedRestore(lock)).toBe(outcome);
      expect(trainers(dbPath)).toEqual(outcome === 'anulada' ? ['t-actual'] : ['t-copia']);
      expect(existsSync(journalFile(dbPath))).toBe(false);
      expect(existsSync(`${dbPath}.restaurando`)).toBe(false);
      // Recuperar otra vez no cambia nada.
      expect(recoverInterruptedRestore(lock)).toBe('nada');
      lock.release();
    },
  );

  it('si se interrumpe la propia recuperación, la siguiente llega al mismo resultado', async () => {
    const lock = lockDataLocation(dbPath, 'pruebas');
    await expect(
      restoreBackup(lock, backup, {
        pause: (p) => {
          if (p === 'sustituido') throw new Error('corte');
        },
      }),
    ).rejects.toThrow('corte');
    expect(() =>
      recoverInterruptedRestore(lock, {
        pause: (p) => {
          if (p === 'recuperando') throw new Error('corte en la recuperación');
        },
      }),
    ).toThrow('corte en la recuperación');
    expect(recoverInterruptedRestore(lock)).toBe('completada');
    expect(trainers(dbPath)).toEqual(['t-copia']);
    lock.release();
  });

  it('si la base sustituida resultara dañada, la recuperación vuelve a la copia previa', async () => {
    const lock = lockDataLocation(dbPath, 'pruebas');
    await expect(
      restoreBackup(lock, backup, {
        pause: (p) => {
          if (p === 'sustituido') throw new Error('corte');
        },
      }),
    ).rejects.toThrow('corte');
    // Daño deliberado de la base ya sustituida.
    const fd = openSync(dbPath, 'r+');
    writeSync(fd, Buffer.alloc(4096, 0x5a), 0, 4096, 4096);
    closeSync(fd);
    expect(recoverInterruptedRestore(lock)).toBe('revertida');
    expect(trainers(dbPath)).toEqual(['t-actual']);
    lock.release();
  });

  it('una copia dañada se rechaza antes de tocar nada (ni diario ni temporal)', async () => {
    const bad = join(dir, 'backups', 'trainpro-dañada.sqlite');
    copyFileSync(backup, bad);
    const fd = openSync(bad, 'r+');
    writeSync(fd, Buffer.alloc(8192, 0x5a), 0, 8192, 4096);
    closeSync(fd);
    const lock = lockDataLocation(dbPath, 'pruebas');
    await expect(restoreBackup(lock, bad)).rejects.toThrow(BackupError);
    expect(trainers(dbPath)).toEqual(['t-actual']);
    expect(existsSync(journalFile(dbPath))).toBe(false);
    expect(existsSync(`${dbPath}.restaurando`)).toBe(false);
    lock.release();
  });

  it('sin el bloqueo exclusivo (ya liberado) no se restaura', async () => {
    const lock = lockDataLocation(dbPath, 'pruebas');
    lock.release();
    await expect(restoreBackup(lock, backup)).rejects.toThrow(/bloqueo/);
    expect(trainers(dbPath)).toEqual(['t-actual']);
  });
});
