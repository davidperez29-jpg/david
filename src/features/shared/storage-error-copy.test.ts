import { describe, expect, it } from 'vitest';
import {
  describeStorageFailure,
  STORAGE_FAILURE_KINDS,
  type StorageOperation,
} from '@/contracts/storage';
import { audienceOf, storageErrorCopy } from './storage-error-copy';

/** B3.0 · Lo que dice la página de error en cada caso, y lo que nunca dice. */
const all = STORAGE_FAILURE_KINDS.flatMap((kind) =>
  (['read', 'write'] as StorageOperation[]).map((op) => describeStorageFailure(kind, op)),
);

describe('textos de la página de error', () => {
  it('distingue recuperable, necesita intervención y resultado desconocido', () => {
    expect(storageErrorCopy(describeStorageFailure('busy', 'read'), 'trainer')).toMatchObject({
      title: 'La base de datos está ocupada',
      outcome: 'No se ha modificado nada.',
      category: 'Se puede reintentar',
      retryLabel: 'Volver a intentarlo',
    });
    expect(storageErrorCopy(describeStorageFailure('busy', 'write'), 'trainer')).toMatchObject({
      outcome: 'La operación no se ha realizado: no se ha guardado nada.',
      category: 'Se puede reintentar',
      retryLabel: 'Volver a la página',
    });
    expect(
      storageErrorCopy(describeStorageFailure('unavailable', 'read'), 'trainer'),
    ).toMatchObject({ category: 'Necesita intervención' });
    expect(storageErrorCopy(describeStorageFailure('io', 'write'), 'trainer')).toMatchObject({
      title: 'No se han podido guardar los datos',
      category: 'Resultado desconocido',
      retryLabel: 'Comprobar el estado',
    });
    expect(storageErrorCopy(describeStorageFailure('io', 'read'), 'trainer').title).toBe(
      'No se han podido leer los datos',
    );
    expect(
      storageErrorCopy(describeStorageFailure('unexpected', 'write'), 'client').outcome,
    ).toMatch(/No se ha podido confirmar si la operación se completó/);
  });

  it('nunca afirma que algo se guardó', () => {
    for (const info of all) {
      for (const audience of ['trainer', 'client', 'general'] as const) {
        const text = Object.values(storageErrorCopy(info, audience)).join(' ');
        // Afirmaciones de éxito (no «no se ha guardado nada» ni «no sabemos si se ha completado»).
        expect(text).not.toMatch(
          /(^|\. )(Se ha guardado|Guardado|Operación completada|Hecho)\b|correctamente|con éxito/,
        );
      }
    }
  });

  it('a la clienta y en la portada no hay instrucciones técnicas, rutas ni comandos', () => {
    for (const info of all) {
      for (const audience of ['client', 'general'] as const) {
        const text = Object.values(storageErrorCopy(info, audience)).join(' ');
        expect(text).not.toMatch(/pnpm|sqlite|\.data|\/home|SELECT|db:/i);
      }
    }
    expect(storageErrorCopy(describeStorageFailure('corrupt', 'read'), 'trainer').advice).toContain(
      'pnpm db:restore',
    );
    expect(storageErrorCopy(describeStorageFailure('corrupt', 'read'), 'client').advice).toContain(
      'Avisa a tu entrenador',
    );
  });

  it('sin digest de TrainPro, un error inesperado sin detalles', () => {
    expect(storageErrorCopy(null, 'trainer')).toEqual({
      title: 'Algo no ha ido bien',
      outcome:
        'Ha ocurrido un error inesperado. Si estabas guardando algo, comprueba si aparece antes de repetirlo.',
      advice: null,
      category: null,
      retryLabel: 'Volver a intentarlo',
    });
  });

  it('quién lo lee se deduce de la ruta', () => {
    expect(audienceOf('/entrenador/clientes/c-lucia')).toBe('trainer');
    expect(audienceOf('/cliente/semana')).toBe('client');
    expect(audienceOf('/')).toBe('general');
  });
});
