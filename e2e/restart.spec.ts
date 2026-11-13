import { type ChildProcess, execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { type Browser, devices } from '@playwright/test';
import Database from 'better-sqlite3';
import { todayInMadrid } from './helpers';
import {
  createSessionForLucia,
  enterAs,
  expect,
  logVisibleSet,
  startTraining,
  test,
} from './fixtures';
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

function startServer(port: number, env: Record<string, string>, host = '127.0.0.1') {
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-H', host, '--port', String(port)], {
    env: { ...process.env, ...E2E_SERVER_ENV, TRAINPRO_DEMO_SPACES: 'off', ...env },
    stdio: 'pipe',
  });
  running.add(child);
  child.once('exit', () => running.delete(child));
  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));
  return {
    child,
    output: () => output,
    /** Código de salida cuando el proceso termine (para los arranques que deben fallar). */
    exited: () =>
      new Promise<number | null>((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) resolve(child.exitCode);
        else child.once('exit', (code) => resolve(code));
      }),
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

/** `scripts/db.ts` con su código de salida y toda su salida (para los casos que deben fallar). */
const dbScript = (dataDir: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, ['scripts/db.ts', ...args], {
    env: { ...process.env, TRAINPRO_DATA_DIR: dataDir },
    encoding: 'utf8',
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
};

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

test('B2 · reiniciar el servidor a media sesión: lo confirmado sigue y lo pendiente se envía sin duplicar', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const port = 3193;
  const dataDir = `.data/e2e/reinicio-ejecucion-${Date.now()}`;
  await assertPortFree(port);
  let server = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await server.ready();

  // Marta en su móvil: el mismo navegador (y su cola local) durante todos los reinicios.
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${port}`,
  });
  const page = await context.newPage();
  await enterAs(page, 'Marta, clienta');
  await page.getByRole('link', { name: /Empezar entrenamiento/ }).click();
  await startTraining(page);
  await logVisibleSet(page);
  await logVisibleSet(page);
  await expect(page.getByText('Todo guardado en el servidor')).toBeVisible();
  await expect(page.getByText('2 de 16 series')).toBeVisible();

  // 1) Corte brusco con dos series confirmadas.
  await stop(server.child, 'SIGKILL');
  await assertPortFree(port);

  // 2) Con el servidor caído, la tercera serie queda en el móvil, sin confirmar.
  await logVisibleSet(page, { waitForServer: false });
  await expect(page.getByText(/1 pendiente de envío/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Todo guardado en el servidor')).toHaveCount(0);

  // 3) Nuevo arranque con la misma base: «Reintentar» envía lo pendiente.
  server = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await server.ready();
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Todo guardado en el servidor')).toBeVisible({ timeout: 15_000 });

  // 4) Lo que dice el servidor (leído de SQLite tras el reinicio): tres series, una por serie.
  const sessionId = new URL(page.url()).pathname.split('/')[3]!;
  const response = await page.request.get(`/api/cliente/sesiones/${sessionId}/estado`);
  expect(response.status()).toBe(200);
  const state = (await response.json()) as {
    state: { sets: { prescriptionId: string; setNumber: number }[] };
  };
  const keys = state.state.sets.map((s) => `${s.prescriptionId}#${s.setNumber}`);
  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(3);
  await page.reload();
  await expect(page.getByText('3 de 16 series')).toBeVisible();
  await context.close();
  await stop(server.child, 'SIGTERM');

  // 5) En la base, sin servidor: tres filas de serie y un comando por operación, sin repetidos.
  const db = new Database(`${dataDir}/trainpro.sqlite`, { readonly: true });
  try {
    const rows = db
      .prepare(
        `SELECT s.prescription_id, s.set_number, s.supersedes FROM set_log s
         WHERE s.session_id = ?`,
      )
      .all(sessionId) as {
      prescription_id: string;
      set_number: number;
      supersedes: string | null;
    }[];
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.supersedes === null)).toBe(true);
    const commands = db
      .prepare(
        `SELECT type, COUNT(*) AS n FROM client_command
         WHERE session_id = ? GROUP BY type ORDER BY type`,
      )
      .all(sessionId);
    expect(commands).toEqual([
      { type: 'log_set', n: 3 },
      { type: 'start', n: 1 },
    ]);
  } finally {
    db.close();
  }
  expect(dbStatus(dataDir)).toContain('Integridad: ok');
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

