import { describe, expect, it } from 'vitest';
import { type SetLogV2 } from './execution';
import {
  defaultPerformed,
  describePerformed,
  performedFieldsFor,
  performedSetIssues,
  setDifferences,
} from './performance';
import { describeTarget, reviewExecution } from './review';
import {
  normalizeContent,
  type SessionContent,
  type SessionItem,
  type SetTarget,
} from './session-v2';

const target = (patch: Partial<SetTarget> = {}): SetTarget => ({
  reps: { kind: 'fixed', reps: 10 },
  load: { kind: 'external', kg: 16, basis: 'total' },
  effort: { kind: 'rir', rir: 2 },
  restSeconds: 90,
  ...patch,
});

describe('qué se registra en cada serie', () => {
  it('sentadilla goblet: repeticiones, kg y RIR', () => {
    expect(performedFieldsFor(target())).toMatchObject({
      primary: 'reps',
      loadKind: 'external',
      loadValue: 'kg',
      rir: true,
      rpe: null,
    });
  });

  it('plancha: segundos, sin carga ni RIR', () => {
    const plank = target({
      reps: { kind: 'seconds', seconds: 40 },
      load: { kind: 'bodyweight' },
      effort: { kind: 'none' },
    });
    expect(performedFieldsFor(plank)).toMatchObject({
      primary: 'seconds',
      loadKind: 'bodyweight',
      loadValue: null,
      rir: false,
    });
    expect(defaultPerformed(plank)).toMatchObject({
      durationS: 40,
      reps: null,
      load: { kind: 'bodyweight' },
    });
  });

  it('carrera: metros y, opcionalmente, el tiempo', () => {
    const run = target({
      reps: { kind: 'meters', meters: 400 },
      load: { kind: 'none' },
      effort: { kind: 'none' },
    });
    expect(performedFieldsFor(run)).toMatchObject({ primary: 'meters', optionalDuration: true });
    expect(
      performedSetIssues(run, {
        completed: true,
        distanceM: 400,
        durationS: 95,
        load: { kind: 'none' },
      }),
    ).toEqual([]);
  });

  it('banda elástica: un descriptor, sin inventar kilogramos', () => {
    const band = target({
      load: { kind: 'elastic', descriptor: 'Banda verde' },
      effort: { kind: 'none' },
    });
    expect(performedFieldsFor(band).loadValue).toBe('descriptor');
    expect(defaultPerformed(band).load).toEqual({ kind: 'elastic', descriptor: 'Banda verde' });
    expect(
      performedSetIssues(band, {
        completed: true,
        reps: 10,
        load: { kind: 'elastic', descriptor: 'Banda verde', kg: 5 },
      }).map((i) => i.path),
    ).toEqual(['load.kg']);
  });

  it('%1RM y rangos de kg se registran en kg; el rango se rellena con su mínimo', () => {
    const range = target({
      load: { kind: 'external_range', minKg: 60, maxKg: 70, basis: 'total' },
    });
    expect(performedFieldsFor(range).loadKind).toBe('external');
    expect(defaultPerformed(range).load).toEqual({ kind: 'external', kg: 60 });
    expect(defaultPerformed(target({ reps: { kind: 'range', min: 8, max: 10 } })).reps).toBe(8);
  });

  it('el esfuerzo real no se da por hecho: el formulario lo deja vacío', () => {
    expect(defaultPerformed(target())).toMatchObject({
      reps: 10,
      load: { kind: 'external', kg: 16 },
      rir: null,
    });
  });
});

