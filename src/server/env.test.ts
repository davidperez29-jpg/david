import { describe, expect, it } from 'vitest';
import { readServerEnv } from './env';

describe('configuración del servidor', () => {
  it('usa valores por defecto seguros', () => {
    expect(readServerEnv({})).toEqual({ dataSource: 'demo', timeZone: 'Europe/Madrid' });
  });

  it('rechaza fuentes de datos que aún no existen', () => {
    expect(() => readServerEnv({ TRAINPRO_DATA_SOURCE: 'postgres' })).toThrow(
      /solo se admite "demo"/,
    );
  });

  it('rechaza zonas horarias no válidas', () => {
    expect(() => readServerEnv({ TRAINPRO_TIME_ZONE: 'Marte/Olympus' })).toThrow(/zona horaria/);
  });
});
