import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBackup, journalFile, RESTORE_PHASES, verifyDatabaseFile } from './backup.ts';
import {
  DataLocationBusyError,
  holderFile,
  lockDataLocation,
  lockState,
  readHolder,
} from './lock.ts';
import { migrate } from './migrate.ts';
import { openSqlite } from './sqlite.ts';

/**
 * Exclusividad y restauración con PROCESOS REALES (docs/AUDIT_BLOCK1.md A-02, A-03 y A-04):
 * otro proceso tiene el bloqueo, se mata con SIGKILL en un punto exacto (punto de pausa de
 * `scripts/db.ts`) y se comprueba el estado que queda en el disco.
 */
const ROOT = resolve(__dirname, '../../..');
const DB_CLI = join(ROOT, 'scripts/db.ts');
const LOCK_MODULE = join(ROOT, 'src/server/db/lock.ts');

let dir: string;
let dbPath: string;
let backupName: string;
const children = new Set<ChildProcess>();

const trainers = (file: string) => {
  const db = openSqlite(file, { readonly: true });
  try {
    return db
      .prepare('SELECT id FROM trainer ORDER BY id')
      .all<{ id: string }>()
      .map((r) => r.id);
  } finally {
    db.close();
    for (const s of ['-wal', '-shm']) {
      if (existsSync(`${file}${s}`) && statSync(`${file}${s}`).size === 0) rmSync(`${file}${s}`);
    }
  }
};

