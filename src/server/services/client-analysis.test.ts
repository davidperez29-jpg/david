import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ClientAnalysisVM } from '@/contracts/analysis';
import { type Perspective } from '@/domain/analysis/reference';
import { type TrainerContext } from '../context';
import { DEMO_CLIENT_ID } from '../repositories/demo/dataset';
import {
  buildAnalysisScenarios,
  buildTrainingYear,
  type ScenarioWorld,
} from './analysis-scenarios';
import { executeClientCommand } from './client-execution';
import { visibleVariants } from './library';
import {
  getClientAnalysis,
  getExerciseEvolution,
  getSessionAnalysis,
  parseFilters,
} from './trainer-analysis';
import { publishSessionChange, startSessionChange } from './trainer-sessions';

/**
 * B3.2 · A9 (cliente por periodos) y A10 (evolución de un ejercicio) sobre una base SQLite real,
 * con los escenarios de B3.0 creados por los servicios reales. Lucía (`c-lucia`) tiene los
 * escenarios del 9 al 24 de noviembre de 2026 y el del 1 de enero de 2027 (semana 53).
 */
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

const setClock = (at: string) => vi.setSystemTime(new Date(at));
const LUCIA = 'c-lucia';
let world: ScenarioWorld;
const by = (key: string) => world.scenarios.find((s) => s.key === key)!;

beforeEach(async () => {
  world = await buildAnalysisScenarios({ setClock });
});
afterEach(() => world.db.close());

type Query = Record<string, string | string[] | undefined>;
const a9 = async (
  query: Query = {},
  perspective: Perspective = 'original',
  ctx: TrainerContext = world.contexts.trainer,
  clientId = LUCIA,
) => getClientAnalysis(ctx, { clientId, query, perspective });
const ok = async (query: Query = {}, perspective: Perspective = 'original') =>
  (await a9(query, perspective))!;
const week = (vm: ClientAnalysisVM, key: string) =>
  vm.analysis.weeks.find((w) => w.week.key === key)!;

/** La clienta empieza (y termina, con una serie) una sesión en el instante dado. */
async function runSession(sessionId: string, at: string, commandPrefix: string) {
  setClock(at);
  const lucia = { ...world.contexts.lucia, today: at.slice(0, 10) };
  const device = { recordedAt: at, timeZone: 'Europe/Madrid', utcOffsetMinutes: 60 };
  const started = await executeClientCommand(lucia, sessionId, {
    commandId: `${commandPrefix}-inicio`,
    clientId: LUCIA,
    type: 'start',
    versionNumber: 1,
    device,
  });
  expect(started.status).toBe(200);
}

describe('A9 · periodos y semanas', () => {
  it('4 semanas por defecto hasta la semana de hoy, con las semanas ISO y el anterior y el siguiente', async () => {
    const vm = await ok();
    expect(vm.invalidPeriod).toBe(false);
    expect(vm.analysis.period).toMatchObject({
      kind: 'weeks4',
      from: '2026-11-02',
      to: '2026-11-29',
      previous: { from: '2026-10-05', to: '2026-11-01' },
      next: { from: '2026-11-30', to: '2026-12-27' },
    });
    expect(vm.analysis.weeks.map((w) => w.week.key)).toEqual([
      '2026-W45',
      '2026-W46',
      '2026-W47',
      '2026-W48',
    ]);
  });

  it('AC-B3-18 · las semanas vacías aparecen con cero', async () => {
    const vm = await ok({ periodo: '12-semanas' });
    expect(vm.analysis.weeks).toHaveLength(12);
    const empty = vm.analysis.weeks.filter(
      (w) => w.planned.sessions === 0 && w.executed.sessions === 0,
    );
    expect(empty.length).toBeGreaterThan(0);
    for (const w of empty) {
      expect(w.executed.volume.sets).toEqual({ reps: 0, seconds: 0, meters: 0 });
      expect(w.planned.volume.sets).toEqual({ reps: 0, seconds: 0, meters: 0 });
    }
  });

  it('AC-B3-14 · la semana 53 de 2026 va del 28 de diciembre al 3 de enero y recoge la sesión del 1 de enero', async () => {
    const vm = await ok({ periodo: 'semana', fecha: '2027-01-01' });
    expect(vm.analysis.weeks).toHaveLength(1);
    const w53 = vm.analysis.weeks[0]!;
    expect(w53.week).toEqual({ key: '2026-W53', start: '2026-12-28', end: '2027-01-03' });
    expect([w53.planned.sessions, w53.executed.sessions]).toEqual([1, 1]);
    expect(vm.analysis.sessions.map((s) => s.sessionId)).toEqual([by('semana-53').sessionId]);
  });

  it('un rango libre de hasta 53 semanas; lo que no es válido da el periodo por defecto y lo avisa', async () => {
    const range = await ok({ periodo: 'rango', desde: '2026-11-10', hasta: '2026-11-18' });
    expect(range.invalidPeriod).toBe(false);
    expect(range.analysis.period).toMatchObject({
      kind: 'range',
      from: '2026-11-10',
      to: '2026-11-18',
    });
    // Semanas parciales: solo cuentan los días del rango (el 9 de noviembre queda fuera).
    expect(range.analysis.sessions.some((s) => s.sessionId === by('completa').sessionId)).toBe(
      false,
    );
    for (const query of [
      { periodo: 'rango', desde: '2026-11-18', hasta: '2026-11-10' },
      { periodo: 'rango', desde: '2025-01-01', hasta: '2026-11-18' },
      { periodo: 'rango', desde: '2026-02-30', hasta: '2026-03-02' },
      { periodo: 'trimestre' },
      { periodo: 'semana', fecha: 'ayer' },
    ]) {
      const vm = await ok(query);
      expect(vm.invalidPeriod, JSON.stringify(query)).toBe(true);
      expect(vm.analysis.period.kind).toBe('weeks4');
    }
    // Un formulario GET envía los campos vacíos: no son un error.
    expect(
      (await ok({ periodo: '4-semanas', fecha: '', desde: '', hasta: '' })).invalidPeriod,
    ).toBe(false);
  });
});

