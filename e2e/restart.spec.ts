import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { type Browser } from '@playwright/test';
import { todayInMadrid } from './helpers';
import { createSessionForLucia, enterAs, expect, test } from './fixtures';
import { E2E_SERVER_ENV } from './server-env';

/**
 * B1-01 (reinicio del servidor) y B1-11 (protección local), con SERVIDORES PROPIOS: se arrancan
 * y se paran aquí, cada uno con su carpeta de datos dentro de `.data/e2e` (se borra al empezar
 * la siguiente ejecución). Los datos se comprueban leyéndolos de nuevo desde SQLite tras
 * reiniciar, no en memoria.
 */
const require = createRequire(import.meta.url);
const NEXT_BIN = require.resolve('next/dist/bin/next');

test.describe.configure({ mode: 'serial' });

/** Servidores arrancados por estas pruebas: se paran siempre, también si una prueba falla. */
const running = new Set<ChildProcess>();
test.afterEach(async () => {
  for (const child of running) await stop(child, 'SIGKILL');
});

async function assertPortFree(port: number) {
  const answered = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' }).then(
    () => true,
    () => false,
  );
  if (answered) throw new Error(`El puerto ${port} ya está ocupado por otro servidor.`);
}

function startServer(port: number, env: Record<string, string>) {
  const child = spawn(
    process.execPath,
    [NEXT_BIN, 'start', '-H', '127.0.0.1', '--port', String(port)],
    {
      env: { ...process.env, ...E2E_SERVER_ENV, TRAINPRO_DEMO_SPACES: 'off', ...env },
      stdio: 'pipe',
    },
  );
  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));
  return {
    child,
    output: () => output,
    ready: async () => {
      for (let i = 0; i < 150; i += 1) {
        // Si el proceso ha terminado (por ejemplo, el puerto estaba ocupado), no vale otro servidor.
        if (child.exitCode !== null) throw new Error(`El servidor terminó al arrancar:\n${output}`);
        try {
          await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      throw new Error(`El servidor no arrancó:\n${output}`);
    },
  };
}

async function stop(child: ChildProcess, signal: NodeJS.Signals) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill(signal);
  await exited;
}

async function contextFor(browser: Browser, port: number) {
  return browser.newContext({ baseURL: `http://127.0.0.1:${port}` });
}

/** Lo que hay en la base vista desde la interfaz: sesiones de Marta y de Lucía y registros. */
async function snapshot(browser: Browser, port: number) {
  const context = await contextFor(browser, port);
  const page = await context.newPage();
  await enterAs(page, 'Alex, entrenador');
  await page.goto('/entrenador/clientes/c-marta/sesiones');
  const martaPublished = await page.getByText(/^Publicada v1$/).count();
  await page.goto('/entrenador/clientes/c-marta/registro');
  const martaLogs = await page.getByText(/\d+\/\d+ series/).count();
  await page.goto('/entrenador/clientes/c-lucia/sesiones');
  const lucia = await page.locator('li li p.font-semibold').allTextContents();
  await context.close();
  return { martaPublished, martaLogs, lucia };
}

const dbStatus = (dataDir: string) =>
  execFileSync(process.execPath, ['scripts/db.ts', 'status'], {
    env: { ...process.env, TRAINPRO_DATA_DIR: dataDir },
    encoding: 'utf8',
  });

