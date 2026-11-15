import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Perspective } from '@/domain/analysis/reference';
import { type TrainerContext } from '../context';
import { buildAnalysisScenarios, type ScenarioWorld } from './analysis-scenarios';
import { executeClientCommand } from './client-execution';
import { publishSessionChange, startSessionChange } from './trainer-sessions';
import {
  getExecutionDay,
  getSessionAnalysis,
  listRecentExecutions,
  parsePerspective,
} from './trainer-analysis';

/**
 * B3.1 · Análisis sobre una base SQLite real, con los escenarios de B3.0 creados por los
 * servicios reales (docs/BLOCK3_SPEC.md §21.4). Cubre lo que las E2E no pueden reproducir con
 * el reloj real del servidor: huecos de horas, medianoche, semana 53 y versiones a media sesión.
 */
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

const setClock = (at: string) => vi.setSystemTime(new Date(at));
let world: ScenarioWorld;
const by = (key: string) => world.scenarios.find((s) => s.key === key)!;
const analyze = async (
  key: string,
  perspective: Perspective = 'original',
  ctx?: TrainerContext,
) => {
  const s = by(key);
  return getSessionAnalysis(ctx ?? world.contexts.trainer, {
    clientId: s.clientId,
    sessionId: s.sessionId,
    perspective,
  });
};
const a = async (key: string, perspective: Perspective = 'original') =>
  (await analyze(key, perspective))!.analysis;

beforeEach(async () => {
  world = await buildAnalysisScenarios({ setClock });
});
afterEach(() => world.db.close());

