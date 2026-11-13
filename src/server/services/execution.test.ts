import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ClientCommand } from '@/contracts/execution';
import { type ClientActor, type TrainerActor } from '@/domain/access';
import {
  normalizeContent,
  type SessionContent,
  type SessionItem,
} from '@/domain/training/session-v2';
import { type ClientContext, type TrainerContext } from '../context';
import { MIGRATIONS, migrate } from '../db/migrate.ts';
import { openSqlite } from '../db/sqlite.ts';
import { seededTestDatabase } from '../db/test-support';
import { DEMO_CLIENT_ID, DEMO_NEW_CLIENT_ID, DEMO_TRAINER_ID } from '../repositories/demo/dataset';
import { type Repositories } from '../repositories/ports';
import {
  executeClientCommand,
  getClientExecutionState,
  getPlayer,
  reviewSessionExecution,
} from './client-execution';
import { parseClientCommand } from './command-parser';
import { classifyStorageError } from '../storage-errors';
import {
  createSessionDraft,
  getNewSessionForm,
  getSessionBuilder,
  publishSession,
  publishSessionChange,
  startSessionChange,
} from './trainer-sessions';

/**
 * Bloque 2 · ejecución sobre SQLite real: comandos, idempotencia, duplicados, conflictos,
 * estados, versiones, permisos, transacciones y persistencia.
 */
const TODAY = '2026-11-12';
/**
 * Reloj controlado (A-10): la sesión se publica a las 16:00, los comandos se registran en el
 * móvil entre las 17:00 y las 20:00 y llegan al servidor a las 23:59. Así las reglas de la hora
 * (límite inferior: la publicación; superior: la recepción) se comprueban igual cualquier día.
 */
const PUBLISHED_AT = '2026-11-12T16:00:00.000Z';
const RECEIVED_AT = '2026-11-12T23:59:00.000Z';
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(RECEIVED_AT));
});
afterEach(() => vi.useRealTimers());
const TZ = 'Europe/Madrid';
let n = 0;
const id = (prefix = 'cmd') => `${prefix}-${(n += 1).toString().padStart(6, '0')}-xyz`;
const device = (at = '2026-11-12T17:00:00.000Z') => ({
  recordedAt: at,
  timeZone: TZ,
  utcOffsetMinutes: 60,
});

const trainer = (repos: Repositories): TrainerContext => ({
  actor: { role: 'trainer', trainerId: DEMO_TRAINER_ID } satisfies TrainerActor,
  today: TODAY,
  timeZone: TZ,
  repos,
});
const client = (repos: Repositories, clientId = DEMO_NEW_CLIENT_ID): ClientContext => ({
  actor: { role: 'client', clientId, trainerId: DEMO_TRAINER_ID } satisfies ClientActor,
  today: TODAY,
  timeZone: TZ,
  repos,
});

const item = (id: string, order: number, patch: Partial<SessionItem> = {}): SessionItem => ({
  id,
  variantId: 'ex-goblet-squat',
  order,
  block: `B${order}`,
  blockMode: 'sequential',
  sets: 3,
  defaults: {
    reps: { kind: 'fixed', reps: 10 },
    load: { kind: 'external', kg: 16, basis: 'total' },
    effort: { kind: 'rir', rir: 2 },
    restSeconds: 90,
  },
  perSet: [],
  ...patch,
});

/** Alex publica para Lucía: sentadilla goblet 3 × 10 · 16 kg · RIR 2 y plancha 2 × 30 s. */
async function published(repos: Repositories, items?: SessionItem[]) {
  vi.setSystemTime(new Date(PUBLISHED_AT));
  try {
    return await publishedAtClock(repos, items);
  } finally {
    vi.setSystemTime(new Date(RECEIVED_AT));
  }
}

async function publishedAtClock(repos: Repositories, items?: SessionItem[]) {
  const ctx = trainer(repos);
  const form = (await getNewSessionForm(ctx, DEMO_NEW_CLIENT_ID))!;
  await createSessionDraft(ctx, {
    sessionId: form.sessionId,
    clientId: DEMO_NEW_CLIENT_ID,
    plannedDate: TODAY,
    label: 'Mañana',
    title: 'Fuerza · pierna',
    focus: 'Fuerza',
    estimatedMinutes: 45,
  });
  const builder = (await getSessionBuilder(ctx, form.sessionId))!;
  const content: SessionContent = {
    ...builder.content,
    items: items ?? [
      item('itm-goblet', 1),
      item('itm-plank', 2, {
        variantId: 'ex-side-plank',
        sets: 2,
        defaults: {
          reps: { kind: 'seconds', seconds: 30 },
          load: { kind: 'bodyweight' },
          effort: { kind: 'none' },
          restSeconds: 60,
        },
      }),
    ],
  };
  const result = await publishSession(ctx, {
    sessionId: form.sessionId,
    expectedRevision: builder.revision,
    content,
  });
  expect(result).toMatchObject({ ok: true, version: 1 });
  return {
    sessionId: form.sessionId,
    content: (await repos.training.getVersion(form.sessionId, 1))!.content,
  };
}