describe('A9 · planificado frente a ejecutado', () => {
  it('AC-B3-19 · una sesión hecha en otra semana aparece en las dos, cada una con su papel', async () => {
    const s = by('sin-empezar'); // prevista el miércoles 11 (W46)
    await runSession(s.sessionId, '2026-11-17T09:00:00.000Z', 'cmd-traslado-semana');
    setClock('2026-11-24T12:00:00.000Z');
    const vm = await ok();
    const w46 = week(vm, '2026-W46');
    const w47 = week(vm, '2026-W47');
    expect(w46.planned.movedOut).toEqual([
      expect.objectContaining({
        sessionId: s.sessionId,
        executedOn: '2026-11-17',
        executedWeek: '2026-W47',
      }),
    ]);
    expect(w47.executed.movedIn).toEqual([
      expect.objectContaining({
        sessionId: s.sessionId,
        plannedOn: '2026-11-11',
        plannedWeek: '2026-W46',
      }),
    ]);
    // Cuenta como prevista en la W46 y como empezada en la W47, nunca al revés.
    const planned46 = vm.analysis.sessions.find((r) => r.sessionId === s.sessionId)!;
    expect(planned46).toMatchObject({
      plannedOn: '2026-11-11',
      executedOn: '2026-11-17',
      moved: true,
    });
    expect(vm.analysis.adherence.executedOtherDay).toBeGreaterThanOrEqual(1);
    // La trasladada dentro de la misma semana (16 → 17) no aparece como traslado de semana.
    const same = by('trasladada');
    expect(w47.planned.movedOut.some((m) => m.sessionId === same.sessionId)).toBe(false);
    expect(w47.executed.movedIn.some((m) => m.sessionId === same.sessionId)).toBe(false);
    expect(vm.analysis.sessions.find((r) => r.sessionId === same.sessionId)!.moved).toBe(true);
  });

  it('lo planificado va por fecha prevista y lo ejecutado por fecha de ejecución, sin sumarse', async () => {
    const vm = await ok();
    const executed = vm.analysis.weeks.reduce((n, w) => n + w.executed.sessions, 0);
    const startedInPeriod = world.scenarios.filter(
      (s) =>
        s.facts.executedOn &&
        s.facts.executedOn >= '2026-11-02' &&
        s.facts.executedOn <= '2026-11-29',
    );
    expect(executed).toBe(startedInPeriod.length);
    const planned = vm.analysis.weeks.reduce((n, w) => n + w.planned.sessions, 0);
    expect(planned).toBe(vm.analysis.adherence.planned);
    expect(Object.values(vm.analysis.adherence.byStatus).reduce((n, x) => n + x, 0)).toBe(planned);
  });

  it('P-118 · si la fecha prevista cambia, en la original queda «no determinada» y aparte; en la vigente, en su nueva semana', async () => {
    const s = by('sin-empezar');
    setClock('2026-11-24T10:00:00.000Z');
    await startSessionChange(world.contexts.trainer, s.sessionId);
    const draft = (await world.repos.training.getSession(s.sessionId))!;
    const published = await publishSessionChange(world.contexts.trainer, {
      sessionId: s.sessionId,
      expectedRevision: draft.draftRevision,
      content: { ...draft.draft!, plannedDate: '2026-11-26' },
    });
    expect(published.ok).toBe(true);

    const original = await ok();
    expect(original.analysis.undeterminedPlanning).toEqual([
      expect.objectContaining({ sessionId: s.sessionId }),
    ]);
    for (const w of original.analysis.weeks) {
      expect(w.planned.movedOut.map((m) => m.sessionId)).not.toContain(s.sessionId);
    }
    expect(
      original.analysis.sessions.find((r) => r.sessionId === s.sessionId)!.plannedOn,
    ).toBeNull();

    const current = await ok({}, 'current');
    expect(current.analysis.undeterminedPlanning).toEqual([]);
    const row = current.analysis.sessions.find((r) => r.sessionId === s.sessionId)!;
    expect(row.plannedOn).toBe('2026-11-26');
    expect(week(current, '2026-W48').planned.sessions).toBe(
      week(original, '2026-W48').planned.sessions + 1,
    );
  });

  it('P-114 · duración: total con y sin las sesiones con advertencia; los avisos se cuentan; las no calculables, aparte', async () => {
    const vm = await ok();
    const d = vm.analysis.duration;
    expect(d.warned).toBeGreaterThanOrEqual(1);
    expect(d.notices).toBeGreaterThanOrEqual(1);
    expect(d.all.sessions).toBe(d.withoutWarned.sessions + d.warned);
    // Las cifras son la suma de las de A8, sesión a sesión.
    let all = 0;
    let withoutWarned = 0;
    for (const r of vm.analysis.sessions.filter((x) => x.executedOn)) {
      const a8 = (await getSessionAnalysis(world.contexts.trainer, {
        clientId: LUCIA,
        sessionId: r.sessionId,
        perspective: 'original',
      }))!.analysis;
      if (a8.duration.state.kind !== 'calculated') continue;
      all += a8.duration.state.calculatedSeconds;
      const warned = a8.duration.gaps.some(
        (g) => g.level === 'warning' || g.level === 'not_evaluable',
      );
      if (!warned) withoutWarned += a8.duration.state.calculatedSeconds;
    }
    expect(d.all.seconds).toBe(all);
    expect(d.withoutWarned.seconds).toBe(withoutWarned);
    expect(d.without.unfinished).toBeGreaterThanOrEqual(1); // «en curso»
  });

  it('P-123 · lastre y asistencia en los totales del periodo, aparte del tonelaje', async () => {
    const vm = await ok();
    expect(vm.analysis.executedTotals.addedLoad).toMatchObject({ kg: 50, sets: 2, reps: 10 });
    expect(vm.analysis.executedTotals.assistance).toMatchObject({
      sets: 2,
      reps: 12,
      withKgReps: 6,
      kgTimesReps: 120,
      noData: 1,
    });
  });
});