describe('A8 sobre los escenarios', () => {
  it('completa: completada, 5 de 5, magnitudes por separado y todo igual a lo propuesto', async () => {
    const x = await a('completa');
    expect(x.status).toBe('completed');
    expect(x.profile.structural.sets).toEqual({ done: 5, notDone: 0, unregistered: 0, total: 5 });
    expect(x.executed).toMatchObject({ reps: 30, seconds: 60, meters: null, tonnageKg: 480 });
    expect(x.prescribed).toMatchObject({
      reps: { min: 30, max: 30 },
      seconds: 60,
      tonnageKg: { min: 480, max: 480 },
    });
    expect(x.profile.effort.rir).toMatchObject({ matches: 3, no_data: 0 });
    expect(x.profile.proposal).toEqual({ equal: 5, different: 0, done: 5 });
    expect(x.daysFromPlanned).toBe(0);
  });

  it('parcial: cierre parcial (no «completada»), una no realizada, una sin registrar y el comentario, sin motivos inventados', async () => {
    const x = await a('parcial');
    expect(x.status).toBe('partial');
    expect([x.finishReason, x.pendingSetsConfirmed]).toEqual(['ended_early', 1]);
    expect(x.profile.structural.sets).toEqual({ done: 3, notDone: 1, unregistered: 1, total: 5 });
    expect(x.exercises.map((e) => e.status)).toEqual(['partial', 'partial']);
    expect(x.comment).toBe('Hoy no me encontraba bien');
    // Lo no hecho no suma: 20 de 30 rep. y 30 de 60 s.
    expect(x.executed).toMatchObject({ reps: 20, seconds: 30, tonnageKg: 320 });
  });

  it('sin empezar: la referencia original es la vigente al terminar su día; si un cambio mueve la fecha, no determinada (P-121)', async () => {
    const before = await a('sin-empezar');
    expect(before.status).toBe('overdue');
    expect(before.reference).toEqual({
      kind: 'determined',
      version: 1,
      basis: 'end_of_planned_day',
    });
    expect(before.profile.structural.sets).toEqual({
      done: 0,
      notDone: 0,
      unregistered: 3,
      total: 3,
    });
    expect(before.duration.state.kind).toBe('not_started');

    const id = by('sin-empezar').sessionId;
    setClock('2026-11-24T12:30:00.000Z');
    await startSessionChange(world.contexts.trainer, id);
    const draft = (await world.repos.training.getSession(id))!;
    expect(
      (
        await publishSessionChange(world.contexts.trainer, {
          sessionId: id,
          expectedRevision: draft.draftRevision,
          content: { ...draft.draft!, plannedDate: '2026-11-26' },
        })
      ).ok,
    ).toBe(true);
    const after = await a('sin-empezar');
    expect(after.reference).toEqual({ kind: 'undetermined', reason: 'planned_dates_differ' });
    expect(after.plannedDateChanged).toBe(true);
    expect(after.exercises).toEqual([]);
    expect(after.prescribed.unregisteredUnknown).toBe(true);
    // La vigente sí está disponible; nunca se usa en lugar de la original.
    const current = await a('sin-empezar', 'current');
    expect(current.reference).toMatchObject({ kind: 'determined', version: 2, basis: 'current' });
    expect(current.plannedDate).toBe('2026-11-26');
  });

  it('versiones (AC-B3-07): original frente a la versión de cada serie; vigente frente a la v3; la v3 no cambia la original', async () => {
    const original = await a('versiones');
    expect(original.versionsUsed).toEqual([1, 2]);
    expect(original.exercises.map((e) => e.name)).toEqual(['Sentadilla goblet']);
    expect(original.exercises[0]!.sets.map((s) => [s.referenceVersion, s.load?.condition])).toEqual(
      [
        [1, 'matches'],
        [1, 'matches'],
        [2, 'matches'],
      ],
    );
    expect(original.profile.structural.sets.total).toBe(3);
    const current = await a('versiones', 'current');
    expect(
      current.exercises[0]!.sets.map((s) => [
        s.referenceVersion,
        s.load?.condition,
        s.load?.difference,
      ]),
    ).toEqual([
      [3, 'matches', null],
      [3, 'differs', 2],
      [3, 'matches', null],
    ]);
    // La plancha que añadió la v3 aparece en la vigente, sin registrar.
    expect(current.profile.structural.sets).toEqual({
      done: 3,
      notDone: 0,
      unregistered: 2,
      total: 5,
    });
    // Las cifras de lo ejecutado no dependen de la perspectiva; el tiempo pasa a aplicar (0 s
    // registrados) porque la vigente prescribe una plancha.
    expect([current.executed.reps, current.executed.tonnageKg, current.executed.sets]).toEqual([
      original.executed.reps,
      original.executed.tonnageKg,
      original.executed.sets,
    ]);
    expect([original.executed.seconds, current.executed.seconds]).toEqual([null, 0]);
    expect(original.versions.map((v) => [v.number, v.executionState, v.reason])).toEqual([
      [1, 'not_started', null],
      [2, 'in_progress', null],
      [3, 'finished', 'Ajuste para la próxima vez'],
    ]);
  });

  it('repeticiones y rangos (AC-B3-04): niveles 1 y 2, sin tolerancias', async () => {
    const reps = await a('repeticiones');
    expect(
      reps.exercises[0]!.sets.map((s) => [s.quantity?.condition, s.quantity?.difference]),
    ).toEqual([
      ['matches', null],
      ['differs', -1],
      ['differs', 1],
    ]);
    const range = await a('rangos');
    expect(
      range.exercises[0]!.sets.map((s) => [s.quantity?.condition, s.quantity?.difference]),
    ).toEqual([
      ['within', null],
      ['below', -1],
      ['above', 1],
    ]);
    expect(
      range.exercises[0]!.sets.map((s) => [s.effort[0]?.condition, s.effort[0]?.difference]),
    ).toEqual([
      ['within', null],
      ['below', -1],
      ['above', 1],
    ]);
    expect(range.prescribed.reps).toEqual({ min: 24, max: 30 });
    expect(range.prescribed.tonnageKg).toEqual({ min: 480, max: 600 });
  });

  it('cargas: −3 kg (−7,5 %) y +2,5 kg (+6,3 %); esfuerzo ausente: «sin dato» fuera del denominador', async () => {
    const loads = await a('cargas');
    expect(
      loads.exercises[0]!.sets.map((s) => [
        s.load?.condition,
        s.load?.difference,
        s.load?.differencePercent,
      ]),
    ).toEqual([
      ['matches', null, null],
      ['differs', -3, -7.5],
      ['differs', 2.5, 6.3],
    ]);
    const effort = await a('esfuerzo-ausente');
    expect(effort.profile.effort.rir).toMatchObject({ matches: 1, no_data: 2 });
    expect(effort.profile.effort.rpe).toMatchObject({ matches: 1, no_data: 1 });
  });

  it('valores propuestos (AC-B3-27): «2 de 3 series iguales a lo propuesto»', async () => {
    const x = await a('valores-propuestos');
    expect(x.profile.proposal).toEqual({ equal: 2, different: 1, done: 3 });
    expect(x.exercises[0]!.sets.map((s) => s.proposal?.overall)).toEqual([
      'equal',
      'equal',
      'different',
    ]);
  });

  it('modalidades (AC-B3-05, AC-B3-06): cada magnitud en su fila; ni peso corporal, ni lastre, ni asistencia en el tonelaje', async () => {
    const x = await a('modalidades');
    expect(x.executed).toEqual({
      sets: { reps: 21, seconds: 2, meters: 4 },
      reps: 158,
      repsPerSide: 16,
      seconds: 90,
      meters: 100,
      tonnageKg: 1760,
      tonnageSets: 5,
      tonnageExcluded: { per_side_basis: 2, reps_per_side: 2, self_selected: 2, not_by_reps: 2 },
    });
    expect(x.prescribed.tonnageKg).toEqual({ min: 1680, max: 1760 });
    const assisted = x.exercises.find((e) => e.prescriptionId === 'itm-pullup-assisted')!;
    expect(assisted.sets.map((s) => s.load?.condition)).toEqual(['matches', 'no_data']);
    const band = x.exercises.find((e) => e.prescriptionId === 'itm-band')!;
    expect(band.sets[0]!.load).toMatchObject({ condition: 'matches', label: 'descriptor' });
    const self = x.exercises.find((e) => e.prescriptionId === 'itm-self')!;
    expect(self.sets[0]!.load?.condition).toBe('not_applicable');
  });

  it('pausas y huecos (AC-B3-10, AC-B3-29): advertencia, aviso, sin descontar nada', async () => {
    const paused = await a('pausas');
    expect(paused.duration).toMatchObject({
      state: { kind: 'calculated', elapsedSeconds: 2400, calculatedSeconds: 1200 },
      pausedSeconds: 1200,
      gaps: [],
    });
    const warning = await a('hueco-advertencia');
    expect(warning.duration.state).toMatchObject({
      kind: 'calculated',
      elapsedSeconds: 33_300,
      calculatedSeconds: 33_300,
    });
    expect(warning.duration.gaps).toEqual([
      expect.objectContaining({ seconds: 32_700, level: 'warning' }),
    ]);
    const notice = await a('hueco-aviso');
    expect(notice.duration.gaps).toEqual([
      expect.objectContaining({ seconds: 2700, level: 'notice' }),
    ]);
    // Ningún registro se toca: el análisis solo lee.
    expect(
      world.db
        .prepare(
          'SELECT COUNT(*) AS n FROM session_log WHERE session_id = @id AND paused_seconds = 0',
        )
        .get<{ n: number }>({ id: by('hueco-advertencia').sessionId })!.n,
    ).toBe(1);
  });

  it('en curso: sin duración y con lo confirmado', async () => {
    const x = await a('en-curso');
    expect(x.status).toBe('in_progress');
    expect(x.duration.state.kind).toBe('unfinished');
    expect(x.profile.structural.sets.done).toBe(1);
  });
});