const start = (versionNumber = 1, commandId = id('start')): ClientCommand => ({
  commandId,
  clientId: DEMO_NEW_CLIENT_ID,
  type: 'start',
  versionNumber,
  device: device(),
});
const set = (
  setNumber: number,
  patch: Partial<Extract<ClientCommand, { type: 'log_set' }>> = {},
): Extract<ClientCommand, { type: 'log_set' }> => ({
  commandId: id('set'),
  clientId: DEMO_NEW_CLIENT_ID,
  type: 'log_set',
  versionNumber: 1,
  prescriptionId: 'itm-goblet',
  setNumber,
  supersedes: null,
  completed: true,
  reps: 10,
  load: { kind: 'external', kg: 16 },
  rir: 2,
  device: device(`2026-11-12T17:0${setNumber}:00.000Z`),
  ...patch,
});
const plank = (setNumber: number): ClientCommand =>
  set(setNumber, {
    prescriptionId: 'itm-plank',
    reps: null,
    durationS: 30,
    load: { kind: 'bodyweight' },
    rir: null,
  });

describe('comandos de la ejecución', () => {
  it('empezar guarda la versión recibida; el reintento no crea otra ejecución', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    const command = start();
    const first = await executeClientCommand(client(repos), sessionId, command);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      ok: true,
      result: 'applied',
      state: { status: 'in_progress', startedVersion: 1 },
    });
    expect((await executeClientCommand(client(repos), sessionId, command)).body).toMatchObject({
      result: 'already_applied',
    });
    // Otro dispositivo que también pulsa «Empezar»: ya está empezada, no es un error.
    expect((await executeClientCommand(client(repos), sessionId, start())).body).toMatchObject({
      result: 'already_applied',
    });
    expect(
      db
        .prepare('SELECT COUNT(*) AS n FROM session_log WHERE session_id = @sessionId')
        .get<{ n: number }>({ sessionId })!.n,
    ).toBe(1);
  });

  it('registrar una serie; el reintento (mismo identificador) no duplica', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    const command = set(1);
    const once = await executeClientCommand(client(repos), sessionId, command);
    expect(once.body).toMatchObject({
      ok: true,
      result: 'applied',
      state: { completedSets: 1, plannedSets: 5 },
    });
    const twice = await executeClientCommand(client(repos), sessionId, command);
    expect(twice).toMatchObject({ status: 200, body: { result: 'already_applied' } });
    const rows = db
      .prepare('SELECT * FROM set_log WHERE session_id = @sessionId')
      .all<{ client_set_id: string; reps: number; load_kg: number; rir: number }>({ sessionId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      client_set_id: command.commandId,
      reps: 10,
      load_kg: 16,
      rir: 2,
    });
  });

  it('el mismo identificador con otro contenido es un conflicto; otro original de la misma serie, también', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    const first = set(1);
    await executeClientCommand(client(repos), sessionId, first);
    const reused = await executeClientCommand(client(repos), sessionId, { ...first, reps: 9 });
    expect(reused).toMatchObject({ status: 409, body: { ok: false, error: 'command_id_reused' } });
    const again = await executeClientCommand(client(repos), sessionId, set(1, { reps: 9 }));
    expect(again).toMatchObject({
      status: 409,
      body: { error: 'set_already_logged', effective: { clientSetId: first.commandId, reps: 10 } },
    });
  });

  it('una corrección sustituye al registro efectivo y conserva el anterior', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    const first = set(1);
    await executeClientCommand(client(repos), sessionId, first);
    const fix = set(1, { reps: 9, supersedes: first.commandId });
    expect((await executeClientCommand(client(repos), sessionId, fix)).body).toMatchObject({
      result: 'applied',
    });
    // Corregir otra vez el original (ya sustituido) no vale: hay que corregir el efectivo.
    const stale = await executeClientCommand(
      client(repos),
      sessionId,
      set(1, { reps: 8, supersedes: first.commandId }),
    );
    expect(stale).toMatchObject({
      status: 409,
      body: { error: 'not_effective', effective: { clientSetId: fix.commandId } },
    });
    const state = (await getClientExecutionState(client(repos), sessionId))!;
    expect(state.sets).toEqual([
      expect.objectContaining({ setNumber: 1, reps: 9, supersedes: first.commandId }),
    ]);
    expect((await repos.training.getExecution(sessionId))!.setLogs).toHaveLength(2);
  });

  it('valida lo realizado frente a lo prescrito (422) y la serie frente a la versión (409)', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    const invalid = await executeClientCommand(
      client(repos),
      sessionId,
      set(1, { reps: 0, load: { kind: 'external', kg: 900 }, rir: 12 }),
    );
    expect(invalid.status).toBe(422);
    expect(invalid.body).toMatchObject({ error: 'invalid' });
    expect(!invalid.body.ok && invalid.body.issues!.map((i) => i.path)).toEqual([
      'reps',
      'load.kg',
      'rir',
    ]);
    // Plancha (segundos, peso corporal, sin esfuerzo): no admite kg ni RIR.
    const wrong = await executeClientCommand(
      client(repos),
      sessionId,
      set(1, {
        prescriptionId: 'itm-plank',
        reps: null,
        durationS: 30,
        load: { kind: 'external', kg: 10 },
        rir: 2,
      }),
    );
    expect(!wrong.body.ok && wrong.body.issues!.map((i) => i.path)).toEqual(['load', 'rir']);
    expect((await executeClientCommand(client(repos), sessionId, set(4))).body).toMatchObject({
      error: 'unknown_set_in_version',
    });
    expect(
      (
        await executeClientCommand(
          client(repos),
          sessionId,
          set(1, { prescriptionId: 'no-existe' }),
        )
      ).body,
    ).toMatchObject({ error: 'unknown_set_in_version' });
    expect(
      (await executeClientCommand(client(repos), sessionId, set(1, { versionNumber: 7 }))).body,
    ).toMatchObject({ error: 'unknown_version' });
    expect((await executeClientCommand(client(repos), sessionId, start(7))).body).toMatchObject({
      error: 'unknown_version',
    });
  });

  it('sin empezar no se registra; «no realizada» no lleva datos', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    expect((await executeClientCommand(client(repos), sessionId, set(1))).body).toMatchObject({
      error: 'not_started',
    });
    await executeClientCommand(client(repos), sessionId, start());
    const skipped = await executeClientCommand(
      client(repos),
      sessionId,
      set(2, { completed: false, reps: null, load: null, rir: null, note: 'Me dolía la muñeca' }),
    );
    expect(skipped.body).toMatchObject({ ok: true, state: { completedSets: 0 } });
    const state = (await getClientExecutionState(client(repos), sessionId))!;
    expect(state.sets[0]).toMatchObject({
      setNumber: 2,
      completed: false,
      note: 'Me dolía la muñeca',
    });
    expect(state.sets[0]!.reps).toBeUndefined();
  });

  it('pausar y reanudar: «Pausada», y el tiempo en pausa se acumula', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    const pause = {
      commandId: id('pause'),
      clientId: DEMO_NEW_CLIENT_ID,
      type: 'pause' as const,
      device: device('2026-11-12T17:05:00.000Z'),
    };
    const paused = await executeClientCommand(
      client(repos),
      sessionId,
      pause,
      '2026-11-12T17:05:01.000Z',
    );
    expect(paused.body).toMatchObject({
      ok: true,
      state: { status: 'paused', pausedAt: '2026-11-12T17:05:00.000Z' },
    });
    const resume = {
      commandId: id('resume'),
      clientId: DEMO_NEW_CLIENT_ID,
      type: 'resume' as const,
      device: device('2026-11-12T17:15:00.000Z'),
    };
    const resumed = await executeClientCommand(
      client(repos),
      sessionId,
      resume,
      '2026-11-12T17:15:00.000Z',
    );
    expect(resumed.body).toMatchObject({ ok: true, state: { pausedAt: null } });
    expect((await repos.training.getExecution(sessionId))!.log.pausedSeconds).toBe(600);
    // Registrar una serie en pausa también reanuda.
    await executeClientCommand(
      client(repos),
      sessionId,
      { ...pause, commandId: id('pause'), device: device('2026-11-12T17:20:00.000Z') },
      '2026-11-12T17:20:00.000Z',
    );
    await executeClientCommand(
      client(repos),
      sessionId,
      set(1, { device: device('2026-11-12T17:21:00.000Z') }),
      '2026-11-12T17:21:00.000Z',
    );
    const log = (await repos.training.getExecution(sessionId))!.log;
    expect(log.pausedAt).toBeUndefined();
    expect(log.pausedSeconds).toBe(660);
  });

  it('terminar con series pendientes exige confirmarlo; después, la sesión está cerrada', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    const first = set(1);
    await executeClientCommand(client(repos), sessionId, first);
    const finish = (confirmEndEarly: boolean): ClientCommand => ({
      commandId: id('finish'),
      clientId: DEMO_NEW_CLIENT_ID,
      type: 'finish',
      confirmEndEarly,
      comment: 'Buena sesión',
      device: device('2026-11-12T17:30:00.000Z'),
    });
    expect(await executeClientCommand(client(repos), sessionId, finish(false))).toMatchObject({
      status: 409,
      body: { error: 'confirmation_required', pendingSets: 4 },
    });
    const partial = finish(true);
    expect((await executeClientCommand(client(repos), sessionId, partial)).body).toMatchObject({
      ok: true,
      state: { status: 'partial', finishReason: 'ended_early', comment: 'Buena sesión' },
    });
    expect((await executeClientCommand(client(repos), sessionId, partial)).body).toMatchObject({
      result: 'already_applied',
    });
    expect((await executeClientCommand(client(repos), sessionId, set(2))).body).toMatchObject({
      error: 'closed',
    });
    // El reenvío de un comando que ya se aplicó antes del cierre (respuesta perdida) no es un
    // error: el servidor responde lo mismo que la primera vez.
    expect(await executeClientCommand(client(repos), sessionId, first)).toMatchObject({
      status: 200,
      body: { ok: true, result: 'already_applied' },
    });
    expect((await executeClientCommand(client(repos), sessionId, finish(true))).body).toMatchObject(
      { error: 'closed' },
    );
  });

  it('con todo hecho, «Completada»; la revisión compara prescrito y realizado', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    await executeClientCommand(client(repos), sessionId, set(1));
    await executeClientCommand(client(repos), sessionId, set(2, { rir: 1 }));
    await executeClientCommand(client(repos), sessionId, set(3, { reps: 8, rir: 0 }));
    await executeClientCommand(client(repos), sessionId, plank(1));
    await executeClientCommand(client(repos), sessionId, plank(2));
    const done = await executeClientCommand(client(repos), sessionId, {
      commandId: id('finish'),
      clientId: DEMO_NEW_CLIENT_ID,
      type: 'finish',
      confirmEndEarly: false,
      comment: null,
      device: device('2026-11-12T17:40:00.000Z'),
    });
    expect(done.body).toMatchObject({
      ok: true,
      state: { status: 'completed', finishReason: 'all_done' },
    });
    const session = (await repos.training.getSession(sessionId))!;
    const review = (await reviewSessionExecution(trainer(repos), session, {
      id: DEMO_NEW_CLIENT_ID,
      trainerId: DEMO_TRAINER_ID,
    }))!;
    expect(review.items[0]).toMatchObject({
      name: 'Sentadilla goblet',
      prescribed: '3 × 10 · 16 kg · RIR 2',
    });
    expect(review.items[0]!.sets.map((s) => s.performed)).toEqual([
      '10 × 16 kg · RIR 2',
      '10 × 16 kg · RIR 1',
      '8 × 16 kg · RIR 0',
    ]);
    expect(review.items[1]!.sets.map((s) => s.performed)).toEqual([
      '30 s × Peso corporal',
      '30 s × Peso corporal',
    ]);
  });

  it('si Alex publica otra versión durante la ejecución, lo registrado sigue ligado a la suya', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId, content } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    await executeClientCommand(client(repos), sessionId, set(1));
    // Alex cambia la carga de las series pendientes (versión 2).
    expect(await startSessionChange(trainer(repos), sessionId)).toBe('started');
    const draft = (await repos.training.getSession(sessionId))!;
    const v2 = normalizeContent({
      ...content,
      items: content.items.map((i) =>
        i.id === 'itm-goblet'
          ? {
              ...i,
              perSet: [
                {
                  setNumber: 2,
                  load: { kind: 'external' as const, kg: 14, basis: 'total' as const },
                },
                {
                  setNumber: 3,
                  load: { kind: 'external' as const, kg: 14, basis: 'total' as const },
                },
              ],
            }
          : i,
      ),
    });
    expect(
      await publishSessionChange(trainer(repos), {
        sessionId,
        expectedRevision: draft.draftRevision,
        content: v2,
      }),
    ).toMatchObject({ ok: true, version: 2 });
    // Lucía aún tenía la versión 1 en pantalla: su serie 2 se acepta, ligada a la versión 1.
    const late = await executeClientCommand(client(repos), sessionId, set(2));
    expect(late.body).toMatchObject({ ok: true, state: { currentVersion: 2, startedVersion: 1 } });
    // Al recargar ya ve la 2; su serie 3 queda ligada a la 2.
    expect((await getPlayer(client(repos), sessionId))!.version).toBe(2);
    await executeClientCommand(
      client(repos),
      sessionId,
      set(3, { versionNumber: 2, load: { kind: 'external', kg: 14 } }),
    );
    const logs = (await repos.training.getExecution(sessionId))!.setLogs;
    expect(logs.map((l) => [l.setNumber, l.versionNumber])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
    ]);
    expect((await repos.training.getVersion(sessionId, 2))!.executionState).toBe('in_progress');
  });
});

