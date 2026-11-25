import { describe, expect, it } from 'vitest';
import { type PatternAssignment } from '../library/exercise';
import { exerciseEvolution } from './exercise';
import { analyzePeriod, planningDate, resolvePeriod, type PeriodSession } from './period';
import { analyzeSession, assistanceMeanKg, addExecutedVolumes } from './session';
import { input, item, kg, sessionLog, setLog, version } from './test-fixtures';

/**
 * B3.2 · Cliente por periodos (docs/BLOCK3_SPEC.md §8, §9.5 y §9.6): periodos y semanas ISO,
 * planificado por fecha prevista y ejecutado por fecha de ejecución, P-98, P-104, P-114, P-118 y
 * P-123, y la evolución de un ejercicio por tramos de modalidad.
 */
const TODAY = '2026-11-25';

/** Una sesión ejecutada (o no) con un ejercicio de 3 × 10 × 60 kg. */
function session(
  id: string,
  options: {
    planned: string;
    startedAt?: string;
    finishedAt?: string;
    reps?: number[];
    kgs?: number[];
    variant?: string;
    load?: NonNullable<Parameters<typeof item>[2]>['load'];
    pausedSeconds?: number;
    setTimes?: string[];
    perspective?: 'original' | 'current';
    includeVariant?: (variantId: string) => boolean;
  },
): PeriodSession {
  const variant = options.variant ?? 'a';
  const v1 = version(1, [item(variant, 1, options.load ? { load: options.load } : {})], {
    plannedDate: options.planned,
    publishedAt: '2020-01-01T00:00:00.000Z',
  });
  const execution = options.startedAt
    ? {
        log: sessionLog({
          startedAt: options.startedAt,
          ...(options.finishedAt ? { finishedAt: options.finishedAt } : {}),
          pausedSeconds: options.pausedSeconds ?? 0,
        }),
        setLogs: (options.reps ?? [10, 10, 10]).map((r, i) =>
          setLog(
            variant,
            i + 1,
            {
              reps: r,
              load:
                options.load?.kind === 'bodyweight_plus'
                  ? { kind: 'bodyweight_plus', addedKg: options.kgs?.[i] ?? 5 }
                  : kg(options.kgs?.[i] ?? 60),
            },
            {
              ...(options.setTimes?.[i]
                ? { performedAt: options.setTimes[i] }
                : {
                    performedAt: new Date(
                      Date.parse(options.startedAt!) + (i + 1) * 120_000,
                    ).toISOString(),
                  }),
            },
          ),
        ),
      }
    : null;
  return {
    sessionId: id,
    title: `Sesión ${id}`,
    label: null,
    analysis: analyzeSession(
      input({
        versions: [v1],
        execution,
        today: TODAY,
        now: `${TODAY}T12:00:00.000Z`,
        perspective: options.perspective ?? 'original',
        ...(options.includeVariant ? { includeVariant: options.includeVariant } : {}),
      }),
    ),
  };
}

const noPatterns = () => null;

describe('periodos y semanas ISO (P-94; AC-B3-14)', () => {
  it('semana, 4 y 12 semanas terminan en la semana de la fecha; el rango libre, tal cual', () => {
    expect(resolvePeriod({ kind: 'week', date: '2026-11-25' }, TODAY).period).toMatchObject({
      from: '2026-11-23',
      to: '2026-11-29',
      weeks: [{ key: '2026-W48', start: '2026-11-23', end: '2026-11-29' }],
    });
    const four = resolvePeriod({}, TODAY).period;
    expect([four.kind, four.from, four.to, four.weeks.length]).toEqual([
      'weeks4',
      '2026-11-02',
      '2026-11-29',
      4,
    ]);
    expect(resolvePeriod({ kind: 'weeks12' }, TODAY).period.weeks).toHaveLength(12);
    const range = resolvePeriod(
      { kind: 'range', from: '2026-11-10', to: '2026-11-18' },
      TODAY,
    ).period;
    expect([range.from, range.to, range.weeks.map((w) => w.key)]).toEqual([
      '2026-11-10',
      '2026-11-18',
      ['2026-W46', '2026-W47'],
    ]);
  });

  it('la semana 53 de 2026 va del 28 dic 2026 al 3 ene 2027 y cruza el año', () => {
    const p = resolvePeriod({ kind: 'week', date: '2027-01-01' }, TODAY).period;
    expect(p.weeks).toEqual([{ key: '2026-W53', start: '2026-12-28', end: '2027-01-03' }]);
    expect(p.next.from).toBe('2027-01-04');
    expect(resolvePeriod({ kind: 'week', date: '2027-01-04' }, TODAY).period.weeks[0]!.key).toBe(
      '2027-W01',
    );
  });

  it('lo no válido da el periodo por defecto y lo dice', () => {
    for (const q of [
      { kind: 'mes' },
      { kind: 'week', date: '2026-02-30' },
      { kind: 'range', from: '2026-11-20', to: '2026-11-10' },
      { kind: 'range', from: '2025-01-01', to: '2026-11-25' },
    ]) {
      const r = resolvePeriod(q, TODAY);
      expect(r.invalid, JSON.stringify(q)).toBe(true);
      expect(r.period.kind).toBe('weeks4');
    }
  });
});

