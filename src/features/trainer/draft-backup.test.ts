import { describe, expect, it } from 'vitest';
import { type SessionContent } from '@/domain/training/session-v2';
import {
  draftBackupKey,
  type KeyValueStore,
  readDraftBackup,
  removeDraftBackup,
  writeDraftBackup,
} from './draft-backup';

/** Copia local de un borrador (A-07): separada por persona, cliente y sesión. */
const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};
const content = (title: string): SessionContent =>
  ({ schema: 1, title, items: [] }) as unknown as SessionContent;

describe('copia local del borrador', () => {
  it('se recupera solo con la misma identidad, cliente y sesión', () => {
    const store = memory();
    writeDraftBackup(store, 'c-lucia', 'ses-1', {
      trainerId: 't-alex',
      content: content('Fuerza'),
      baseRevision: 3,
      savedAt: '2026-11-13T10:00:00.000Z',
    });
    expect(readDraftBackup(store, 't-alex', 'c-lucia', 'ses-1')?.content.title).toBe('Fuerza');
    // Otra persona en el mismo dispositivo, otro cliente u otra sesión: nada.
    expect(readDraftBackup(store, 't-otra', 'c-lucia', 'ses-1')).toBeNull();
    expect(readDraftBackup(store, 't-alex', 'c-marta', 'ses-1')).toBeNull();
    expect(readDraftBackup(store, 't-alex', 'c-lucia', 'ses-2')).toBeNull();
  });

  it('una copia manipulada para otra identidad no se ofrece', () => {
    const store = memory();
    store.setItem(
      draftBackupKey('t-alex', 'c-lucia', 'ses-1'),
      JSON.stringify({
        trainerId: 't-otra',
        content: content('Ajena'),
        baseRevision: 1,
        savedAt: '',
      }),
    );
    expect(readDraftBackup(store, 't-alex', 'c-lucia', 'ses-1')).toBeNull();
  });

  it('sin almacén o con datos corruptos no falla: no hay copia', () => {
    const broken: KeyValueStore = {
      getItem: () => '{no es json',
      setItem: () => {
        throw new Error('Sin espacio');
      },
      removeItem: () => {
        throw new Error('Bloqueado');
      },
    };
    expect(readDraftBackup(broken, 't-alex', 'c-lucia', 'ses-1')).toBeNull();
    expect(
      writeDraftBackup(broken, 'c-lucia', 'ses-1', {
        trainerId: 't-alex',
        content: content('x'),
        baseRevision: 1,
        savedAt: '',
      }),
    ).toBe(false);
    expect(() => removeDraftBackup(broken, 't-alex', 'c-lucia', 'ses-1')).not.toThrow();
    expect(readDraftBackup(null, 't-alex', 'c-lucia', 'ses-1')).toBeNull();
  });
});