describe('permisos y datos entre clientes', () => {
  it('Marta no registra ni lee la ejecución de Lucía; un borrador no existe para nadie', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    const marta = client(repos, DEMO_CLIENT_ID);
    // Marta, con su propia identidad, sobre la sesión de Lucía: no existe para ella.
    expect(
      await executeClientCommand(marta, sessionId, { ...start(), clientId: DEMO_CLIENT_ID }),
    ).toMatchObject({ status: 404, body: { error: 'not_found' } });
    expect(await getClientExecutionState(marta, sessionId)).toBeNull();
    expect(await getPlayer(marta, sessionId)).toBeNull();
    // Y Lucía no toca las de Marta.
    const martaSession = (await repos.training.listSessions(DEMO_CLIENT_ID))[0]!;
    expect(martaSession).toBeDefined();
    expect((await executeClientCommand(client(repos), martaSession.id, start())).status).toBe(404);
    // Un borrador.
    const ctx = trainer(repos);
    const form = (await getNewSessionForm(ctx, DEMO_NEW_CLIENT_ID))!;
    await createSessionDraft(ctx, {
      sessionId: form.sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      plannedDate: TODAY,
      label: '',
      title: 'Borrador',
      focus: '',
      estimatedMinutes: null,
    });
    expect((await executeClientCommand(client(repos), form.sessionId, start())).status).toBe(404);
  });

  it('A-08 · un comando creado por otra identidad nunca se aplica con la de la petición', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    const lucia = client(repos);
    await executeClientCommand(lucia, sessionId, start());
    // Una serie que Lucía dejó pendiente en un móvil compartido; ahora la cookie es de Marta.
    const pendingFromLucia = set(1);
    const marta = client(repos, DEMO_CLIENT_ID);
    expect(await executeClientCommand(marta, sessionId, pendingFromLucia)).toEqual({
      status: 409,
      body: expect.objectContaining({ ok: false, error: 'identity_mismatch' }),
    });
    // Tampoco sobre una sesión de Marta (no se aplica a nadie ni se revela nada).
    const martaSession = (await repos.training.listSessions(DEMO_CLIENT_ID))[0]!;
    expect(
      (
        await executeClientCommand(marta, martaSession.id, {
          ...pendingFromLucia,
          commandId: id('x'),
        })
      ).body,
    ).toMatchObject({ error: 'identity_mismatch' });
    expect(
      db.prepare('SELECT COUNT(*) AS n FROM set_log WHERE client_set_id = @id').get<{ n: number }>({
        id: pendingFromLucia.commandId,
      })!.n,
    ).toBe(0);
    // Cuando vuelve Lucía, el mismo comando (mismo identificador) se aplica una vez, como suyo.
    expect((await executeClientCommand(lucia, sessionId, pendingFromLucia)).body).toMatchObject({
      result: 'applied',
    });
    expect((await executeClientCommand(lucia, sessionId, pendingFromLucia)).body).toMatchObject({
      result: 'already_applied',
    });
    expect(
      db.prepare('SELECT client_id FROM set_log WHERE client_set_id = @id').get({
        id: pendingFromLucia.commandId,
      }),
    ).toEqual({ client_id: DEMO_NEW_CLIENT_ID });
  });

  it('la vista del reproductor no lleva la nota privada del entrenador', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos, [
      item('itm-goblet', 1, {
        privateNote: 'Ojo con la rodilla izquierda',
        clientNote: 'Pecho alto',
      }),
    ]);
    const player = (await getPlayer(client(repos), sessionId))!;
    expect(player.items[0]).toMatchObject({ clientNote: 'Pecho alto', name: 'Sentadilla goblet' });
    expect(JSON.stringify(player)).not.toContain('rodilla izquierda');
  });
});

