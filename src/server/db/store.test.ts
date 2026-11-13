import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { DEMO_NEW_CLIENT_ID, DEMO_TRAINER_ID } from '../repositories/demo/dataset';
import { verifyDatabaseFile } from './backup.ts';
import { databaseFile } from './location.ts';
import { lockState } from './lock.ts';
import {
  backupStore,
  closeAllStores,
  getStore,
  listStoreBackups,
  resetStore,
  StorageUnavailableError,
} from './store';

/** El almacén de la aplicación sobre archivos reales (B1-02, B1-04, B1-10). */
const root = mkdtempSync(join(tmpdir(), 'trainpro-almacen-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
afterEach(() => closeAllStores());

let n = 0;
const options = (patch: { space?: string | null; today?: string } = {}) => ({
  dataDir: join(root, `datos-${n}`),
  space: patch.space ?? null,
  today: patch.today ?? '2026-11-04',
  timeZone: 'Europe/Madrid',
});
const fresh = () => {
  n += 1;
  return options();
};

const lucia = (id: string) => ({
  id,
  clientId: DEMO_NEW_CLIENT_ID,
  trainerId: DEMO_TRAINER_ID,
  plannedDate: '2026-11-10',
  dayOrder: 1,
  status: 'draft' as const,
  currentVersion: null,
  draft: {
    schema: 1 as const,
    plannedDate: '2026-11-10',
    dayOrder: 1,
    title: 'Primera sesión',
    focus: '',
    items: [],
  },
  draftBaseVersion: null,
  draftRevision: 0,
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
});

describe('almacén SQLite de la aplicación', () => {
  it('la primera vez crea, migra y siembra la base en la carpeta de datos', async () => {
    const opts = fresh();
    const store = getStore(opts);
    expect(store.path).toBe(join(opts.dataDir, 'trainpro.sqlite'));
    expect(store.seedDate).toBe('2026-11-04');
    expect(existsSync(store.path)).toBe(true);
    expect(await store.repos.clients.getById(DEMO_NEW_CLIENT_ID)).toMatchObject({
      displayName: 'Lucía Gil',
    });
    // Misma conexión en las peticiones siguientes (también tras la recarga en caliente).
    expect(getStore(opts)).toBe(store);
  });

  it.skipIf(process.platform === 'win32')('el archivo solo lo puede leer su usuario (600)', () => {
    const store = getStore(fresh());
    expect(statSync(store.path).mode & 0o777).toBe(0o600);
  });

  it('toma la base en exclusiva (bloqueo del sistema) y la libera al cerrar', () => {
    const store = getStore(fresh());
    expect(lockState(store.path)).toMatchObject({ held: true, holder: { pid: process.pid } });
    closeAllStores();
    expect(lockState(store.path).held).toBe(false);
  });

  it('si la base o su bloqueo se borran por fuera, deja de escribir en lugar de perder datos', async () => {
    const opts = fresh();
    const store = getStore(opts);
    rmSync(store.path);
    expect(() => getStore(opts)).toThrow(StorageUnavailableError);
    closeAllStores();
    const again = getStore(opts);
    rmSync(`${again.path}.lock`);
    expect(() => getStore(opts)).toThrow(/bloqueo/);
  });

  it('al reabrir (reinicio) conserva los datos y la fecha de la semilla, aunque cambie el día', async () => {
    const opts = fresh();
    await getStore(opts).repos.training.createDraft(lucia('ses-1'));
    closeAllStores();
    const reopened = getStore({ ...opts, today: '2026-11-20' });
    expect(reopened.seedDate).toBe('2026-11-04');
    expect(await reopened.repos.training.getSession('ses-1')).toMatchObject({ status: 'draft' });
  });

  it('cada espacio de pruebas es un archivo aparte, sembrado al primer uso', async () => {
    const opts = fresh();
    const a = getStore({ ...opts, space: 'prueba-a' });
    const b = getStore({ ...opts, space: 'prueba-b' });
    expect(a.path).toBe(databaseFile(opts.dataDir, 'prueba-a'));
    await a.repos.training.createDraft(lucia('ses-solo-en-a'));
    expect(await b.repos.training.getSession('ses-solo-en-a')).toBeNull();
    expect(await getStore(opts).repos.training.getSession('ses-solo-en-a')).toBeNull();
    expect(() => getStore({ ...opts, space: '../fuera' })).toThrow(/no válido/);
  });

  it('una copia manual queda verificada en backups/', async () => {
    const opts = fresh();
    getStore(opts);
    const backup = await backupStore(opts);
    expect(backup.file).toBe(join(opts.dataDir, 'backups', backup.name));
    expect(backup.name).toMatch(/^trainpro-\d{8}-\d{6}-manual\.sqlite$/);
    expect(() => verifyDatabaseFile(backup.file)).not.toThrow();
    expect(listStoreBackups(opts).map((b) => b.name)).toContain(backup.name);
  });

  it('restablecer guarda una copia y vuelve a sembrar con la fecha de hoy', async () => {
    const opts = fresh();
    await getStore(opts).repos.training.createDraft(lucia('ses-1'));
    const { backup, store } = resetStore({ ...opts, today: '2026-11-09' });
    expect(backup.name).toMatch(/antes-de-restablecer/);
    expect(store.seedDate).toBe('2026-11-09');
    expect(await store.repos.training.getSession('ses-1')).toBeNull();
    expect(getStore(opts)).toBe(store);
    // La copia conserva lo que había.
    const { openSqlite } = await import('./sqlite.ts');
    const copy = openSqlite(backup.file, { readonly: true });
    expect(copy.prepare("SELECT id FROM session WHERE id = 'ses-1'").get()).toEqual({
      id: 'ses-1',
    });
    copy.close();
  });
});