describe('P-118 · fecha con la que se planifica', () => {
  it('vigente: la vigente; original: la misma si todas coinciden; si no, la de la versión original o no determinada', () => {
    const a = session('s', { planned: '2026-11-10', startedAt: '2026-11-11T09:00:00.000Z' });
    expect(planningDate(a.analysis)).toBe('2026-11-10');
    const v1 = version(1, [item('a', 1)], {
      plannedDate: '2026-11-10',
      publishedAt: '2026-11-01T00:00:00.000Z',
    });
    const v2 = version(2, [item('a', 1)], {
      plannedDate: '2026-11-12',
      publishedAt: '2026-11-05T00:00:00.000Z',
    });
    const started = analyzeSession(
      input({
        versions: [v1, v2],
        execution: {
          log: sessionLog({ startedAt: '2026-11-12T09:00:00.000Z' }),
          setLogs: [setLog('a', 1, { reps: 10, load: kg(60) }, { versionNumber: 1 })],
        },
        today: TODAY,
      }),
    );
    expect(planningDate(started)).toBe('2026-11-10'); // la del último registro (v1)
    const unstarted = analyzeSession(input({ versions: [v1, v2], today: TODAY }));
    expect(planningDate(unstarted)).toBeNull(); // P-121: fechas distintas sin empezar
    expect(
      planningDate(
        analyzeSession(input({ versions: [v1, v2], today: TODAY, perspective: 'current' })),
      ),
    ).toBe('2026-11-12');
  });
});

describe('planificado frente a ejecutado por semana (AC-B3-18, AC-B3-19)', () => {
  const period = resolvePeriod(
    { kind: 'range', from: '2026-11-09', to: '2026-11-29' },
    TODAY,
  ).period;
  // Prevista el domingo 15 (W46) y hecha el lunes 16 (W47); otra prevista y hecha el 18.
  const moved = session('moved', {
    planned: '2026-11-15',
    startedAt: '2026-11-16T09:00:00.000Z',
    finishedAt: '2026-11-16T09:40:00.000Z',
  });
  const normal = session('normal', {
    planned: '2026-11-18',
    startedAt: '2026-11-18T09:00:00.000Z',
    finishedAt: '2026-11-18T09:40:00.000Z',
    reps: [10, 9, 8],
  });
  const p = analyzePeriod({
    period,
    sessions: [moved, normal],
    patternsOf: noPatterns,
    repeat: { n: 3, m: 5 },
  });

  it('la trasladada aparece en las dos semanas, cada una con su papel', () => {
    const [w46, w47, w48] = p.weeks;
    expect(w46!.planned).toMatchObject({
      sessions: 1,
      movedOut: [{ sessionId: 'moved', executedWeek: '2026-W47' }],
    });
    expect(w46!.executed.sessions).toBe(0);
    expect(w47!.planned.sessions).toBe(1);
    expect(w47!.executed).toMatchObject({
      sessions: 2,
      movedIn: [{ sessionId: 'moved', plannedWeek: '2026-W46' }],
    });
    expect(w47!.executed.volume).toMatchObject({ reps: 57, tonnageKg: 3420 });
    // Semana vacía: visible y con cero.
    expect(w48!.planned.sessions).toBe(0);
    expect(w48!.executed).toMatchObject({
      sessions: 0,
      volume: { sets: { reps: 0, seconds: 0, meters: 0 } },
    });
    expect(p.weeks.map((w) => w.week.key)).toEqual(['2026-W46', '2026-W47', '2026-W48']);
  });

  it('lo previsto y lo ejecutado no se suman entre sí; la adherencia es un recuento', () => {
    expect(p.weeks[0]!.planned.volume).toMatchObject({
      reps: { min: 30, max: 30 },
      tonnageKg: { min: 1800, max: 1800 },
    });
    expect(p.adherence).toMatchObject({ planned: 2, executedOtherDay: 1 });
    expect(p.adherence.byStatus.completed).toBe(2);
    expect(p.sessions.find((s) => s.sessionId === 'moved')!.moved).toBe(true);
  });

  it('el total ejecutado del periodo es la suma de las semanas', () => {
    const sum = addExecutedVolumes(p.weeks.map((w) => w.executed.volume));
    expect([p.executedTotals.reps, p.executedTotals.tonnageKg]).toEqual([sum.reps, sum.tonnageKg]);
  });
});