describe('A9 · patrones (P-98), ejercicios y filtros', () => {
  it('AC-B3-20 · los dos recuentos por patrón coinciden con la biblioteca', async () => {
    const vm = await ok();
    const library = new Map(
      (await visibleVariants(world.contexts.trainer)).map((v) => [v.id, v.patterns]),
    );
    const primary = new Map<string, number>();
    const all = new Map<string, number>();
    let done = 0;
    for (const r of vm.analysis.sessions.filter((x) => x.executedOn)) {
      const a8 = (await getSessionAnalysis(world.contexts.trainer, {
        clientId: LUCIA,
        sessionId: r.sessionId,
        perspective: 'original',
      }))!.analysis;
      for (const set of a8.exercises.flatMap((e) => e.sets).filter((x) => x.status === 'done')) {
        done += 1;
        for (const p of library.get(set.variantId) ?? []) {
          all.set(p.id, (all.get(p.id) ?? 0) + 1);
          if (p.role === 'primary') primary.set(p.id, (primary.get(p.id) ?? 0) + 1);
        }
      }
    }
    const asMap = (list: { patternId: string; sets: number }[]) =>
      new Map(list.map((x) => [x.patternId, x.sets]));
    expect(vm.analysis.patterns.doneSets).toBe(done);
    expect(asMap(vm.analysis.patterns.primary)).toEqual(primary);
    expect(asMap(vm.analysis.patterns.all)).toEqual(all);
    // Con los secundarios, ningún patrón cuenta menos que como principal.
    for (const [id, n] of primary) expect(all.get(id)!).toBeGreaterThanOrEqual(n);
    expect(vm.analysis.patterns.all.reduce((n, x) => n + x.sets, 0)).toBeGreaterThan(
      vm.analysis.patterns.primary.reduce((n, x) => n + x.sets, 0),
    );
  });

  it('filtro por ejercicio: solo sus series; las sesiones siguen listadas', async () => {
    const all = await ok();
    const vm = await ok({ ejercicio: 'ex-goblet-squat' });
    expect(vm.filters.variantId).toBe('ex-goblet-squat');
    expect(vm.analysis.exercises.map((e) => e.variantId)).toEqual(['ex-goblet-squat']);
    expect(vm.analysis.sessions.length).toBe(all.analysis.sessions.length);
    expect(vm.analysis.patterns.doneSets).toBe(
      all.analysis.exercises.find((e) => e.variantId === 'ex-goblet-squat')!.doneSets,
    );
    // Lo filtrado fuera no reaparece como serie extra.
    expect(vm.analysis.missing.outsideReference).toBe(0);
  });

  it('filtro por patrón: solo principal, o principal y secundarios', async () => {
    const library = new Map(
      (await visibleVariants(world.contexts.trainer)).map((v) => [v.id, v.patterns]),
    );
    const base = await ok();
    const pattern = base.analysis.patterns.primary[0]!.patternId;
    const primaryOnly = await ok({ patron: pattern });
    for (const e of primaryOnly.analysis.exercises) {
      expect(library.get(e.variantId)!.some((p) => p.id === pattern && p.role === 'primary')).toBe(
        true,
      );
    }
    const withSecondary = await ok({ patron: pattern, patrones: 'todos' });
    for (const e of withSecondary.analysis.exercises) {
      expect(library.get(e.variantId)!.some((p) => p.id === pattern)).toBe(true);
    }
    expect(withSecondary.analysis.exercises.length).toBeGreaterThanOrEqual(
      primaryOnly.analysis.exercises.length,
    );
  });

  it('parámetros no válidos vuelven a su valor por defecto', () => {
    expect(
      parseFilters({
        patron: 'no-existe',
        ejercicio: '../../etc',
        n: '0',
        m: '99',
        orden: 'raro',
        magnitud: 'calorias',
      }),
    ).toEqual({
      pattern: null,
      patternMode: 'primary',
      variantId: null,
      repeat: { n: 3, m: 5 },
      sort: 'desc',
      magnitude: 'sets',
    });
    expect(parseFilters({ n: '7', m: '4', orden: 'asc', magnitud: 'tonelaje' })).toMatchObject({
      repeat: { n: 4, m: 4 },
      sort: 'asc',
      magnitude: 'tonnage',
    });
  });

  it('P-104 · diferencias repetidas: N de las últimas M, ajustables y sin guardarse', async () => {
    const loose = await ok({ n: '1', m: '20' });
    expect(loose.analysis.repeated.length).toBeGreaterThan(0);
    for (const r of loose.analysis.repeated) {
      expect(r.outside).toBeGreaterThanOrEqual(1);
      expect(r.considered).toBeLessThanOrEqual(20);
      expect(
        r.dimensions.quantity + r.dimensions.load + r.dimensions.effort,
      ).toBeGreaterThanOrEqual(r.outside);
    }
    const strict = await ok({ n: '20', m: '20' });
    expect(strict.analysis.repeated).toEqual([]);
    // Nada se guarda: la misma petición sin parámetros vuelve a 3 de 5.
    expect((await ok()).filters.repeat).toEqual({ n: 3, m: 5 });
  });
});

