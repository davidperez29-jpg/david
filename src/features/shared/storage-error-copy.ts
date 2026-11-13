import {
  type StorageCategory,
  type StorageFailureInfo,
  type StorageFailureKind,
} from '@/contracts/storage';

/**
 * Textos de la página de error (B3.0). Función pura para poder probarla:
 * - **qué pasó:** el título, según el tipo de fallo y si era lectura o escritura;
 * - **qué pasó con la operación:** no cambió nada, no se aplicó o no se sabe;
 * - **qué hacer:** depende de quién lo lee.
 *
 * Quien lee condiciona el último punto. A la clienta (y en la portada) no se le dan
 * instrucciones técnicas ni rutas: se le dice que avise a su entrenador. Nunca hay rutas,
 * consultas, trazas ni datos de nadie.
 */
export type StorageErrorAudience = 'trainer' | 'client' | 'general';

export interface StorageErrorCopy {
  title: string;
  outcome: string;
  advice: string | null;
  category: string | null;
  retryLabel: string;
}

const TITLES: Record<StorageFailureKind, { read: string; write: string }> = {
  busy: { read: 'La base de datos está ocupada', write: 'La base de datos está ocupada' },
  unavailable: {
    read: 'No se puede acceder a los datos',
    write: 'No se puede acceder a los datos',
  },
  full: { read: 'No queda espacio para los datos', write: 'No queda espacio para guardar' },
  readonly: {
    read: 'La base de datos no admite cambios',
    write: 'La base de datos no admite cambios',
  },
  io: { read: 'No se han podido leer los datos', write: 'No se han podido guardar los datos' },
  corrupt: {
    read: 'La base de datos tiene un problema de integridad',
    write: 'La base de datos tiene un problema de integridad',
  },
  unexpected: { read: 'Algo no ha ido bien', write: 'No sabemos si se ha completado' },
};

const OUTCOME: Record<StorageFailureInfo['outcome'], string> = {
  none: 'No se ha modificado nada.',
  not_applied: 'La operación no se ha realizado: no se ha guardado nada.',
  unknown:
    'No se ha podido confirmar si la operación se completó. Comprueba si el cambio aparece antes de repetirlo.',
};

const CATEGORY: Record<StorageCategory, string> = {
  recoverable: 'Se puede reintentar',
  intervention: 'Necesita intervención',
  unknown: 'Resultado desconocido',
};

const PENDING_SAFE =
  'Lo que hayas registrado y esté pendiente de envío sigue guardado en este dispositivo.';

function advice(info: StorageFailureInfo, audience: StorageErrorAudience): string {
  if (info.outcome === 'unknown') {
    return 'Vuelve a la página y comprueba el estado antes de repetir la operación.';
  }
  if (audience !== 'trainer') {
    return info.kind === 'busy'
      ? `Espera unos segundos y vuelve a intentarlo. ${PENDING_SAFE}`
      : `Ahora mismo no se puede acceder a los datos. Avisa a ${
          audience === 'client' ? 'tu entrenador' : 'quien administra TrainPro'
        }. ${PENDING_SAFE}`;
  }
  switch (info.kind) {
    case 'busy':
      return 'Otro programa está usando la base de datos (por ejemplo, un visor de SQLite). Espera unos segundos y vuelve a intentarlo.';
    case 'unavailable':
      return 'La carpeta de datos ha cambiado o la está usando otro proceso. Reinicia el servidor de TrainPro; «pnpm db:status» indica qué proceso la usa.';
    case 'full':
      return 'Libera espacio en el disco y vuelve a intentarlo.';
    case 'readonly':
      return 'Comprueba los permisos de la carpeta de datos y vuelve a intentarlo.';
    case 'io':
      return 'Comprueba el disco. Si se repite, revisa la base con «pnpm db:status».';
    case 'corrupt':
      return 'Revisa la base con «pnpm db:status» y, si hace falta, restaura una copia con «pnpm db:restore». TrainPro no restaura nada automáticamente.';
    default:
      return 'Vuelve a la página y comprueba el estado antes de repetir la operación.';
  }
}

/**
 * «Volver a intentarlo» solo vuelve a LEER la página: nunca repite una escritura. Por eso, tras una
 * escritura, el botón se llama «Volver a la página» o «Comprobar el estado».
 */
function retryLabel(info: StorageFailureInfo | null): string {
  if (!info) return 'Volver a intentarlo';
  if (info.outcome === 'unknown') return 'Comprobar el estado';
  if (info.operation === 'write') return 'Volver a la página';
  return 'Volver a intentarlo';
}

export function storageErrorCopy(
  info: StorageFailureInfo | null,
  audience: StorageErrorAudience,
): StorageErrorCopy {
  if (!info) {
    return {
      title: 'Algo no ha ido bien',
      outcome:
        'Ha ocurrido un error inesperado. Si estabas guardando algo, comprueba si aparece antes de repetirlo.',
      advice: null,
      category: null,
      retryLabel: retryLabel(null),
    };
  }
  return {
    title: TITLES[info.kind][info.operation],
    outcome: OUTCOME[info.outcome],
    advice: advice(info, audience),
    category: CATEGORY[info.category],
    retryLabel: retryLabel(info),
  };
}

export const audienceOf = (pathname: string): StorageErrorAudience =>
  pathname.startsWith('/entrenador')
    ? 'trainer'
    : pathname.startsWith('/cliente')
      ? 'client'
      : 'general';