test('B1-01 · los datos sobreviven a reiniciar el servidor con SIGTERM y con SIGKILL', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const port = 3191;
  const dataDir = `.data/e2e/reinicio-${Date.now()}`;
  const today = todayInMadrid();

  await assertPortFree(port);
  let server = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await server.ready();
  const before = await snapshot(browser, port);
  expect(before.martaPublished).toBeGreaterThan(0);
  expect(before.martaLogs).toBeGreaterThan(0);
  expect(before.lucia).toEqual([]);

  // Cambios del entrenador: una publicada y un borrador.
  let context = await contextFor(browser, port);
  let page = await context.newPage();
  await enterAs(page, 'Alex, entrenador');
  await createSessionForLucia(page, { date: today, label: 'Mañana', title: 'Antes de SIGTERM' });
  await createSessionForLucia(page, {
    date: today,
    label: 'Tarde',
    title: 'Borrador antes de SIGTERM',
    publish: false,
  });
  await context.close();

  // 1) Parada ordenada (SIGTERM) y nuevo arranque.
  await stop(server.child, 'SIGTERM');
  await assertPortFree(port);
  server = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await server.ready();
  const afterTerm = await snapshot(browser, port);
  expect(afterTerm.martaPublished).toBe(before.martaPublished);
  expect(afterTerm.martaLogs).toBe(before.martaLogs);
  expect(afterTerm.lucia.join(' | ')).toContain('Antes de SIGTERM');
  expect(afterTerm.lucia.join(' | ')).toContain('Borrador antes de SIGTERM');

  // 2) Corte brusco (SIGKILL) justo después de publicar.
  context = await contextFor(browser, port);
  page = await context.newPage();
  await enterAs(page, 'Alex, entrenador');
  await createSessionForLucia(page, { date: today, label: 'Club', title: 'Antes de SIGKILL' });
  await context.close();
  await stop(server.child, 'SIGKILL');
  await assertPortFree(port);
  server = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await server.ready();
  const afterKill = await snapshot(browser, port);
  expect(afterKill.martaPublished).toBe(before.martaPublished);
  expect(afterKill.martaLogs).toBe(before.martaLogs);
  expect(afterKill.lucia.join(' | ')).toContain('Antes de SIGKILL');
  expect(afterKill.lucia).toHaveLength(3);
  await stop(server.child, 'SIGTERM');

  // La base sigue íntegra, con su semilla y sus migraciones.
  const status = dbStatus(dataDir);
  expect(status).toContain('Integridad: ok');
  expect(status).toContain(`Semilla: ${today}`);
  expect(status).toContain('Sin servidor usándola.');
});

test('B1-11 · solo 127.0.0.1, Host ajeno → 403 y sin local-demo no hay «Entrar como…»', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const port = 3192;
  const dataDir = `.data/e2e/proteccion-${Date.now()}`;

  // Sin TRAINPRO_MODE=local-demo: la app arranca, pero no hay forma de entrar.
  await assertPortFree(port);
  const server = startServer(port, { TRAINPRO_DATA_DIR: dataDir, TRAINPRO_MODE: '' });
  await server.ready();
  try {
    const context = await contextFor(browser, port);
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByText('Este servidor no está en modo demostración local')).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar como/ })).toHaveCount(0);
    await page.goto('/entrenador');
    await expect(page).toHaveURL(`http://127.0.0.1:${port}/`);
    await page.goto('/cliente');
    await expect(page).toHaveURL(`http://127.0.0.1:${port}/`);
    await context.close();

    // Un Host ajeno (DNS rebinding) recibe 403, también en los archivos estáticos.
    const status = (path: string, host: string) =>
      new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          { host: '127.0.0.1', port, path, headers: { Host: host } },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          },
        );
        req.on('error', reject);
        req.end();
      });
    expect(await status('/', 'evil.example.com')).toBe(403);
    expect(await status('/manifest.webmanifest', 'evil.example.com:3192')).toBe(403);
    expect(await status('/', `localhost:${port}`)).toBe(200);

    // Escucha solo en 127.0.0.1: desde otra dirección del equipo, la conexión se rechaza.
    const external = Object.values(networkInterfaces())
      .flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal);
    if (!external) {
      test.info().annotations.push({
        type: 'aviso',
        description: 'Sin interfaz de red externa: no se pudo probar la conexión desde fuera.',
      });
    } else {
      const reachable = await new Promise<boolean>((resolve) => {
        const socket = connect({ host: external.address, port }, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => resolve(false));
      });
      expect(reachable, `conexión a ${external.address}:${port}`).toBe(false);
    }
  } finally {
    await stop(server.child, 'SIGTERM');
  }
});