describe('P-114 · duración del periodo con y sin las sesiones con advertencia', () => {
  it('total y número de sesiones, aparte las que no tienen duración calculada', () => {
    const period = resolvePeriod({ kind: 'week', date: '2026-11-18' }, TODAY).period;
    const ok = session('ok', {
      planned: '2026-11-16',
      startedAt: '2026-11-16T09:00:00.000Z',
      finishedAt: '2026-11-16T09:20:00.000Z',
    });
    // Hueco de 9 h sin pausa: advertencia.
    const gap = session('gap', {
      planned: '2026-11-17',
      startedAt: '2026-11-17T08:00:00.000Z',
      finishedAt: '2026-11-17T17:10:00.000Z',
      setTimes: [
        '2026-11-17T08:02:00.000Z',
        '2026-11-17T08:04:00.000Z',
        '2026-11-17T08:06:00.000Z',
      ],
    });
    const open = session('open', { planned: '2026-11-18', startedAt: '2026-11-18T09:00:00.000Z' });
    const p = analyzePeriod({
      period,
      sessions: [ok, gap, open],
      patternsOf: noPatterns,
      repeat: { n: 3, m: 5 },
    });
    expect(p.duration).toEqual({
      all: { sessions: 2, seconds: 1200 + 33_000 },
      withoutWarned: { sessions: 1, seconds: 1200 },
      warned: 1,
      notices: 0,
      without: { unfinished: 1, incoherent: 0, notCalculable: 0 },
    });
  });
});

describe('P-98 · series por patrón: «solo principal» y «principal y secundarios» (AC-B3-20)', () => {
  it('cada serie cuenta una vez en su principal y en cada uno de sus patrones en el otro recuento', () => {
    const period = resolvePeriod({ kind: 'week', date: '2026-11-18' }, TODAY).period;
    const patterns: Record<string, PatternAssignment[]> = {
      'v-lunge': [
        { id: 'lower.knee', role: 'primary' },
        { id: 'lower.hip', role: 'secondary' },
      ],
      'v-row': [{ id: 'pull.horizontal', role: 'primary' }],
    };
    const p = analyzePeriod({
      period,
      sessions: [
        session('x', {
          planned: '2026-11-16',
          startedAt: '2026-11-16T09:00:00.000Z',
          variant: 'lunge',
        }),
        session('y', {
          planned: '2026-11-17',
          startedAt: '2026-11-17T09:00:00.000Z',
          variant: 'row',
          reps: [10, 10],
        }),
        session('z', {
          planned: '2026-11-18',
          startedAt: '2026-11-18T09:00:00.000Z',
          variant: 'desconocida',
          reps: [10],
        }),
      ],
      patternsOf: (v) => patterns[v] ?? null,
      repeat: { n: 3, m: 5 },
    });
    expect(p.patterns.doneSets).toBe(6);
    expect(p.patterns.primary).toEqual([
      { patternId: 'lower.knee', sets: 3 },
      { patternId: 'pull.horizontal', sets: 2 },
    ]);
    expect(p.patterns.all).toEqual([
      { patternId: 'lower.hip', sets: 3 },
      { patternId: 'lower.knee', sets: 3 },
      { patternId: 'pull.horizontal', sets: 2 },
    ]);
    expect(p.patterns.unknown).toBe(1);
  });
});

describe('P-104 · diferencias repetidas: N de las últimas M sesiones, sin alertas', () => {
  const period = resolvePeriod(
    { kind: 'range', from: '2026-11-02', to: '2026-11-29' },
    TODAY,
  ).period;
  const days = ['03', '05', '10', '12', '17', '19'];
  // Repeticiones: 10 (igual), 9, 9, 10, 9, 10 → fuera en 3 de las últimas 5 (05, 10, 17).
  const reps = [10, 9, 9, 10, 9, 10];
  const sessions = days.map((d, i) =>
    session(`r${d}`, {
      planned: `2026-11-${d}`,
      startedAt: `2026-11-${d}T09:00:00.000Z`,
      reps: [10, 10, reps[i]!],
    }),
  );
  it('con N = 3 y M = 5 aparece; con N = 4, no', () => {
    const p = analyzePeriod({ period, sessions, patternsOf: noPatterns, repeat: { n: 3, m: 5 } });
    expect(p.repeated).toEqual([
      {
        variantId: 'v-a',
        outside: 3,
        considered: 5,
        dimensions: { quantity: 3, load: 0, effort: 0 },
      },
    ]);
    expect(
      analyzePeriod({ period, sessions, patternsOf: noPatterns, repeat: { n: 4, m: 5 } }).repeated,
    ).toEqual([]);
  });
});

