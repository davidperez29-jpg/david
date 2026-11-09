import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readServerEnv } from './env';

// Rutas construidas con `resolve` para que la prueba valga también en Windows.
const CWD = resolve('/proyecto');

describe('configuración del servidor', () => {
  it('usa valores por defecto seguros: SQLite en .data, sin identidad demo y solo localhost', () => {
    expect(readServerEnv({}, CWD)).toEqual({
      dataSource: 'sqlite',
      timeZone: 'Europe/Madrid',
      dataDir: resolve(CWD, '.data'),
      mode: null,
      demoSpaces: false,
      allowedHosts: ['localhost', '127.0.0.1'],
    });
  });

  it('rechaza fuentes de datos que no existen y explica que "demo" ya no está', () => {
    expect(() => readServerEnv({ TRAINPRO_DATA_SOURCE: 'postgres' }, CWD)).toThrow(
      /solo se admite "sqlite"/,
    );
    expect(() => readServerEnv({ TRAINPRO_DATA_SOURCE: 'demo' }, CWD)).toThrow(/se sustituyó/);
  });

  it('rechaza zonas horarias no válidas', () => {
    expect(() => readServerEnv({ TRAINPRO_TIME_ZONE: 'Marte/Olympus' }, CWD)).toThrow(
      /zona horaria/,
    );
  });

  it('solo existe el modo local-demo, y los espacios E2E lo exigen', () => {
    expect(readServerEnv({ TRAINPRO_MODE: 'local-demo' }, CWD).mode).toBe('local-demo');
    expect(() => readServerEnv({ TRAINPRO_MODE: 'produccion' }, CWD)).toThrow(/único modo/);
    expect(() => readServerEnv({ TRAINPRO_DEMO_SPACES: 'on' }, CWD)).toThrow(/local-demo/);
    expect(
      readServerEnv({ TRAINPRO_MODE: 'local-demo', TRAINPRO_DEMO_SPACES: 'on' }, CWD).demoSpaces,
    ).toBe(true);
  });

  it('la carpeta de datos es persistente: nunca dentro de .next ni de node_modules', () => {
    expect(readServerEnv({ TRAINPRO_DATA_DIR: 'datos/demo' }, CWD).dataDir).toBe(
      resolve(CWD, 'datos', 'demo'),
    );
    expect(() => readServerEnv({ TRAINPRO_DATA_DIR: '.next/datos' }, CWD)).toThrow(/se borra/);
    expect(() => readServerEnv({ TRAINPRO_DATA_DIR: 'node_modules' }, CWD)).toThrow(/se borra/);
  });

  it('los hosts permitidos son nombres exactos, sin puertos ni comodines', () => {
    expect(
      readServerEnv({ TRAINPRO_ALLOWED_HOSTS: ' LocalHost , mi-portatil.local ' }, CWD)
        .allowedHosts,
    ).toEqual(['localhost', 'mi-portatil.local']);
    expect(() => readServerEnv({ TRAINPRO_ALLOWED_HOSTS: '*.example.com' }, CWD)).toThrow(
      /no es un nombre de host/,
    );
    expect(() => readServerEnv({ TRAINPRO_ALLOWED_HOSTS: 'localhost:3000' }, CWD)).toThrow(
      /no es un nombre de host/,
    );
  });
});
