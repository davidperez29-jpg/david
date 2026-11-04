import 'server-only';
import { isValidTimeZone } from '@/domain/time';

/** Fuentes de datos admitidas. En la Fase 1 solo existe la de demostración en memoria. */
export type DataSource = 'demo';

export interface ServerEnv {
  dataSource: DataSource;
  timeZone: string;
}

/**
 * Lee y valida la configuración del servidor. Falla al arrancar si algo no es válido,
 * en lugar de comportarse de forma imprevisible más tarde.
 */
export function readServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const dataSource = source.TRAINPRO_DATA_SOURCE?.trim() || 'demo';
  if (dataSource !== 'demo') {
    throw new Error(
      `TRAINPRO_DATA_SOURCE="${dataSource}" no está disponible: en esta fase solo se admite "demo".`,
    );
  }
  const timeZone = source.TRAINPRO_TIME_ZONE?.trim() || 'Europe/Madrid';
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`TRAINPRO_TIME_ZONE="${timeZone}" no es una zona horaria IANA válida.`);
  }
  return { dataSource, timeZone };
}
