import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAllStores } from './db/store';
import { isLoopbackAddress, listeningAddresses, runStartupChecks } from './startup';

/**
 * Arranque del modo local-demo (docs/AUDIT_BLOCK1.md A-12): solo puede escuchar en esta máquina, y
 * se comprueba la dirección REAL del socket abierto, no los argumentos. La exclusividad de la base
 * con dos procesos de verdad está en `db/concurrency.test.ts` y en `e2e/restart.spec.ts`.
 */
describe('isLoopbackAddress', () => {
  it.each(['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1'])('%s es de esta máquina', (a) => {
    expect(isLoopbackAddress(a)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '::',
    '192.168.1.10',
    '10.0.0.1',
    '172.16.0.5',
    '128.0.0.1',
    '::ffff:192.168.1.10',
    'fe80::1',
    '127.0.0.1.example.com',
  ])('%s NO es de esta máquina', (a) => {
    expect(isLoopbackAddress(a)).toBe(false);
  });
});

const servers: Server[] = [];
function listen(host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      servers.push(server);
      resolve(server);
    });
  });
}

let dir: string;
let exit: ReturnType<typeof vi.spyOn>;
let errors: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trainpro-arranque-'));
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((message: string) => void errors.push(message));
  exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);
  vi.stubEnv('TRAINPRO_MODE', 'local-demo');
  vi.stubEnv('TRAINPRO_DATA_DIR', dir);
  vi.stubEnv('TRAINPRO_DEMO_SPACES', '');
});

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise((resolve) => server.close(resolve));
  }
  closeAllStores();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe('listeningAddresses', () => {
  it('lee la dirección real de los servidores abiertos del proceso', async () => {
    const server = await listen('127.0.0.1');
    expect(listeningAddresses()).toContain('127.0.0.1');
    await new Promise((resolve) => server.close(resolve));
    servers.splice(servers.indexOf(server), 1);
    expect(listeningAddresses()).not.toContain('127.0.0.1');
  });
});

describe('runStartupChecks (local-demo)', () => {
  it('escuchando solo en 127.0.0.1: arranca y abre la base en exclusiva', async () => {
    await listen('127.0.0.1');
    await expect(runStartupChecks()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  });

  it('escuchando en 0.0.0.0 (todas las interfaces): se niega a arrancar y dice por qué', async () => {
    await listen('0.0.0.0');
    await expect(runStartupChecks()).rejects.toThrow('process.exit(1)');
    expect(errors.join('\n')).toMatch(/solo puede escuchar en esta máquina.*0\.0\.0\.0/s);
  });

  it('aunque además escuche en 127.0.0.1, una sola interfaz expuesta basta para no arrancar', async () => {
    await listen('127.0.0.1');
    await listen('0.0.0.0');
    await expect(runStartupChecks()).rejects.toThrow('process.exit(1)');
  });

  it('sin local-demo no hay ninguna identidad: la restricción de dirección es la del modo local-demo', async () => {
    vi.stubEnv('TRAINPRO_MODE', '');
    await listen('0.0.0.0');
    await expect(runStartupChecks()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  });
});