/** Un proceso que toma la base en exclusiva y la mantiene hasta que se le mata. */
function holdLock(path: string): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { lockDataLocation } from ${JSON.stringify(LOCK_MODULE)};
       lockDataLocation(process.argv[1], 'servidor');
       process.stdout.write('LISTO\\n');
       setInterval(() => {}, 1000);`,
      path,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  children.add(child);
  return new Promise((resolveReady, reject) => {
    let out = '';
    child.stdout!.on('data', (d) => {
      out += d;
      if (out.includes('LISTO')) resolveReady(child);
    });
    child.stderr!.on('data', (d) => (out += d));
    child.once('exit', (code) =>
      reject(new Error(`El proceso del bloqueo terminó (${code}): ${out}`)),
    );
  });
}

async function kill(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((r) => child.once('exit', r));
  child.kill('SIGKILL');
  await exited;
}

/** `node scripts/db.ts …` con la carpeta de datos de la prueba. */
function dbCli(args: string[], env: Record<string, string> = {}) {
  return spawn(process.execPath, [DB_CLI, ...args], {
    cwd: ROOT,
    env: { ...process.env, TRAINPRO_DATA_DIR: dir, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function dbCliSync(args: string[]) {
  const r = spawnSync(process.execPath, [DB_CLI, ...args], {
    cwd: ROOT,
    env: { ...process.env, TRAINPRO_DATA_DIR: dir },
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** Arranca una restauración, espera a que llegue a `phase` y la mata con SIGKILL. */
async function killRestoreAt(phase: string, args = ['restore', backupName]) {
  const child = dbCli(args, { TRAINPRO_TEST_PAUSE_AT: phase });
  children.add(child);
  let out = '';
  await new Promise<void>((resolvePause, reject) => {
    child.stdout!.on('data', (d) => {
      out += d;
      if (out.includes(`PAUSA ${phase}`)) resolvePause();
    });
    child.stderr!.on('data', (d) => (out += d));
    child.once('exit', (code) => reject(new Error(`Terminó antes de la pausa (${code}): ${out}`)));
  });
  child.removeAllListeners('exit');
  await kill(child);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'trainpro-concurrencia-'));
  dbPath = join(dir, 'trainpro.sqlite');
  const db = openSqlite(dbPath);
  migrate(db);
  db.exec("INSERT INTO trainer (id, display_name) VALUES ('t-copia', 'En la copia')");
  backupName = (await createBackup(db, { label: 'prueba' })).name;
  db.exec('DELETE FROM trainer');
  db.exec("INSERT INTO trainer (id, display_name) VALUES ('t-actual', 'Estado actual')");
  db.close();
});
afterEach(async () => {
  for (const child of children) await kill(child);
  children.clear();
  rmSync(dir, { recursive: true, force: true });
});

describe('A-03/A-04 · un solo proceso por base', () => {
  it('un segundo proceso no puede tomar la base; sabe quién la tiene y no le quita el bloqueo', async () => {
    const holder = await holdLock(dbPath);
    expect(() => lockDataLocation(dbPath, 'servidor')).toThrow(DataLocationBusyError);
    try {
      lockDataLocation(dbPath, 'servidor');
    } catch (error) {
      expect((error as DataLocationBusyError).holder).toMatchObject({
        pid: holder.pid,
        role: 'servidor',
      });
      expect((error as Error).message).toContain(`proceso ${holder.pid}`);
    }
    // El intento fallido no borra nada del titular.
    expect(lockState(dbPath)).toMatchObject({ held: true, holder: { pid: holder.pid } });
    expect(existsSync(holderFile(dbPath))).toBe(true);
  });

  it('db:restore se niega mientras otro proceso tiene la base, y la base no cambia', async () => {
    const holder = await holdLock(dbPath);
    const r = dbCliSync(['restore', backupName]);
    expect(r.code).toBe(1);
    expect(r.out).toContain(`proceso ${holder.pid}`);
    expect(trainers(dbPath)).toEqual(['t-actual']);
    expect(lockState(dbPath).held).toBe(true);
    expect(dbCliSync(['status']).out).toContain(`proceso ${holder.pid}`);
  });

  it('si el titular muere (SIGKILL), el bloqueo queda libre sin borrar nada a mano', async () => {
    const holder = await holdLock(dbPath);
    await kill(holder);
    // Su información queda en disco (desactualizada) pero no decide nada.
    expect(readHolder(dbPath)?.pid).toBe(holder.pid);
    expect(lockState(dbPath).held).toBe(false);
    const lock = lockDataLocation(dbPath, 'servidor');
    expect(readHolder(dbPath)?.pid).toBe(process.pid);
    lock.release();
  });
});

describe('A-02 · restauración interrumpida con SIGKILL en cada fase', () => {
  const restorePhases = RESTORE_PHASES.filter((p) => p !== 'recuperando');

  it.each(restorePhases)('corte en «%s»: base íntegra y recuperación coherente', async (phase) => {
    await killRestoreAt(phase);
    // La base activa nunca queda dañada, ni antes de recuperar.
    expect(() => verifyDatabaseFile(dbPath, 'La base activa')).not.toThrow();
    const before = trainers(dbPath);
    expect(before).toEqual(phase === 'sustituido' ? ['t-copia'] : ['t-actual']);
    // El bloqueo del proceso muerto no estorba: la recuperación lo toma.
    const r = dbCliSync(['recover']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(phase === 'sustituido' ? /da por terminada/ : /se anuló/);
    expect(trainers(dbPath)).toEqual(before);
    expect(existsSync(journalFile(dbPath))).toBe(false);
    expect(existsSync(`${dbPath}.restaurando`)).toBe(false);
  });

  it('corte durante la propia recuperación: la siguiente termina igual', async () => {
    await killRestoreAt('sustituido');
    await killRestoreAt('recuperando', ['recover']);
    const r = dbCliSync(['recover']);
    expect(r.code).toBe(0);
    expect(trainers(dbPath)).toEqual(['t-copia']);
    expect(existsSync(journalFile(dbPath))).toBe(false);
  });

  it('una restauración nueva termina antes la interrumpida', async () => {
    await killRestoreAt('escrito');
    const r = dbCliSync(['restore', backupName]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('se recuperó una restauración interrumpida: anulada');
    expect(trainers(dbPath)).toEqual(['t-copia']);
  });
});