describe('transacciones, persistencia y migración', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trainpro-ejecucion-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('un comando que falla en la base no deja nada a medias (ni la serie ni el comando)', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    // Se salta la validación del dominio: la base rechaza las 101 repeticiones (CHECK).
    const meta = {
      commandId: 'directo-0001',
      payloadHash: 'a'.repeat(64),
      sessionId,
      clientId: DEMO_NEW_CLIENT_ID,
      receivedAt: '2026-11-12T17:00:00.000Z',
      device: device(),
    };
    await expect(
      repos.execution.logSet(meta, {
        versionNumber: 1,
        prescriptionId: 'itm-goblet',
        variantId: 'ex-goblet-squat',
        setNumber: 1,
        completed: true,
        reps: 101,
        durationS: null,
        distanceM: null,
        load: { kind: 'external', kg: 16 },
        rir: null,
        rpe: null,
        rpeScale: null,
        note: null,
        supersedes: null,
      }),
    ).rejects.toThrow();
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM client_command WHERE command_id = 'directo-0001'")
        .get<{ n: number }>()!.n,
    ).toBe(0);
    expect(
      db
        .prepare('SELECT COUNT(*) AS n FROM set_log WHERE session_id = @sessionId')
        .get<{ n: number }>({ sessionId })!.n,
    ).toBe(0);
    // La base también impide un segundo original aunque fallara la aplicación (índice único parcial).
    await executeClientCommand(client(repos), sessionId, set(1));
    expect(() =>
      db.exec(`INSERT INTO set_log (client_set_id, session_log_id, session_id, client_id, version_number, prescription_id, variant_id, set_number, completed, performed_at, device_recorded_at, device_time_zone, device_utc_offset_min, received_at)
        SELECT 'duplicada-01', session_log_id, session_id, client_id, 1, 'itm-goblet', 'ex-goblet-squat', 1, 0, performed_at, performed_at, 'UTC', 0, performed_at FROM set_log WHERE session_id = '${sessionId}'`),
    ).toThrow(/UNIQUE/);
  });

  it('lo confirmado se recupera al cerrar y volver a abrir la base', async () => {
    const path = join(dir, 'persistencia.sqlite');
    const first = seededTestDatabase(TODAY, { path });
    const { sessionId } = await published(first.repos);
    await executeClientCommand(client(first.repos), sessionId, start());
    await executeClientCommand(client(first.repos), sessionId, set(1, { reps: 9, rir: 1 }));
    first.db.close();
    const again = seededTestDatabase(TODAY, { path });
    const state = (await getClientExecutionState(client(again.repos), sessionId))!;
    expect(state).toMatchObject({ status: 'in_progress', startedVersion: 1, completedSets: 1 });
    expect(state.sets[0]).toMatchObject({ reps: 9, rir: 1, load: { kind: 'external', kg: 16 } });
    again.db.close();
  });

  it('migra una base de la 001 con ejecuciones: conserva todo y rellena la versión de inicio', () => {
    const path = join(dir, 'de-001.sqlite');
    const old = openSqlite(path);
    migrate(old, { migrations: [MIGRATIONS[0]!] });
    // Sesión y versión se referencian entre sí (clave diferida): van en una transacción.
    old.transaction(() =>
      old.exec(`
      INSERT INTO trainer VALUES ('t', 'T');
      INSERT INTO client (id, trainer_id, display_name, status, population, goal, started_on, created_at) VALUES ('c', 't', 'C', 'active', 'general_health', 'g', '2026-01-01', '2026-01-01T00:00:00.000Z');
      INSERT INTO session (id, client_id, trainer_id, planned_date, day_order, status, current_version, draft_revision, created_at, updated_at) VALUES ('s', 'c', 't', '2026-11-10', 1, 'published', 2, 2, '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
      INSERT INTO session_version (id, session_id, number, content, published_at, published_by, execution_state) VALUES ('v1', 's', 1, '{}', '2026-11-01T00:00:00.000Z', 't', 'not_started'), ('v2', 's', 2, '{}', '2026-11-10T19:00:00.000Z', 't', 'in_progress');
      INSERT INTO session_log (id, session_id, client_id, started_at, start_device_at, start_time_zone, start_utc_offset_min, start_received_at, last_activity_at) VALUES ('l', 's', 'c', '2026-11-10T18:00:00.000Z', '2026-11-10T18:00:00.000Z', 'UTC', 0, '2026-11-10T18:00:00.000Z', '2026-11-10T18:00:00.000Z');
      INSERT INTO set_log (client_set_id, session_log_id, session_id, client_id, version_number, prescription_id, variant_id, set_number, completed, performed_at, device_recorded_at, device_time_zone, device_utc_offset_min, received_at) VALUES ('serie-0001', 'l', 's', 'c', 1, 'p', 'v', 1, 0, '2026-11-10T18:05:00.000Z', '2026-11-10T18:05:00.000Z', 'UTC', 0, '2026-11-10T18:05:00.000Z');
      INSERT INTO client_command VALUES ('serie-0001', 's', 'c', 'log_set', '${'b'.repeat(64)}', '2026-11-10T18:05:00.000Z');
    `),
    );
    expect(migrate(old).applied).toEqual([2, 3]);
    expect(old.prepare('SELECT started_version, paused_seconds FROM session_log').get()).toEqual({
      started_version: 1,
      paused_seconds: 0,
    });
    // 003: lo ya registrado queda como autodeclarado por el cliente, sin motivo de ajuste.
    expect(
      old.prepare('SELECT origin, recorded_by, origin_method, clock_adjustment FROM set_log').get(),
    ).toEqual({
      origin: 'self_reported',
      recorded_by: 'client',
      origin_method: null,
      clock_adjustment: null,
    });
    expect(old.prepare('SELECT origin, recorded_by FROM session_log').get()).toEqual({
      origin: 'self_reported',
      recorded_by: 'client',
    });
    // La procedencia no se puede cambiar después, ni declarar un dato importado sin su fuente.
    expect(() => old.exec("UPDATE session_log SET origin = 'imported'")).toThrow(/procedencia/);
    expect(() =>
      old.exec(`INSERT INTO set_log (client_set_id, session_log_id, session_id, client_id, version_number, prescription_id, variant_id, set_number, completed, performed_at, device_recorded_at, device_time_zone, device_utc_offset_min, received_at, origin)
        VALUES ('serie-0002', 'l', 's', 'c', 1, 'p', 'v', 2, 0, '2026-11-10T18:06:00.000Z', '2026-11-10T18:06:00.000Z', 'UTC', 0, '2026-11-10T18:06:00.000Z', 'imported')`),
    ).toThrow(/CHECK/);
    expect(old.prepare('SELECT COUNT(*) AS n FROM set_log').get()).toEqual({ n: 1 });
    expect(old.prepare('SELECT COUNT(*) AS n FROM client_command').get()).toEqual({ n: 1 });
    expect(old.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(old.pragma('foreign_keys')).toBe(1);
    // Las restricciones siguen: la versión de inicio no cambia y los comandos no se borran.
    expect(() => old.exec('UPDATE session_log SET started_version = 2')).toThrow();
    expect(() => old.exec('DELETE FROM client_command')).toThrow();
    old.close();
  });
});