describe('A9 · datos de la semilla y permisos', () => {
  it('AC-B3-22 · ningún `perceived_effort` de la semilla entra en el análisis', async () => {
    const before = await a9(
      { periodo: '12-semanas' },
      'original',
      world.contexts.trainer,
      DEMO_CLIENT_ID,
    );
    expect(before).not.toBeNull();
    expect(before!.analysis.executedTotals.sets.reps).toBeGreaterThan(0);
    expect(JSON.stringify(before)).not.toMatch(/perceived|sessionRpe|srpe/i);
    const seeded = world.db
      .prepare('SELECT COUNT(*) AS n FROM session_log WHERE perceived_effort IS NOT NULL')
      .get() as { n: number };
    expect(seeded.n).toBeGreaterThan(0);
    // Solo en esta base de prueba en memoria: se quita el disparador que protege las ejecuciones
    // terminadas para poder cambiar el valor guardado y ver que el análisis no lo usa.
    world.db.exec('DROP TRIGGER session_log_finish_once');
    const changed = world.db
      .prepare(
        'UPDATE session_log SET perceived_effort = 10 - perceived_effort WHERE perceived_effort IS NOT NULL',
      )
      .run();
    expect(changed.changes).toBe(seeded.n);
    const after = await a9(
      { periodo: '12-semanas' },
      'original',
      world.contexts.trainer,
      DEMO_CLIENT_ID,
    );
    expect(after).toEqual(before);
  });

  it('otro entrenador, una clienta o un cliente inexistente: nada, sin revelar si existe', async () => {
    expect(await a9({}, 'original', world.contexts.otherTrainer)).toBeNull();
    expect(await a9({}, 'original', world.contexts.lucia as unknown as TrainerContext)).toBeNull();
    expect(await a9({}, 'original', world.contexts.trainer, 'c-no-existe')).toBeNull();
    const evolution = (ctx: TrainerContext, variantId = 'ex-goblet-squat', clientId = LUCIA) =>
      getExerciseEvolution(ctx, { clientId, variantId, query: {}, perspective: 'original' });
    expect(await evolution(world.contexts.otherTrainer)).toBeNull();
    expect(await evolution(world.contexts.marta as unknown as TrainerContext)).toBeNull();
    expect(await evolution(world.contexts.trainer, '../secreto')).toBeNull();
    expect(await evolution(world.contexts.trainer, 'ex-goblet-squat', 'c-no-existe')).toBeNull();
  });
});