describe('validación de lo realizado', () => {
  it('acepta una serie hecha con diferencias (menos repeticiones, otro RIR)', () => {
    expect(
      performedSetIssues(target(), {
        completed: true,
        reps: 8,
        load: { kind: 'external', kg: 16 },
        rir: 0,
      }),
    ).toEqual([]);
  });

  it('rechaza valores fuera de rango, junto al campo', () => {
    const paths = performedSetIssues(target(), {
      completed: true,
      reps: 0,
      load: { kind: 'external', kg: 600 },
      rir: 11,
      note: 'x'.repeat(301),
    }).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['reps', 'load.kg', 'rir', 'note']));
  });

  it('la carga va en la modalidad prescrita y el esfuerzo solo si se pidió', () => {
    expect(
      performedSetIssues(target(), { completed: true, reps: 10, load: { kind: 'bodyweight' } }).map(
        (i) => i.path,
      ),
    ).toEqual(['load']);
    expect(
      performedSetIssues(target({ effort: { kind: 'none' } }), {
        completed: true,
        reps: 10,
        load: { kind: 'external', kg: 16 },
        rir: 2,
      }).map((i) => i.path),
    ).toEqual(['rir']);
    expect(
      performedSetIssues(target({ effort: { kind: 'rpe', rpe: 8, scale: 'rir_based' } }), {
        completed: true,
        reps: 10,
        load: { kind: 'external', kg: 16 },
        rpe: 7.3,
      }).map((i) => i.path),
    ).toEqual(['rpe']);
  });

  it('una serie no realizada no lleva datos, solo una observación opcional', () => {
    expect(
      performedSetIssues(target(), { completed: false, note: 'Molestia en la muñeca' }),
    ).toEqual([]);
    expect(performedSetIssues(target(), { completed: false, reps: 10 }).map((i) => i.path)).toEqual(
      ['reps'],
    );
  });
});

describe('prescrito frente a realizado', () => {
  it('describe lo realizado y sus diferencias, sin porcentajes', () => {
    const done = {
      completed: true,
      reps: 8,
      load: { kind: 'external' as const, kg: 18.5 },
      rir: 0,
    };
    expect(describePerformed(done)).toBe('8 × 18,5 kg · RIR 0');
    expect(setDifferences(target(), done)).toEqual(['−2 rep.', '+2,5 kg', 'RIR 0 (previsto 2)']);
    expect(
      setDifferences(target(), {
        completed: true,
        reps: 10,
        load: { kind: 'external', kg: 16 },
        rir: 2,
      }),
    ).toEqual([]);
    expect(describePerformed({ completed: false })).toBe('No realizada');
    expect(describeTarget(target())).toBe('10 × 16 kg · RIR 2');
  });

  it('peso corporal: sin tonelaje ni carga inventada', () => {
    const bw = target({ load: { kind: 'bodyweight' }, effort: { kind: 'none' } });
    expect(describePerformed({ completed: true, reps: 12, load: { kind: 'bodyweight' } })).toBe(
      '12 × Peso corporal',
    );
    expect(setDifferences(bw, { completed: true, reps: 12, load: { kind: 'bodyweight' } })).toEqual(
      ['+2 rep.'],
    );
  });
});