test('A-03 · un segundo servidor con la misma base no arranca, dice quién la usa y no invalida al primero', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const [port, otherPort] = [3194, 3195];
  const dataDir = `.data/e2e/dos-servidores-${Date.now()}`;
  await assertPortFree(port);
  await assertPortFree(otherPort);
  const first = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await first.ready();

  // Mientras el primero la usa, `db:status` dice quién es.
  const status = dbStatus(dataDir);
  const holder = status.match(/En uso por el servidor de TrainPro \(proceso (\d+)/)?.[1];
  expect(holder, status).toBeTruthy();

  // Segundo servidor sobre la misma carpeta: se niega a arrancar y nombra al titular.
  const second = startServer(otherPort, { TRAINPRO_DATA_DIR: dataDir });
  expect(await second.exited()).toBe(1);
  expect(second.output()).toContain('TrainPro no arranca');
  expect(second.output()).toContain(`está en uso por el servidor de TrainPro (proceso ${holder}`);
  await assertPortFree(otherPort);

  // La ficha del titular es solo informativa: aunque se borre, el bloqueo (del sistema
  // operativo) sigue, y un tercer intento tampoco arranca.
  rmSync(`${dataDir}/trainpro.sqlite.lock.json`);
  const third = startServer(otherPort, { TRAINPRO_DATA_DIR: dataDir });
  expect(await third.exited()).toBe(1);
  expect(third.output()).toContain('está en uso por otro proceso');

  // Tampoco una restauración puede quitarle la base.
  const backup = dbScript(dataDir, 'backup');
  expect(backup.code, backup.output).toBe(0);
  const copy = backup.output.match(/: (\S+\.sqlite)\s*$/m)?.[1];
  expect(copy, backup.output).toBeTruthy();
  const restore = dbScript(dataDir, 'restore', copy!);
  expect(restore.code).not.toBe(0);
  expect(restore.output).toContain('está en uso por');
  expect(existsSync(`${dataDir}/trainpro.sqlite.restauracion.json`)).toBe(false);

  // El primero sigue sirviendo y escribiendo con normalidad.
  const context = await contextFor(browser, port);
  const page = await context.newPage();
  await enterAs(page, 'Alex, entrenador');
  await createSessionForLucia(page, {
    date: todayInMadrid(),
    label: 'Mañana',
    title: 'Tras el segundo servidor',
  });
  await context.close();
  await stop(first.child, 'SIGTERM');
  const after = dbStatus(dataDir);
  expect(after).toContain('Sin servidor usándola.');
  expect(after).toContain('Integridad: ok');
});

test('A-12 · el modo local-demo no arranca si escucha fuera de esta máquina (-H 0.0.0.0)', async () => {
  test.setTimeout(90_000);
  const port = 3196;
  const dataDir = `.data/e2e/interfaz-${Date.now()}`;
  await assertPortFree(port);
  const server = startServer(port, { TRAINPRO_DATA_DIR: dataDir }, '0.0.0.0');
  expect(await server.exited()).toBe(1);
  expect(server.output()).toContain('el modo local-demo solo puede escuchar en esta máquina');
  expect(server.output()).toContain('0.0.0.0');
  await assertPortFree(port);
  // Se comprueba antes de abrir la base: no ha llegado a crearla.
  expect(existsSync(`${dataDir}/trainpro.sqlite`)).toBe(false);
});

/** Sesiones publicadas de Marta sin empezar, con sus series (leídas de la base). */
function unstartedSessions(file: string) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        `SELECT s.id, v.number, v.content FROM session s
         JOIN session_version v ON v.session_id = s.id AND v.number = s.current_version
         WHERE s.client_id = 'c-marta'
           AND NOT EXISTS (SELECT 1 FROM session_log l WHERE l.session_id = s.id)
         ORDER BY s.planned_date, s.day_order`,
      )
      .all() as { id: string; number: number; content: string }[];
    return rows.map((row) => {
      const content = JSON.parse(row.content) as { items: { id: string; sets: number }[] };
      return {
        id: row.id,
        version: row.number,
        sets: content.items.flatMap((item) =>
          Array.from({ length: item.sets }, (_, k) => ({
            prescriptionId: item.id,
            setNumber: k + 1,
          })),
        ),
      };
    });
  } finally {
    db.close();
  }
}