describe('filtro por ejercicio y P-123 en el periodo', () => {
  it('el filtro deja solo ese ejercicio; el lastre, aparte del tonelaje', () => {
    const v1 = version(1, [
      item('squat', 1, { sets: 2 }),
      item('pull', 2, { sets: 2, load: { kind: 'bodyweight_plus', addedKg: 5 } }),
      item('assist', 3, { sets: 2, load: { kind: 'assisted', assistanceKg: 20, via: 'machine' } }),
    ]);
    const execution = {
      log: sessionLog(),
      setLogs: [
        setLog('squat', 1, { reps: 10, load: kg(60) }),
        setLog('squat', 2, { reps: 10, load: kg(60) }),
        setLog('pull', 1, { reps: 6, load: { kind: 'bodyweight_plus', addedKg: 5 } }),
        setLog('pull', 2, { reps: 5, load: { kind: 'bodyweight_plus', addedKg: 7.5 } }),
        setLog('assist', 1, { reps: 8, load: { kind: 'assisted', assistanceKg: 20 } }),
        setLog('assist', 2, { reps: 6, load: { kind: 'assisted', assistanceKg: null } }),
      ],
    };
    const all = analyzeSession(input({ versions: [v1], execution }));
    expect(all.executed.tonnageKg).toBe(1200);
    expect(all.executed.addedLoad).toEqual({ kg: 67.5, sets: 2, reps: 11, notByReps: 0 });
    expect(all.prescribed.addedLoadKg).toEqual({ min: 100, max: 100 });
    expect(all.executed.assistance).toMatchObject({ sets: 2, reps: 14, noData: 1 });
    expect(assistanceMeanKg(all.executed.assistance)).toBe(20);
    const onlyPull = analyzeSession(
      input({ versions: [v1], execution, includeVariant: (v) => v === 'v-pull' }),
    );
    expect(onlyPull.exercises.map((e) => e.variantId)).toEqual(['v-pull']);
    expect(onlyPull.executed).toMatchObject({ tonnageKg: null, reps: 11, addedLoad: { kg: 67.5 } });
    expect(onlyPull.profile.structural.sets.total).toBe(2);
  });

  it('la asistencia media del periodo no promedia medias', () => {
    const a = { sets: 1, reps: 10, withKgReps: 10, kgTimesReps: 200, noData: 0 };
    const b = { sets: 1, reps: 2, withKgReps: 2, kgTimesReps: 80, noData: 0 };
    const empty = {
      sets: { reps: 0, seconds: 0, meters: 0 },
      reps: null,
      repsPerSide: null,
      seconds: null,
      meters: null,
      tonnageKg: null,
      tonnageSets: 0,
      tonnageExcluded: {},
      addedLoad: { kg: null, sets: 0, reps: 0, notByReps: 0 },
    };
    const sum = addExecutedVolumes([
      { ...empty, assistance: a },
      { ...empty, assistance: b },
    ]);
    // (200 + 80) / 12 = 23,33 kg; la media de las medias sería 30.
    expect(assistanceMeanKg(sum.assistance)).toBe(23.33);
  });
});

describe('A10 · evolución de un ejercicio por tramos de modalidad', () => {
  it('se corta cuando cambia la modalidad y se ordena por fecha de ejecución', () => {
    const s1 = session('e1', {
      planned: '2026-11-03',
      startedAt: '2026-11-03T09:00:00.000Z',
      variant: 'press',
    });
    const s2 = session('e2', {
      planned: '2026-11-05',
      startedAt: '2026-11-05T09:00:00.000Z',
      variant: 'press',
      kgs: [62.5, 62.5, 62.5],
    });
    const s3 = session('e3', {
      planned: '2026-11-10',
      startedAt: '2026-11-10T09:00:00.000Z',
      variant: 'press',
      load: { kind: 'external', kg: 25, basis: 'per_implement', implements: 2 },
      kgs: [25, 25, 25],
    });
    const other = session('o', {
      planned: '2026-11-04',
      startedAt: '2026-11-04T09:00:00.000Z',
      variant: 'row',
    });
    const e = exerciseEvolution({ variantId: 'v-press', sessions: [s3, other, s2, s1] });
    expect(e.sessions).toBe(3);
    expect(e.segments.map((s) => [s.modality?.key, s.sessions.map((x) => x.sessionId)])).toEqual([
      ['rep|kg', ['e1', 'e2']],
      ['rep|kg-impl-2', ['e3']],
    ]);
    expect(e.segments[0]!.sessions[1]!.sets.map((s) => s.recorded?.kg)).toEqual([62.5, 62.5, 62.5]);
    expect(e.segments[0]!.sessions[1]!.sets[0]!.load).toMatchObject({
      condition: 'differs',
      difference: 2.5,
    });
  });
});