describe('revisión de una ejecución', () => {
  const item = (id: string, order: number, patch: Partial<SessionItem> = {}): SessionItem => ({
    id,
    variantId: `v-${id}`,
    variantName: id === 'a' ? 'Sentadilla goblet' : 'Plancha',
    order,
    block: '',
    blockMode: 'sequential',
    sets: 3,
    defaults: target(),
    perSet: [],
    ...patch,
  });
  const content = (sets = 3): SessionContent =>
    normalizeContent({
      schema: 1,
      plannedDate: '2026-11-12',
      dayOrder: 1,
      title: 'Fuerza',
      focus: 'Fuerza',
      items: [item('a', 1, { sets })],
    });
  const log = (id: string, setNumber: number, patch: Partial<SetLogV2> = {}): SetLogV2 => ({
    clientSetId: id,
    sessionLogId: 'l',
    sessionId: 's',
    clientId: 'c',
    versionNumber: 1,
    prescriptionId: 'a',
    variantId: 'v-a',
    setNumber,
    role: 'working',
    completed: true,
    reps: 10,
    load: { kind: 'external', kg: 16 },
    rir: 2,
    performedAt: `2026-11-12T10:0${setNumber}:00.000Z`,
    deviceRecordedAt: `2026-11-12T10:0${setNumber}:00.000Z`,
    deviceTimeZone: 'Europe/Madrid',
    deviceUtcOffsetMin: 60,
    receivedAt: `2026-11-12T10:0${setNumber}:00.000Z`,
    clockAdjusted: false,
    origin: 'self_reported' as const,
    recordedBy: 'client' as const,
    ...patch,
  });

  it('el ejemplo del bloque: 3 × 10 · 16 kg · RIR 2 frente a 10/RIR 2, 10/RIR 1 y 8/RIR 0', () => {
    const review = reviewExecution({
      status: 'completed',
      currentVersion: 1,
      versions: new Map([[1, content()]]),
      log: {
        startedVersion: 1,
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T10:20:00.000Z',
        finishReason: 'all_done',
        pausedSeconds: 120,
      },
      setLogs: [log('s1', 1), log('s2', 2, { rir: 1 }), log('s3', 3, { reps: 8, rir: 0 })],
      exercise: (_, name) => ({ name: name ?? 'Ejercicio', silhouette: 'squat' }),
    });
    expect(review.items[0]).toMatchObject({
      prescribed: '3 × 10 · 16 kg · RIR 2',
      doneSets: 3,
      plannedSets: 3,
    });
    expect(review.items[0]!.sets.map((s) => [s.performed, s.differences])).toEqual([
      ['10 × 16 kg · RIR 2', []],
      ['10 × 16 kg · RIR 1', ['RIR 1 (previsto 2)']],
      ['8 × 16 kg · RIR 0', ['−2 rep.', 'RIR 0 (previsto 2)']],
    ]);
    expect(review).toMatchObject({
      completedSets: 3,
      pendingSets: 0,
      elapsedSeconds: 1200,
      pausedSeconds: 120,
    });
  });

  it('las correcciones conservan lo anterior; lo pendiente y lo no realizado se distinguen', () => {
    const review = reviewExecution({
      status: 'partial',
      currentVersion: 1,
      versions: new Map([[1, content()]]),
      log: { startedVersion: 1, startedAt: '2026-11-12T10:00:00.000Z', pausedSeconds: 0 },
      setLogs: [
        log('s1', 1),
        log('s1b', 1, { reps: 9, supersedes: 's1' }),
        log('s2', 2, { completed: false, reps: undefined, load: undefined, rir: undefined }),
      ],
      exercise: (_, name) => ({ name: name ?? 'Ejercicio', silhouette: 'squat' }),
    });
    expect(
      review.items[0]!.sets.map((s) => [s.status, s.performed, s.corrected, s.previous]),
    ).toEqual([
      ['done', '9 × 16 kg · RIR 2', true, ['10 × 16 kg · RIR 2']],
      ['not_done', 'No realizada', false, []],
      ['pending', null, false, []],
    ]);
    expect(review).toMatchObject({
      completedSets: 1,
      notDoneSets: 1,
      pendingSets: 1,
      elapsedSeconds: null,
    });
  });

  it('cada serie se compara con la versión con la que se registró', () => {
    const v2 = normalizeContent({
      ...content(2),
      items: [
        item('a', 1, {
          sets: 2,
          defaults: target({ load: { kind: 'external', kg: 14, basis: 'total' } }),
        }),
      ],
    });
    const review = reviewExecution({
      status: 'in_progress',
      currentVersion: 2,
      versions: new Map([
        [1, content(3)],
        [2, v2],
      ]),
      log: { startedVersion: 1, startedAt: '2026-11-12T10:00:00.000Z', pausedSeconds: 0 },
      setLogs: [log('s1', 1), log('s3', 3)],
      exercise: (_, name) => ({ name: name ?? 'Ejercicio', silhouette: 'squat' }),
    });
    expect(review.items[0]!.sets.map((s) => [s.setNumber, s.versionNumber, s.prescribed])).toEqual([
      [1, 1, '10 × 16 kg · RIR 2'],
      [2, 2, '10 × 14 kg · RIR 2'],
    ]);
    // La serie 3 ya no existe en la v2: cuenta y aparece «fuera de la versión vigente».
    expect(review.outsideCurrentVersion).toEqual([
      { prescriptionId: 'a', setNumber: 3, performed: '10 × 16 kg · RIR 2' },
    ]);
    expect(review.versionsUsed).toEqual([1]);
  });
});