describe('fechas y totales del día (P-93, P-94; AC-B3-03, AC-B3-08, AC-B3-09)', () => {
  const day = (date: string) =>
    getExecutionDay(world.contexts.trainer, { clientId: by('completa').clientId, date });

  it('dos sesiones el mismo día: cada una aparte y el día como suma, magnitud a magnitud', async () => {
    const d = (await day('2026-11-13'))!;
    expect(d.executed.map((s) => [s.label, s.executed.reps, s.executed.tonnageKg])).toEqual([
      ['Mañana', 30, 480],
      ['Tarde', 27, 540],
    ]);
    expect([d.totals.reps, d.totals.tonnageKg, d.totals.sets.reps]).toEqual([57, 1020, 6]);
    expect(d.planned.map((s) => s.label)).toEqual(['Mañana', 'Tarde']);
  });

  it('trasladada: su carga cuenta el día en que se hizo; en su día previsto, solo como prevista', async () => {
    const planned = (await day('2026-11-16'))!;
    expect(planned.executed).toEqual([]);
    expect(planned.totals.reps).toBeNull();
    expect(planned.planned).toEqual([
      expect.objectContaining({ executedOn: '2026-11-17', daysFromPlanned: 1 }),
    ]);
    const done = (await day('2026-11-17'))!;
    expect(done.executed).toEqual([
      expect.objectContaining({ plannedDate: '2026-11-16', daysFromPlanned: 1 }),
    ]);
    expect(done.totals.reps).toBe(10);
  });

  it('medianoche: las series de después de las 00:00 cuentan en el día de inicio', async () => {
    const x = await a('medianoche');
    expect(x.executedOn).toBe('2026-11-18');
    expect((await day('2026-11-18'))!.totals.reps).toBe(20);
    expect((await day('2026-11-19'))!.executed.map((s) => s.sessionId)).not.toContain(
      by('medianoche').sessionId,
    );
  });

  it('semana 53: la sesión del 1 de enero de 2027 cae en 2026-W53 (28 dic – 3 ene)', async () => {
    const x = await a('semana-53');
    expect(x.executedOn).toBe('2027-01-01');
    expect(x.executedWeek).toEqual({ key: '2026-W53', start: '2026-12-28', end: '2027-01-03' });
    const d = (await day('2027-01-01'))!;
    expect(d.week).toEqual({ key: '2026-W53', start: '2026-12-28', end: '2027-01-03' });
    expect(d.executed).toHaveLength(1);
  });

  it('invariante: los totales del día son la suma de las sesiones de ese día', async () => {
    for (const date of ['2026-11-09', '2026-11-13', '2026-11-17', '2026-11-23']) {
      const d = (await day(date))!;
      const sum = (pick: (v: (typeof d.executed)[number]['executed']) => number | null) =>
        d.executed.reduce<number | null>((acc, s) => {
          const v = pick(s.executed);
          return v === null ? acc : (acc ?? 0) + v;
        }, null);
      expect(d.totals.reps).toBe(sum((v) => v.reps));
      expect(d.totals.seconds).toBe(sum((v) => v.seconds));
      expect(d.totals.meters).toBe(sum((v) => v.meters));
      expect(d.totals.tonnageKg).toBe(sum((v) => v.tonnageKg));
    }
  });

  it('una fecha no válida no se analiza', async () => {
    expect(await day('2026-13-45')).toBeNull();
  });
});