test('A-04 · corte brusco con escritores concurrentes: lo confirmado sigue, nada queda a medias y reenviar no duplica', async () => {
  test.setTimeout(240_000);
  const port = 3197;
  const dataDir = `.data/e2e/corte-carga-${Date.now()}`;
  const file = `${dataDir}/trainpro.sqlite`;
  const base = `http://127.0.0.1:${port}`;
  await assertPortFree(port);
  let server = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await server.ready();

  // Marta registra todas sus sesiones pendientes a la vez desde 8 «móviles».
  const device = () => ({
    recordedAt: new Date().toISOString(),
    timeZone: 'Europe/Madrid',
    utcOffsetMinutes: 60,
  });
  const sessions = unstartedSessions(file);
  expect(sessions.length).toBeGreaterThan(2);
  const plan = sessions.map((session) => [
    {
      sessionId: session.id,
      body: {
        commandId: `st-${randomUUID()}`,
        clientId: 'c-marta',
        type: 'start',
        versionNumber: session.version,
        device: device(),
      },
    },
    ...session.sets.map((set) => ({
      sessionId: session.id,
      body: {
        commandId: `ls-${randomUUID()}`,
        clientId: 'c-marta',
        type: 'log_set',
        versionNumber: session.version,
        prescriptionId: set.prescriptionId,
        setNumber: set.setNumber,
        supersedes: null,
        // Sin valores medidos: vale para cualquier tipo de ejercicio prescrito.
        completed: false,
        note: null,
        device: device(),
      },
    })),
  ]);
  const commands = plan.flat();
  const send = async (command: (typeof commands)[number]) => {
    try {
      const response = await fetch(`${base}/api/cliente/sesiones/${command.sessionId}/comandos`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: base,
          cookie: 'trainpro-cliente=c-marta',
        },
        body: JSON.stringify(command.body),
        signal: AbortSignal.timeout(20_000),
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    } catch {
      return { status: 0, body: {} }; // sin respuesta: estaba en vuelo al cortar
    }
  };

  // Se corta con SIGKILL a mitad de carga: cuando hay un tercio confirmado y siguen en vuelo.
  const acked = new Set<string>();
  const rejected: string[] = [];
  const queue = plan.slice();
  let killed = false;
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length > 0 && !killed) {
      for (const command of queue.shift()!) {
        if (killed) break;
        const response = await send(command);
        if (response.status === 200) acked.add(command.body.commandId);
        else
          rejected.push(`${command.body.type} ${response.status} ${String(response.body.error)}`);
      }
    }
  });
  const cutAt = Math.ceil(commands.length / 3);
  let finished = false;
  const done = Promise.all(workers).then(() => (finished = true));
  for (let waited = 0; acked.size < cutAt && !finished && waited < 60_000; waited += 10) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(rejected, 'durante la carga, todo lo que responde es 200').toEqual([]);
  expect(finished, 'el corte llega con escritores aún en vuelo').toBe(false);
  expect(acked.size).toBeGreaterThanOrEqual(cutAt);
  killed = true;
  await stop(server.child, 'SIGKILL');
  await done;
  expect(acked.size).toBeLessThan(commands.length);

  // En la base, sin reabrir con la app: lo confirmado está, y cada comando con su efecto entero.
  const check = () => {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
      const stored = new Set(
        (db.prepare('SELECT command_id FROM client_command').all() as { command_id: string }[]).map(
          (r) => r.command_id,
        ),
      );
      const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
      return {
        integrity: db.pragma('integrity_check', { simple: true }),
        brokenKeys: (db.prepare('PRAGMA foreign_key_check').all() as unknown[]).length,
        lostAfterAck: [...acked].filter((id) => !stored.has(id)).length,
        commandWithoutSet: one(
          `SELECT COUNT(*) n FROM client_command c WHERE c.type = 'log_set'
           AND NOT EXISTS (SELECT 1 FROM set_log s WHERE s.client_set_id = c.command_id)`,
        ),
        setWithoutCommand: one(
          `SELECT COUNT(*) n FROM set_log s WHERE s.client_set_id LIKE 'ls-%'
           AND NOT EXISTS (SELECT 1 FROM client_command c WHERE c.command_id = s.client_set_id)`,
        ),
        duplicatedSets: one(
          `SELECT COUNT(*) n FROM (SELECT session_log_id, prescription_id, set_number FROM set_log
           WHERE supersedes IS NULL GROUP BY 1, 2, 3 HAVING COUNT(*) > 1)`,
        ),
        startWithoutLog: one(
          `SELECT COUNT(*) n FROM client_command c WHERE c.type = 'start'
           AND NOT EXISTS (SELECT 1 FROM session_log l WHERE l.session_id = c.session_id)`,
        ),
        sets: one(`SELECT COUNT(*) n FROM set_log WHERE client_set_id LIKE 'ls-%'`),
        starts: one(`SELECT COUNT(*) n FROM client_command WHERE type = 'start'`),
      };
    } finally {
      db.close();
    }
  };
  const clean = {
    integrity: 'ok',
    brokenKeys: 0,
    lostAfterAck: 0,
    commandWithoutSet: 0,
    setWithoutCommand: 0,
    duplicatedSets: 0,
    startWithoutLog: 0,
  };
  expect(check()).toMatchObject(clean);

  // Nuevo arranque y reenvío de TODO (como haría cada cola): lo confirmado responde
  // «already_applied», lo que no llegó se aplica, y nada se duplica.
  await assertPortFree(port);
  server = startServer(port, { TRAINPRO_DATA_DIR: dataDir });
  await server.ready();
  for (const command of commands) {
    const response = await send(command);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    if (acked.has(command.body.commandId)) {
      expect(response.body.result).toBe('already_applied');
    } else {
      expect(['applied', 'already_applied']).toContain(response.body.result);
    }
  }
  for (const command of commands) {
    expect((await send(command)).body.result).toBe('already_applied');
  }
  await stop(server.child, 'SIGTERM');
  const final = check();
  expect(final).toMatchObject(clean);
  expect(final.sets).toBe(commands.filter((c) => c.body.type === 'log_set').length);
  expect(final.starts).toBe(sessions.length);
  expect(dbStatus(dataDir)).toContain('Integridad: ok');
});
