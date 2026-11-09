import 'server-only';
import { isValidTimeZone } from '@/domain/time';
import { resolveDataDir } from './db/location.ts';
import { parseAllowedHosts } from './host-guard';

/**
 * Fuente de datos. Desde V1, SQLite local (P-85). El almacén en memoria de la Fase 1 queda solo
 * como referencia de las pruebas de equivalencia.
 */
export type DataSource = 'sqlite';

/** Modo de funcionamiento. Solo existe el prototipo local con identidades de demostración. */
export type AppMode = 'local-demo';

export interface ServerEnv {
  dataSource: DataSource;
  timeZone: string;
  /** Carpeta absoluta de la base de datos (`TRAINPRO_DATA_DIR`, por defecto `.data`). */
  dataDir: string;
  /**
   * `local-demo` habilita «Entrar como…» (P-76, P-87). Sin él no hay ninguna identidad: no existe
   * autenticación real hasta la Fase 2, así que las áreas privadas no son accesibles.
   */
  mode: AppMode | null;
  /** Espacios aislados para las E2E (`TRAINPRO_DEMO_SPACES=on`, solo en `local-demo`). */
  demoSpaces: boolean;
  /** Nombres de host aceptados en la cabecera `Host` (protección frente a DNS rebinding). */
  allowedHosts: string[];
}

/**
 * Lee y valida la configuración del servidor. Falla al arrancar si algo no es válido,
 * en lugar de comportarse de forma imprevisible más tarde.
 */
export function readServerEnv(
  source: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
): ServerEnv {
  const dataSource = source.TRAINPRO_DATA_SOURCE?.trim() || 'sqlite';
  if (dataSource === 'demo') {
    throw new Error(
      'TRAINPRO_DATA_SOURCE="demo" (datos en memoria) se sustituyó por "sqlite" en V1. Quita la variable o pon "sqlite".',
    );
  }
  if (dataSource !== 'sqlite') {
    throw new Error(
      `TRAINPRO_DATA_SOURCE="${dataSource}" no está disponible: en esta fase solo se admite "sqlite".`,
    );
  }

  const timeZone = source.TRAINPRO_TIME_ZONE?.trim() || 'Europe/Madrid';
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`TRAINPRO_TIME_ZONE="${timeZone}" no es una zona horaria IANA válida.`);
  }

  const rawMode = source.TRAINPRO_MODE?.trim() || '';
  if (rawMode !== '' && rawMode !== 'local-demo') {
    throw new Error(`TRAINPRO_MODE="${rawMode}" no existe: el único modo es "local-demo".`);
  }
  const mode: AppMode | null = rawMode === 'local-demo' ? 'local-demo' : null;

  const rawSpaces = source.TRAINPRO_DEMO_SPACES?.trim() || 'off';
  if (rawSpaces !== 'on' && rawSpaces !== 'off') {
    throw new Error(`TRAINPRO_DEMO_SPACES="${rawSpaces}" debe ser "on" u "off".`);
  }
  const demoSpaces = rawSpaces === 'on';
  if (demoSpaces && mode !== 'local-demo') {
    throw new Error('TRAINPRO_DEMO_SPACES=on solo se admite con TRAINPRO_MODE=local-demo.');
  }

  const allowedHosts = parseAllowedHosts(source.TRAINPRO_ALLOWED_HOSTS);

  return {
    dataSource,
    timeZone,
    dataDir: resolveDataDir(source.TRAINPRO_DATA_DIR, cwd),
    mode,
    demoSpaces,
    allowedHosts,
  };
}