describe('panel: sesiones de los últimos 7 días', () => {
  it('las empezadas entre el 18 y el 24, las más recientes primero, con su estado', async () => {
    const recent = await listRecentExecutions(world.contexts.trainer);
    expect(recent.map((r) => r.executedOn)).toEqual([
      '2026-11-24',
      '2026-11-23',
      '2026-11-22',
      '2026-11-21',
      '2026-11-20',
      '2026-11-19',
      '2026-11-18',
    ]);
    expect(recent[0]).toMatchObject({ status: 'in_progress', title: expect.any(String) });
  });
});

describe('permisos e identidades', () => {
  it('otro entrenador, la clienta, otro cliente en la URL o un borrador: nada (null)', async () => {
    expect(await analyze('completa', 'original', world.contexts.otherTrainer)).toBeNull();
    // La clienta (con su propia identidad) no accede al análisis del entrenador.
    const asClient = world.contexts.lucia as unknown as TrainerContext;
    expect(await analyze('completa', 'original', asClient)).toBeNull();
    expect(
      await getSessionAnalysis(world.contexts.trainer, {
        clientId: 'c-marta',
        sessionId: by('completa').sessionId,
        perspective: 'original',
      }),
    ).toBeNull();
    expect(
      await getExecutionDay(world.contexts.otherTrainer, {
        clientId: by('completa').clientId,
        date: '2026-11-09',
      }),
    ).toBeNull();
    expect(
      await getExecutionDay(asClient, { clientId: by('completa').clientId, date: '2026-11-09' }),
    ).toBeNull();
    expect(await listRecentExecutions(world.contexts.otherTrainer)).toEqual([]);
    expect(
      await getSessionAnalysis(world.contexts.trainer, {
        clientId: by('completa').clientId,
        sessionId: 's-no-existe',
        perspective: 'original',
      }),
    ).toBeNull();
  });

  it('la perspectiva solo admite «vigente»; cualquier otro valor es la original', () => {
    expect(parsePerspective('vigente')).toBe('current');
    expect(parsePerspective(undefined)).toBe('original');
    expect(parsePerspective(['vigente'])).toBe('original');
    expect(parsePerspective('<script>')).toBe('original');
  });
});