describe('A10 · evolución de un ejercicio', () => {
  it('sesión a sesión por fecha de ejecución, cortada cuando cambia la modalidad', async () => {
    const vm = (await getExerciseEvolution(world.contexts.trainer, {
      clientId: LUCIA,
      variantId: 'ex-goblet-squat',
      query: {},
      perspective: 'original',
    }))!;
    expect(vm.period.kind).toBe('weeks12');
    const sessions = vm.evolution.segments.flatMap((s) => s.sessions);
    expect(sessions.length).toBe(vm.evolution.sessions);
    expect(sessions.length).toBeGreaterThan(3);
    const dates = sessions.map((s) => s.executedOn);
    expect([...dates].sort()).toEqual(dates);
    for (const s of sessions) {
      expect(s.sets.every((x) => x.variantId === 'ex-goblet-squat')).toBe(true);
      expect(s.doneSets).toBeGreaterThan(0);
    }
    for (const segment of vm.evolution.segments) {
      const keys = new Set(segment.sessions.flatMap((s) => s.sets.map((x) => x.modality?.key)));
      if (segment.modality) expect([...keys].filter(Boolean)).toEqual([segment.modality.key]);
    }
    // Nada de 1RM estimado ni tendencias.
    expect(JSON.stringify(vm)).not.toMatch(/1rm|oneRep|trend|tendencia|predic/i);
  });

  it('un ejercicio sin series en el periodo: vacío, no un error', async () => {
    const vm = await getExerciseEvolution(world.contexts.trainer, {
      clientId: LUCIA,
      variantId: 'ex-goblet-squat',
      query: { periodo: 'semana', fecha: '2026-10-01' },
      perspective: 'original',
    });
    expect(vm!.evolution).toEqual({ variantId: 'ex-goblet-squat', segments: [], sessions: 0 });
  });
});

describe('AC-B3-23 · rendimiento de A9 con 52 semanas generadas', () => {
  it('menos de 300 ms (mediana de 5) en el servidor de pruebas', async () => {
    world.db.close();
    const year = await buildTrainingYear({ setClock });
    world = { ...world, db: year.db };
    expect(year.counts).toMatchObject({ published: 156 });
    const query = { periodo: 'rango', desde: year.from, hasta: year.to };
    const run = () =>
      getClientAnalysis(year.trainer, { clientId: year.clientId, query, perspective: 'original' });
    const first = (await run())!;
    expect(first.invalidPeriod).toBe(false);
    expect(first.analysis.weeks).toHaveLength(52);
    expect(first.analysis.adherence.planned).toBe(year.counts.published);
    expect(first.analysis.weeks.reduce((n, w) => n + w.executed.sessions, 0)).toBe(
      year.counts.started,
    );
    const times: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const t0 = performance.now();
      await run();
      times.push(performance.now() - t0);
    }
    const median = [...times].sort((x, y) => x - y)[2]!;
    expect(
      median,
      `mediana ${median.toFixed(0)} ms (${times.map((t) => t.toFixed(0)).join(', ')})`,
    ).toBeLessThan(300);
  }, 60_000);
});