describe('forma de los comandos (400)', () => {
  it('rechaza un comando sin identificador, sin reloj o de tipo desconocido', () => {
    expect(parseClientCommand(null)).toMatchObject({ ok: false });
    expect(parseClientCommand({ type: 'start', versionNumber: 1, device: device() })).toMatchObject(
      { ok: false },
    );
    expect(
      parseClientCommand({ commandId: 'abcdefgh-1', type: 'start', versionNumber: 1 }),
    ).toMatchObject({ ok: false });
    expect(
      parseClientCommand({ commandId: 'abcdefgh-1', type: 'borrar', device: device() }),
    ).toMatchObject({ ok: false });
    expect(
      parseClientCommand({
        commandId: 'abcdefgh-1',
        type: 'log_set',
        device: device(),
        versionNumber: 1,
        prescriptionId: 'p',
        setNumber: 1,
        completed: 'sí',
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseClientCommand({
        commandId: 'abcdefgh-1',
        type: 'pause',
        device: { ...device(), timeZone: 'Marte/Olympus' },
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseClientCommand({
        commandId: 'abcdefgh-1',
        clientId: 'c-lucia',
        type: 'finish',
        confirmEndEarly: false,
        comment: '  ',
        device: device(),
      }),
    ).toEqual({
      ok: true,
      command: {
        commandId: 'abcdefgh-1',
        clientId: 'c-lucia',
        type: 'finish',
        confirmEndEarly: false,
        comment: null,
        device: device(),
      },
    });
  });
});

describe('A-10 · reglas de la hora de ejecución', () => {
  it('T1 · una fecha imposible del móvil se rechaza sin aplicar nada', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    const outcome = await executeClientCommand(client(repos), sessionId, {
      ...start(),
      device: device('2019-06-01T10:00:00.000Z'),
    });
    expect(outcome).toMatchObject({
      status: 422,
      body: { error: 'invalid', issues: [expect.objectContaining({ path: 'device.recordedAt' })] },
    });
    expect((await getClientExecutionState(client(repos), sessionId))!.status).toBe('planned');
  });

  it('T3 · antes de la publicación (inicio) o del inicio (series): se usa la recepción y se anota el motivo', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    // El reloj del móvil iba cinco días atrás.
    await executeClientCommand(client(repos), sessionId, {
      ...start(),
      device: device('2026-11-07T17:00:00.000Z'),
    });
    expect(
      db
        .prepare(
          'SELECT started_at, start_device_at, start_received_at, start_clock_adjustment FROM session_log WHERE session_id = @sessionId',
        )
        .get({ sessionId }),
    ).toEqual({
      started_at: RECEIVED_AT,
      start_device_at: '2026-11-07T17:00:00.000Z',
      start_received_at: RECEIVED_AT,
      start_clock_adjustment: 'before_lower_bound',
    });
    const early = set(1, { device: device('2026-11-07T17:05:00.000Z') });
    await executeClientCommand(client(repos), sessionId, early);
    const state = (await getClientExecutionState(client(repos), sessionId))!;
    expect(state.sets[0]).toMatchObject({
      performedAt: RECEIVED_AT,
      clockAdjusted: true,
      clockAdjustment: 'before_lower_bound',
    });
  });

  it('T2 y T4 · adelantado → recepción; registrado sin conexión o reanudado al día siguiente → su hora', async () => {
    const { repos } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    // Registrada sin conexión a las 17:01 y recibida a las 23:59: conserva su hora.
    await executeClientCommand(client(repos), sessionId, set(1));
    // Reanudada al día siguiente (llega al día siguiente): su hora, sin ajustes.
    vi.setSystemTime(new Date('2026-11-13T09:31:00.000Z'));
    await executeClientCommand(
      client(repos),
      sessionId,
      set(2, { device: device('2026-11-13T09:30:00.000Z') }),
    );
    // Un móvil adelantado una hora: se usa la recepción.
    await executeClientCommand(
      client(repos),
      sessionId,
      set(3, { device: device('2026-11-13T10:31:00.000Z') }),
    );
    const sets = (await getClientExecutionState(client(repos), sessionId))!.sets;
    expect(sets.map((s) => [s.setNumber, s.performedAt, s.clockAdjustment])).toEqual([
      [1, '2026-11-12T17:01:00.000Z', null],
      [2, '2026-11-13T09:30:00.000Z', null],
      [3, '2026-11-13T09:31:00.000Z', 'ahead_of_server'],
    ]);
  });
});

describe('A-14 · procedencia guardada con cada registro', () => {
  it('lo que registra el cliente queda como autodeclarado por el cliente, en la base y en la vista', async () => {
    const { repos, db } = seededTestDatabase(TODAY);
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    await executeClientCommand(client(repos), sessionId, set(1));
    expect(
      db
        .prepare(
          'SELECT origin, recorded_by, origin_method FROM set_log WHERE session_id = @sessionId',
        )
        .get({ sessionId }),
    ).toEqual({ origin: 'self_reported', recorded_by: 'client', origin_method: null });
    expect(
      db.prepare('SELECT origin, recorded_by FROM session_log WHERE session_id = @sessionId').get({
        sessionId,
      }),
    ).toEqual({ origin: 'self_reported', recorded_by: 'client' });
    const [logged] = (await getClientExecutionState(client(repos), sessionId))!.sets;
    expect(logged).toMatchObject({ origin: 'self_reported', recordedBy: 'client' });
  });
});

describe('A-11 · base ocupada por otro proceso', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trainpro-ocupada-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('el comando falla pronto con un error recuperable, sin aplicar nada, y el reintento entra una vez', async () => {
    vi.useRealTimers();
    const path = join(dir, 'ocupada.sqlite');
    const { repos, db } = seededTestDatabase(TODAY, { path });
    const { sessionId } = await published(repos);
    await executeClientCommand(client(repos), sessionId, start());
    const blocker = openSqlite(path);
    blocker.exec('BEGIN IMMEDIATE');
    const command = set(1);
    const t0 = Date.now();
    let failure: unknown = null;
    try {
      await executeClientCommand(client(repos), sessionId, command);
    } catch (error) {
      failure = error;
    }
    const waited = Date.now() - t0;
    blocker.exec('ROLLBACK');
    blocker.close();
    expect(classifyStorageError(failure)).toBe('storage_busy');
    // Espera acotada (BUSY_TIMEOUT_MS = 1 s): el servidor no se queda detenido 5 s.
    expect(waited).toBeLessThan(2500);
    expect(
      db
        .prepare('SELECT COUNT(*) AS n FROM client_command WHERE command_id = @id')
        .get<{ n: number }>({
          id: command.commandId,
        })!.n,
    ).toBe(0);
    expect((await executeClientCommand(client(repos), sessionId, command)).body).toMatchObject({
      result: 'applied',
    });
    expect((await executeClientCommand(client(repos), sessionId, command)).body).toMatchObject({
      result: 'already_applied',
    });
    db.close();
  });
});