describe('idempotencia y versión de inicio', () => {
  it('reenviar el mismo comando o una serie ya registrada no cambia nada', async () => {
    const before = await a('completa');
    const s = by('completa');
    const lucia = world.contexts.lucia;
    setClock('2026-11-24T12:40:00.000Z');
    const duplicate = await executeClientCommand(lucia, s.sessionId, {
      commandId: 'cmd-repetido-001',
      clientId: s.clientId,
      type: 'log_set',
      versionNumber: 1,
      prescriptionId: 'itm-goblet',
      setNumber: 1,
      supersedes: null,
      completed: true,
      reps: 12,
      durationS: null,
      distanceM: null,
      load: { kind: 'external', kg: 16 },
      rir: 2,
      rpe: null,
      note: null,
      device: {
        recordedAt: '2026-11-09T08:30:00.000Z',
        timeZone: 'Europe/Madrid',
        utcOffsetMinutes: 60,
      },
    });
    expect(duplicate.status).toBe(409);
    expect(await a('completa')).toEqual(before);
  });

  it('una ejecución anterior a la migración 002 sin series: referencia no determinada, con el motivo', async () => {
    const s = by('sin-empezar');
    setClock('2026-11-24T12:45:00.000Z');
    const started = await executeClientCommand(world.contexts.lucia, s.sessionId, {
      commandId: 'cmd-inicio-antiguo-1',
      clientId: s.clientId,
      type: 'start',
      versionNumber: 1,
      device: {
        recordedAt: '2026-11-24T12:44:30.000Z',
        timeZone: 'Europe/Madrid',
        utcOffsetMinutes: 60,
      },
    });
    expect(started.status).toBe(200);
    expect((await a('sin-empezar')).reference).toEqual({
      kind: 'determined',
      version: 1,
      basis: 'start_version',
    });
    // Simula una base creada antes de la 002: se sembró antes y la 002 se aplicó después del inicio.
    world.db
      .prepare("UPDATE meta SET value = '2026-10-01T00:00:00.000Z' WHERE key = 'seeded_at'")
      .run();
    world.db
      .prepare(
        "UPDATE schema_migrations SET applied_at = '2026-11-30T00:00:00.000Z' WHERE version = 2",
      )
      .run();
    expect((await a('sin-empezar')).reference).toEqual({
      kind: 'undetermined',
      reason: 'start_version_deduced',
    });
  });
});

describe('rendimiento (objetivo de diseño, medido en este equipo)', () => {
  it('A8 de cada uno de los 17 escenarios y un día con dos sesiones, cada uno por debajo de 100 ms', async () => {
    await a('completa'); // calentamiento
    // Mediana de 3 ejecuciones de cada una: mide el código, no el ruido de las pruebas en paralelo.
    const median = async (fn: () => Promise<unknown>) => {
      const times: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const t0 = performance.now();
        await fn();
        times.push(performance.now() - t0);
      }
      return times.sort((x, y) => x - y)[1]!;
    };
    for (const s of world.scenarios) {
      expect(await median(() => a(s.key)), s.key).toBeLessThan(100);
    }
    expect(
      await median(() =>
        getExecutionDay(world.contexts.trainer, {
          clientId: by('completa').clientId,
          date: '2026-11-13',
        }),
      ),
    ).toBeLessThan(100);
  });
});
