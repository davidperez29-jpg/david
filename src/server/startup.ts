import 'server-only';
import { Server } from 'node:net';
import { todayInTimeZone } from '@/domain/time';
import { DataLocationBusyError } from './db/lock';
import { getStore } from './db/store';
import { readServerEnv } from './env';

/**
 * Comprobaciones al arrancar el servidor (las llama `src/instrumentation.ts`, que Next.js ejecuta
 * una vez y antes de atender ninguna petición). Si alguna falla, el servidor NO arranca.
 *
 * 1. Modo `local-demo` solo en esta máquina (docs/AUDIT_BLOCK1.md A-12): se mira en qué dirección
 *    escucha DE VERDAD el proceso (sus sockets abiertos), no los argumentos ni las cabeceras. Si
 *    escucha en una interfaz que no es de la propia máquina (loopback: 127.0.0.0/8 o ::1), se niega
 *    a arrancar. La comprobación de `Host` de `proxy.ts` se mantiene, contra el DNS rebinding.
 * 2. La base, en exclusiva (A-03): si otro proceso la usa, se niega a arrancar y dice quién es.
 *
 * Nada de esto es autenticación: «Entrar como…» sigue siendo un selector de demostración.
 */
export function isLoopbackAddress(address: string): boolean {
  const a = address.toLowerCase();
  return a === '::1' || /^127\.\d+\.\d+\.\d+$/.test(a) || /^::ffff:127\.\d+\.\d+\.\d+$/.test(a);
}

/** Direcciones en las que escucha este proceso (servidores TCP abiertos). */
export function listeningAddresses(): string[] {
  // `_getActiveHandles` no está documentado, pero es estable desde hace años y es la única forma de
  // leer la dirección real del servidor que abre Next.js. Si desapareciera, la comprobación falla
  // de forma segura: sin poder verificarlo, el modo local-demo no arranca.
  const handles = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles;
  if (typeof handles !== 'function') return [];
  return handles
    .call(process)
    .filter((h): h is Server => h instanceof Server && h.listening)
    .map((server) => server.address())
    .filter(
      (a): a is { address: string; family: string; port: number } =>
        typeof a === 'object' && a !== null,
    )
    .map((a) => a.address);
}

async function waitForListening(timeoutMs: number): Promise<string[]> {
  for (let waited = 0; waited <= timeoutMs; waited += 50) {
    const addresses = listeningAddresses();
    if (addresses.length > 0) return addresses;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return [];
}

function fatal(message: string): never {
  console.error(`\n✗ TrainPro no arranca: ${message}\n`);
  process.exit(1);
}

export async function runStartupChecks(): Promise<void> {
  const env = readServerEnv();
  if (env.mode === 'local-demo') {
    const addresses = await waitForListening(5000);
    if (addresses.length === 0) {
      fatal(
        'no se ha podido comprobar en qué dirección escucha el servidor, y el modo local-demo solo puede escuchar en esta máquina.',
      );
    }
    const exposed = addresses.filter((a) => !isLoopbackAddress(a));
    if (exposed.length > 0) {
      fatal(
        `el modo local-demo solo puede escuchar en esta máquina (127.0.0.1 o ::1), y este servidor escucha en ${exposed.join(', ')}. ` +
          'Arranca con «pnpm dev» o «pnpm start», que usan -H 127.0.0.1. Para otra cosa hará falta autenticación real (Fase 2).',
      );
    }
  }
  try {
    getStore({
      dataDir: env.dataDir,
      space: null,
      today: todayInTimeZone(env.timeZone),
      timeZone: env.timeZone,
    });
  } catch (error) {
    if (error instanceof DataLocationBusyError) fatal(error.message);
    throw error;
  }
}
