import { describe, expect, it } from 'vitest';
import { findFormula } from '../formulas';
import { startOfLocalDay } from '../time';
import { checkProposal, compareEffort, compareLoad, compareQuantity } from './compare';
import { analyzeDuration } from './duration';
import { sessionReference, startVersionObserved } from './reference';
import { addExecutedVolumes, ANALYSIS_FORMULAS, analyzeSession } from './session';
import { input, item, kg, sessionLog, setLog, version } from './test-fixtures';

/**
 * B3.1 · Dominio del análisis de una sesión (docs/BLOCK3_SPEC.md §3 a §6). Los casos con
 * cifras son los de la especificación: el ejemplo del §5.2, los de P-91 y E2E-12.
 */
const target = (overrides: Partial<ReturnType<typeof item>['defaults']> = {}) => ({
  ...item('x', 1).defaults,
  ...overrides,
});

describe('P-91 · diferencias con tolerancia cero, en dos niveles', () => {
  it('los ejemplos de la especificación, tal cual', () => {
    const range = target({ reps: { kind: 'range', min: 8, max: 10 } });
    expect(compareQuantity(range, { completed: true, reps: 9 })).toMatchObject({
      condition: 'within',
      difference: null,
    });
    expect(compareQuantity(range, { completed: true, reps: 7 })).toMatchObject({
      condition: 'below',
      difference: -1,
    });
    expect(compareQuantity(range, { completed: true, reps: 11 })).toMatchObject({
      condition: 'above',
      difference: 1,
    });
    const forty = target({ load: { kind: 'external', kg: 40, basis: 'total' } });
    expect(compareLoad(forty, { completed: true, load: kg(37) })).toMatchObject({
      condition: 'differs',
      difference: -3,
      differencePercent: -7.5,
    });
    expect(compareLoad(forty, { completed: true, load: kg(40) })).toMatchObject({
      condition: 'matches',
      difference: null,
    });
    const rir2 = target({ effort: { kind: 'rir', rir: 2 } });
    expect(compareEffort(rir2, { completed: true, rir: 2 })).toEqual([
      expect.objectContaining({ measure: 'rir', condition: 'matches', difference: null }),
    ]);
    expect(compareEffort(rir2, { completed: true, rir: 3 })).toEqual([
      expect.objectContaining({ condition: 'differs', difference: 1 }),
    ]);
  });

  it('sin dato, no aplica, no comparable y no evaluable no se confunden con una diferencia', () => {
    // RIR prescrito y no registrado: sin dato.
    expect(
      compareEffort(target({ effort: { kind: 'rir', rir: 2 } }), { completed: true })[0],
    ).toMatchObject({
      condition: 'no_data',
    });
    // RPE en otra escala: no comparable (nunca se convierte).
    expect(
      compareEffort(target({ effort: { kind: 'rpe', rpe: 8, scale: 'omni_res' } }), {
        completed: true,
        rpe: 8,
        rpeScale: 'rir_based',
      })[0],
    ).toMatchObject({ condition: 'not_comparable' });
    // Carácter del esfuerzo: no evaluable.
    expect(
      compareEffort(target({ effort: { kind: 'character', performed: 6, possible: 12 } }), {
        completed: true,
      })[0],
    ).toMatchObject({ condition: 'not_evaluable' });
    // Peso corporal y carga a elegir: no aplica.
    expect(
      compareLoad(target({ load: { kind: 'bodyweight' } }), {
        completed: true,
        load: { kind: 'bodyweight' },
      }).condition,
    ).toBe('not_applicable');
    expect(
      compareLoad(target({ load: { kind: 'self_selected' } }), {
        completed: true,
        load: { kind: 'self_selected', descriptor: null, kg: 18 },
      }).condition,
    ).toBe('not_applicable');
    // %1RM sin kg resueltos: no evaluable.
    expect(
      compareLoad(
        target({
          load: { kind: 'percent_1rm', percent: 70, referenceResultId: 'r', roundingStepKg: 2.5 },
        }),
        { completed: true, load: kg(50) },
      ).condition,
    ).toBe('not_evaluable');
    // Asistencia sin anotar: sin dato. Banda: misma descripción (sin distinguir mayúsculas).
    expect(
      compareLoad(target({ load: { kind: 'assisted', assistanceKg: 20, via: 'machine' } }), {
        completed: true,
        load: { kind: 'assisted', assistanceKg: null },
      }).condition,
    ).toBe('no_data');
    expect(
      compareLoad(target({ load: { kind: 'elastic', descriptor: 'Banda roja' } }), {
        completed: true,
        load: { kind: 'elastic', descriptor: 'banda roja ' },
      }).condition,
    ).toBe('matches');
    // Registrada en otra magnitud (otra versión): no comparable.
    expect(
      compareQuantity(target({ reps: { kind: 'seconds', seconds: 30 } }), {
        completed: true,
        reps: 10,
      }).condition,
    ).toBe('not_comparable');
    // Lastre y asistencia, cada uno en su magnitud.
    expect(
      compareLoad(target({ load: { kind: 'bodyweight_plus', addedKg: 5 } }), {
        completed: true,
        load: { kind: 'bodyweight_plus', addedKg: 7.5 },
      }),
    ).toMatchObject({
      condition: 'differs',
      difference: 2.5,
      label: 'added_kg',
      differencePercent: null,
    });
  });
});

describe('P-120 · igual o distinto de lo propuesto', () => {
  const t = target({
    reps: { kind: 'fixed', reps: 10 },
    load: { kind: 'external', kg: 16, basis: 'total' },
    effort: { kind: 'rir', rir: 2 },
  });
  it('sin tocar y con solo el RIR añadido: «igual» (no demuestra que se revisara); editado: «distinto»', () => {
    expect(checkProposal(t, { completed: true, reps: 10, load: kg(16) }).overall).toBe('equal');
    expect(checkProposal(t, { completed: true, reps: 10, load: kg(16), rir: 2 }).overall).toBe(
      'equal',
    );
    expect(checkProposal(t, { completed: true, reps: 8, load: kg(16), rir: 0 })).toEqual({
      amount: 'different',
      load: 'equal',
      overall: 'different',
    });
    expect(checkProposal(t, { completed: true, reps: 10, load: kg(18) }).load).toBe('different');
  });
  it('un rango se propone con su mínimo; una carga a elegir no propone nada', () => {
    const range = target({ reps: { kind: 'range', min: 8, max: 10 } });
    expect(checkProposal(range, { completed: true, reps: 8, load: kg(60) }).overall).toBe('equal');
    expect(checkProposal(range, { completed: true, reps: 9, load: kg(60) }).overall).toBe(
      'different',
    );
    const free = target({ load: { kind: 'self_selected' } });
    expect(
      checkProposal(free, {
        completed: true,
        reps: 10,
        load: { kind: 'self_selected', descriptor: null, kg: 18 },
      }).load,
    ).toBe('different');
    expect(
      checkProposal(free, {
        completed: true,
        reps: 10,
        load: { kind: 'self_selected', descriptor: null },
      }).load,
    ).toBe('absent');
  });
});

describe('P-92, P-117 y P-121 · referencia histórica', () => {
  const v1 = version(1, [item('a', 1)], { publishedAt: '2026-11-08T18:00:00.000Z' });
  const v2 = version(2, [item('a', 1, { load: { kind: 'external', kg: 62.5, basis: 'total' } })], {
    publishedAt: '2026-11-09T09:20:00.000Z',
  });
  const base = {
    versions: [v1, v2],
    currentVersion: 2,
    timeZone: 'Europe/Madrid',
    now: '2026-11-14T12:00:00.000Z',
    startObserved: true,
  };

  it('vigente: siempre la actual; empezada: la del último registro o la de inicio observada', () => {
    expect(sessionReference({ ...base, perspective: 'current', execution: null })).toEqual({
      kind: 'determined',
      version: 2,
      basis: 'current',
    });
    const log = sessionLog();
    expect(
      sessionReference({
        ...base,
        perspective: 'original',
        execution: { log, setLogs: [setLog('a', 1, { reps: 10, load: kg(60) })] },
      }),
    ).toEqual({ kind: 'determined', version: 1, basis: 'last_record' });
    expect(
      sessionReference({ ...base, perspective: 'original', execution: { log, setLogs: [] } }),
    ).toEqual({
      kind: 'determined',
      version: 1,
      basis: 'start_version',
    });
    expect(
      sessionReference({
        ...base,
        startObserved: false,
        perspective: 'original',
        execution: { log, setLogs: [] },
      }),
    ).toEqual({ kind: 'undetermined', reason: 'start_version_deduced' });
  });

  it('el último registro, si no es el mismo por hora del móvil y por hora de llegada: no determinada', () => {
    const a = setLog(
      'a',
      1,
      { reps: 10, load: kg(60) },
      {
        versionNumber: 1,
        performedAt: '2026-11-09T09:30:00.000Z',
        receivedAt: '2026-11-09T09:40:00.000Z',
      },
    );
    const b = setLog(
      'a',
      2,
      { reps: 10, load: kg(62.5) },
      {
        versionNumber: 2,
        performedAt: '2026-11-09T09:35:00.000Z',
        receivedAt: '2026-11-09T09:36:00.000Z',
      },
    );
    expect(
      sessionReference({
        ...base,
        perspective: 'original',
        execution: { log: sessionLog(), setLogs: [a, b] },
      }),
    ).toEqual({ kind: 'undetermined', reason: 'record_order_ambiguous' });
  });

  it('sin empezar: la vigente al terminar el día previsto, solo si es inequívoca', () => {
    const later = version(2, [item('a', 1)], { publishedAt: '2026-11-10T08:00:00.000Z' });
    // Fin del 9 de noviembre en Madrid: 2026-11-09T23:00:00Z.
    expect(startOfLocalDay('2026-11-10', 'Europe/Madrid')).toBe('2026-11-09T23:00:00.000Z');
    expect(
      sessionReference({
        ...base,
        versions: [v1, later],
        perspective: 'original',
        execution: null,
      }),
    ).toEqual({ kind: 'determined', version: 1, basis: 'end_of_planned_day' });
    expect(
      sessionReference({ ...base, versions: [v1, v2], perspective: 'original', execution: null }),
    ).toEqual({ kind: 'determined', version: 2, basis: 'end_of_planned_day' });
    // Fechas previstas distintas entre versiones: no determinada (P-121).
    const moved = version(2, [item('a', 1)], {
      plannedDate: '2026-11-11',
      publishedAt: '2026-11-08T20:00:00.000Z',
    });
    expect(
      sessionReference({
        ...base,
        versions: [v1, moved],
        perspective: 'original',
        execution: null,
      }),
    ).toEqual({
      kind: 'undetermined',
      reason: 'planned_dates_differ',
    });
    // Publicada por primera vez después de su día: no había versión al terminarlo.
    const late = version(1, [item('a', 1)], { publishedAt: '2026-11-12T08:00:00.000Z' });
    expect(
      sessionReference({
        ...base,
        versions: [late],
        currentVersion: 1,
        perspective: 'original',
        execution: null,
      }),
    ).toEqual({
      kind: 'undetermined',
      reason: 'no_version_at_end_of_day',
    });
    // El día aún no ha terminado.
    expect(
      sessionReference({
        ...base,
        now: '2026-11-09T22:59:00.000Z',
        perspective: 'original',
        execution: null,
      }),
    ).toEqual({ kind: 'undetermined', reason: 'planned_day_not_over' });
  });

  it('versión de inicio observada o deducida (ejecuciones anteriores a la migración 002)', () => {
    const applied = '2026-11-12T10:00:00.000Z';
    // Base sembrada con la 002 ya aplicada: todas observadas.
    expect(
      startVersionObserved({
        startReceivedAt: '2026-11-01T09:00:00.000Z',
        migration002AppliedAt: applied,
        seededAt: '2026-11-12T10:00:01.000Z',
      }),
    ).toBe(true);
    // Base anterior a la 002: deducida lo que llegó antes de aplicarla.
    expect(
      startVersionObserved({
        startReceivedAt: '2026-11-01T09:00:00.000Z',
        migration002AppliedAt: applied,
        seededAt: '2026-10-01T09:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      startVersionObserved({
        startReceivedAt: '2026-11-13T09:00:00.000Z',
        migration002AppliedAt: applied,
        seededAt: '2026-10-01T09:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      startVersionObserved({
        startReceivedAt: '2026-11-13T09:00:00.000Z',
        migration002AppliedAt: null,
        seededAt: null,
      }),
    ).toBe(false);
  });
});

describe('§5.2 · el ejemplo de la especificación, exacto', () => {
  // Sentadilla trasera 3 × 10 × 60 kg, RIR 2; plancha 3 × 30 s. Realizado: 10/RIR 2, 10/RIR 1,
  // 9/RIR 0; plancha 30 s, 30 s y no realizada; terminada como parcial.
  const v1 = version(1, [
    item('squat', 1, { effort: { kind: 'rir', rir: 2 }, name: 'Sentadilla trasera' }),
    item('plank', 2, {
      reps: { kind: 'seconds', seconds: 30 },
      load: { kind: 'bodyweight' },
      name: 'Plancha',
    }),
  ]);
  const setLogs = [
    setLog('squat', 1, { reps: 10, load: kg(60), rir: 2 }),
    setLog('squat', 2, { reps: 10, load: kg(60), rir: 1 }),
    setLog('squat', 3, { reps: 9, load: kg(60), rir: 0 }),
    setLog('plank', 1, { durationS: 30, load: { kind: 'bodyweight' } }),
    setLog('plank', 2, { durationS: 30, load: { kind: 'bodyweight' } }),
    setLog('plank', 3, { completed: false }),
  ];
  const log = sessionLog({
    finishedAt: '2026-11-09T09:49:00.000Z',
    finishReason: 'ended_early',
    pausedSeconds: 300,
  });
  const analysis = analyzeSession(input({ versions: [v1], execution: { log, setLogs } }));

  it('estructural, cuantitativa, intensidad y esfuerzo con sus denominadores; sin índice global', () => {
    const p = analysis.profile;
    expect(p.structural.sets).toEqual({ done: 5, notDone: 1, unregistered: 0, total: 6 });
    expect(p.structural.exercises).toMatchObject({ complete: 1, partial: 1, total: 2 });
    expect(p.quantitative.reps).toMatchObject({ matches: 2, differs: 1 });
    expect(p.quantitative.seconds).toMatchObject({ matches: 2 });
    expect(p.intensity).toMatchObject({ matches: 3, not_applicable: 2 });
    expect(p.effort.rir).toMatchObject({ matches: 1, differs: 2, no_data: 0 });
    expect(analysis.exercises[0]!.sets[2]!.quantity).toMatchObject({
      condition: 'differs',
      difference: -1,
    });
    expect(analysis.exercises[0]!.sets[2]!.effort[0]).toMatchObject({ difference: -2 });
    expect(Object.keys(analysis)).not.toContain('score');
  });

  it('volumen por magnitud: 29 de 30 rep., 60 de 90 s y 1.800 → 1.740 kg', () => {
    expect(analysis.prescribed).toMatchObject({
      reps: { min: 30, max: 30 },
      seconds: 90,
      tonnageKg: { min: 1800, max: 1800 },
      sets: { reps: 3, seconds: 3, meters: 0 },
    });
    expect(analysis.executed).toMatchObject({
      reps: 29,
      seconds: 60,
      meters: null,
      tonnageKg: 1740,
      tonnageSets: 3,
    });
    // Cierre parcial: no es «completada».
    expect(analysis.status).toBe('partial');
    expect(analysis.finishReason).toBe('ended_early');
    expect(analysis.duration.state).toMatchObject({
      kind: 'calculated',
      elapsedSeconds: 2940,
      calculatedSeconds: 2640,
    });
  });
});

describe('volumen: modalidades que no se mezclan (AC-B3-05 y AC-B3-06)', () => {
  it('por implemento 2 × 20 kg: 3 × 10 → 1.200 kg; por lado y autoseleccionada, sin calcular con su motivo', () => {
    const v1 = version(1, [
      item('db', 1, { load: { kind: 'external', kg: 20, basis: 'per_implement', implements: 2 } }),
      item('bar', 2, { load: { kind: 'external', kg: 20, basis: 'per_side' } }),
      item('free', 3, { load: { kind: 'self_selected' }, sets: 1 }),
      item('pull', 4, { load: { kind: 'bodyweight_plus', addedKg: 5 }, sets: 1 }),
      item('walk', 5, {
        reps: { kind: 'meters', meters: 20 },
        load: { kind: 'external', kg: 24, basis: 'per_implement', implements: 2 },
        sets: 1,
      }),
    ]);
    const setLogs = [
      ...[1, 2, 3].map((n) => setLog('db', n, { reps: 10, load: kg(20) })),
      ...[1, 2, 3].map((n) => setLog('bar', n, { reps: 10, load: kg(20) })),
      setLog('free', 1, { reps: 10, load: { kind: 'self_selected', descriptor: null, kg: 18 } }),
      setLog('pull', 1, { reps: 10, load: { kind: 'bodyweight_plus', addedKg: 5 } }),
      setLog('walk', 1, { distanceM: 20, load: kg(24) }),
    ];
    const a = analyzeSession(input({ versions: [v1], execution: { log: sessionLog(), setLogs } }));
    expect(a.executed.tonnageKg).toBe(1200);
    expect(a.executed.tonnageSets).toBe(3);
    expect(a.executed.tonnageExcluded).toEqual({
      per_side_basis: 3,
      self_selected: 1,
      not_by_reps: 1,
    });
    // El lastre no entra en el tonelaje ni en ninguna otra cifra de kg.
    expect(a.executed.reps).toBe(80);
    expect(a.executed.meters).toBe(20);
    expect(a.prescribed.tonnageKg).toEqual({ min: 1200, max: 1200 });
  });

  it('repeticiones «por lado», aparte y sin tonelaje (P-96)', () => {
    const v1 = version(1, [
      item('lunge', 1, {
        reps: { kind: 'fixed', reps: 8, perSide: true },
        load: { kind: 'external', kg: 10, basis: 'total' },
        sets: 2,
      }),
    ]);
    const setLogs = [1, 2].map((n) => setLog('lunge', n, { reps: 8, load: kg(10) }));
    const a = analyzeSession(input({ versions: [v1], execution: { log: sessionLog(), setLogs } }));
    expect(a.executed).toMatchObject({
      reps: null,
      repsPerSide: 16,
      tonnageKg: null,
      tonnageExcluded: { reps_per_side: 2 },
    });
    expect(a.prescribed).toMatchObject({
      reps: null,
      repsPerSide: { min: 16, max: 16 },
      tonnageKg: null,
    });
    expect(a.exercises[0]!.sets[0]!.perSide).toBe(true);
  });

  it('los datos ausentes no se convierten en cero: sin series de un tipo, `null`', () => {
    const v1 = version(1, [
      item('plank', 1, { reps: { kind: 'seconds', seconds: 30 }, load: { kind: 'bodyweight' } }),
    ]);
    const a = analyzeSession(input({ versions: [v1] }));
    expect(a.executed).toMatchObject({ reps: null, meters: null, tonnageKg: null, seconds: 0 });
    expect(a.prescribed).toMatchObject({ reps: null, tonnageKg: null, seconds: 90 });
  });
});

describe('E2E-12 · dos sesiones el mismo día: cada una por separado y el día como suma', () => {
  it('mañana 15 rep. y 1.200 kg; tarde 16 rep. y 640 kg; día 31 rep. y 1.840 kg', () => {
    const morning = analyzeSession(
      input({
        versions: [
          version(1, [
            item('squat', 1, {
              reps: { kind: 'fixed', reps: 5 },
              load: { kind: 'external', kg: 80, basis: 'total' },
            }),
          ]),
        ],
        execution: {
          log: sessionLog(),
          setLogs: [1, 2, 3].map((n) => setLog('squat', n, { reps: 5, load: kg(80) })),
        },
      }),
    );
    const evening = analyzeSession(
      input({
        versions: [
          version(1, [
            item('bench', 1, {
              sets: 2,
              reps: { kind: 'fixed', reps: 8 },
              load: { kind: 'external', kg: 40, basis: 'total' },
            }),
          ]),
        ],
        execution: {
          log: sessionLog(),
          setLogs: [1, 2].map((n) => setLog('bench', n, { reps: 8, load: kg(40) })),
        },
      }),
    );
    expect([morning.executed.reps, morning.executed.tonnageKg]).toEqual([15, 1200]);
    expect([evening.executed.reps, evening.executed.tonnageKg]).toEqual([16, 640]);
    const day = addExecutedVolumes([morning.executed, evening.executed]);
    expect([day.reps, day.tonnageKg, day.sets.reps]).toEqual([31, 1840, 5]);
    // Nunca se promedian porcentajes ni se suman magnitudes distintas.
    expect(day.seconds).toBeNull();
  });
});

describe('versiones a media sesión (AC-B3-07)', () => {
  const v1 = version(1, [item('a', 1, { load: { kind: 'external', kg: 40, basis: 'total' } })], {
    publishedAt: '2026-11-08T18:00:00.000Z',
  });
  const v2 = version(2, [item('a', 1, { load: { kind: 'external', kg: 42.5, basis: 'total' } })], {
    publishedAt: '2026-11-09T09:15:00.000Z',
  });
  const setLogs = [
    setLog('a', 1, { reps: 10, load: kg(40) }, { versionNumber: 1 }),
    setLog('a', 2, { reps: 10, load: kg(42.5) }, { versionNumber: 2 }),
  ];
  const execution = { log: sessionLog(), setLogs };

  it('original: cada serie frente a su versión; vigente: todas frente a la v2', () => {
    const original = analyzeSession(input({ versions: [v1, v2], execution }));
    expect(original.exercises[0]!.sets.map((s) => [s.referenceVersion, s.load?.condition])).toEqual(
      [
        [1, 'matches'],
        [2, 'matches'],
        // La 3, sin registrar, con la versión del último registro (P-117).
        [2, undefined],
      ],
    );
    const current = analyzeSession(
      input({ versions: [v1, v2], execution, perspective: 'current' }),
    );
    expect(current.exercises[0]!.sets.map((s) => [s.referenceVersion, s.load?.condition])).toEqual([
      [2, 'differs'],
      [2, 'matches'],
      [2, undefined],
    ]);
  });

  it('publicar después una v3 no cambia la vista original', () => {
    const v3 = version(
      3,
      [item('a', 1, { load: { kind: 'external', kg: 50, basis: 'total' } }), item('b', 2)],
      {
        publishedAt: '2026-11-10T08:00:00.000Z',
      },
    );
    const before = analyzeSession(input({ versions: [v1, v2], execution }));
    const after = analyzeSession(input({ versions: [v1, v2, v3], execution }));
    expect(after.exercises).toEqual(before.exercises);
    expect(after.profile).toEqual(before.profile);
    expect(after.prescribed).toEqual(before.prescribed);
    expect(after.currentVersion).toBe(3);
  });

  it('una serie registrada que ya no está en la vigente se lista aparte y no se compara', () => {
    const v3 = version(3, [item('a', 1, { sets: 1 })], { publishedAt: '2026-11-10T08:00:00.000Z' });
    const current = analyzeSession(
      input({ versions: [v1, v2, v3], execution, perspective: 'current' }),
    );
    expect(current.outsideReferenceSets).toBe(1);
    expect(current.profile.structural.sets.total).toBe(1);
    // Lo ejecutado es lo mismo en las dos perspectivas.
    expect(current.executed).toEqual(
      analyzeSession(input({ versions: [v1, v2, v3], execution })).executed,
    );
  });

  it('con la referencia no determinada, lo no registrado no se enumera ni entra en lo prescrito', () => {
    const a = analyzeSession(
      input({
        versions: [v1, v2],
        execution: { log: sessionLog(), setLogs: [] },
        startObserved: false,
      }),
    );
    expect(a.reference).toEqual({ kind: 'undetermined', reason: 'start_version_deduced' });
    expect(a.exercises).toEqual([]);
    expect(a.prescribed.unregisteredUnknown).toBe(true);
    expect(a.prescribed.reps).toBeNull();
  });
});

describe('invariantes', () => {
  const v1 = version(1, [item('a', 1)]);
  const first = setLog('a', 1, { reps: 10, load: kg(60) }, { clientSetId: 'orig-1' });
  const correction = setLog(
    'a',
    1,
    { reps: 9, load: kg(60) },
    { clientSetId: 'fix-1', supersedes: 'orig-1', performedAt: '2026-11-09T09:20:00.000Z' },
  );

  it('una corrección cuenta una vez: solo cambia el valor corregido (AC-B3-13)', () => {
    const plain = analyzeSession(
      input({ versions: [v1], execution: { log: sessionLog(), setLogs: [first] } }),
    );
    const fixed = analyzeSession(
      input({ versions: [v1], execution: { log: sessionLog(), setLogs: [first, correction] } }),
    );
    expect(plain.executed.reps).toBe(10);
    expect(fixed.executed.reps).toBe(9);
    expect(fixed.profile.structural.sets.done).toBe(1);
    expect(fixed.exercises[0]!.sets[0]).toMatchObject({
      corrected: true,
      previous: ['10 × 60 kg'],
    });
  });

  it('es determinista: la misma entrada da el mismo resultado', () => {
    const make = () =>
      analyzeSession(
        input({ versions: [v1], execution: { log: sessionLog(), setLogs: [first, correction] } }),
      );
    expect(make()).toEqual(make());
  });

  it('cada cifra lleva una fórmula registrada, definición de diseño con limitaciones', () => {
    for (const ref of Object.values(ANALYSIS_FORMULAS)) {
      const formula = findFormula(ref);
      expect(formula, `${ref.id}@${ref.version}`).toBeDefined();
      expect(formula!.kind).toBe('operational_definition');
      expect(formula!.limitations.length).toBeGreaterThan(0);
    }
  });

  it('rendimiento: 30 ejercicios × 10 series (300 registros), por debajo de 50 ms', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      item(`e${i}`, i + 1, { sets: 10, effort: { kind: 'rir', rir: 2 } }),
    );
    const logs = items.flatMap((it) =>
      Array.from({ length: 10 }, (_, n) =>
        setLog(it.id, n + 1, { reps: 10, load: kg(60), rir: 2 }),
      ),
    );
    const run = () =>
      analyzeSession(
        input({ versions: [version(1, items)], execution: { log: sessionLog(), setLogs: logs } }),
      );
    run(); // calentamiento (compilación JIT)
    // Mediana de 5 ejecuciones: mide el código, no el ruido de las pruebas en paralelo.
    const times = Array.from({ length: 5 }, () => {
      const t0 = performance.now();
      run();
      return performance.now() - t0;
    }).sort((x, y) => x - y);
    const a = run();
    expect(a.profile.structural.sets.done).toBe(300);
    expect(times[2]).toBeLessThan(50);
  });
});

describe('P-95, P-116 y P-122 · duración y huecos', () => {
  it('AC-B3-10: inicio 21:00, serie 21:10, fin 06:15 sin pausas → cifras y advertencia, sin descontar nada', () => {
    const log = sessionLog({
      startedAt: '2026-11-20T20:00:00.000Z',
      finishedAt: '2026-11-21T05:15:00.000Z',
    });
    const d = analyzeDuration({
      log,
      setLogs: [setLog('a', 1, { reps: 10 }, { performedAt: '2026-11-20T20:10:00.000Z' })],
      estimatedMinutes: 40,
    });
    expect(d.state).toMatchObject({
      kind: 'calculated',
      elapsedSeconds: 33_300,
      calculatedSeconds: 33_300,
    });
    expect(d.gaps).toEqual([
      expect.objectContaining({
        seconds: 32_700,
        level: 'warning',
        fromActivity: 'set',
        toActivity: 'finish',
      }),
    ]);
    expect(d.estimatedMinutes).toBe(40);
  });

  it('las pausas registradas podrían explicar el hueco: «aviso»; exactamente 30 min no es hueco', () => {
    const log = sessionLog({
      startedAt: '2026-11-21T10:00:00.000Z',
      finishedAt: '2026-11-21T10:55:00.000Z',
      pausedSeconds: 2400,
    });
    const sets = [
      setLog('a', 1, { reps: 10 }, { performedAt: '2026-11-21T10:05:00.000Z' }),
      setLog('a', 2, { reps: 10 }, { performedAt: '2026-11-21T10:50:00.000Z' }),
    ];
    expect(analyzeDuration({ log, setLogs: sets, estimatedMinutes: null }).gaps).toEqual([
      expect.objectContaining({ seconds: 2700, level: 'notice' }),
    ]);
    const exact = sessionLog({
      startedAt: '2026-11-21T10:00:00.000Z',
      finishedAt: '2026-11-21T10:30:00.000Z',
    });
    expect(analyzeDuration({ log: exact, setLogs: [], estimatedMinutes: null }).gaps).toEqual([]);
  });

  it('con una hora ajustada, ese hueco no se evalúa y la duración no se calcula', () => {
    const log = sessionLog({
      startedAt: '2026-11-20T20:00:00.000Z',
      finishedAt: '2026-11-21T05:15:00.000Z',
      finishClockAdjustment: 'ahead_of_server',
    });
    const d = analyzeDuration({
      log,
      setLogs: [setLog('a', 1, { reps: 10 }, { performedAt: '2026-11-20T20:10:00.000Z' })],
      estimatedMinutes: null,
    });
    expect(d.state.kind).toBe('not_calculable');
    expect(d.gaps.map((g) => g.level)).toEqual(['not_evaluable']);
    expect(d.anyAdjusted).toBe(true);
  });

  it('AC-B3-11: fin anterior al inicio o pausas mayores que lo transcurrido → incoherente, sin cifras', () => {
    const before = sessionLog({
      startedAt: '2026-11-21T10:00:00.000Z',
      finishedAt: '2026-11-21T09:57:00.000Z',
    });
    expect(analyzeDuration({ log: before, setLogs: [], estimatedMinutes: null })).toMatchObject({
      state: { kind: 'incoherent', reason: 'finish_before_start' },
      gaps: [],
    });
    const pauses = sessionLog({
      startedAt: '2026-11-21T10:00:00.000Z',
      finishedAt: '2026-11-21T10:10:00.000Z',
      pausedSeconds: 900,
    });
    expect(
      analyzeDuration({ log: pauses, setLogs: [], estimatedMinutes: null }).state,
    ).toMatchObject({
      kind: 'incoherent',
      reason: 'pauses_exceed_elapsed',
    });
  });

  it('sin terminar: sin duración, con el inicio y la última actividad', () => {
    const d = analyzeDuration({
      log: sessionLog({ lastActivityAt: '2026-11-09T09:30:00.000Z' }),
      setLogs: [],
      estimatedMinutes: null,
    });
    expect(d.state).toEqual({
      kind: 'unfinished',
      startedAt: '2026-11-09T09:00:00.000Z',
      lastActivityAt: '2026-11-09T09:30:00.000Z',
      paused: false,
    });
  });
});

describe('fechas: ejecución por la fecha local del inicio en la zona del móvil', () => {
  const v1 = version(1, [item('a', 1, { sets: 2 })], { plannedDate: '2027-01-01' });
  it('medianoche: inicio 23:50 y serie a las 00:03 → todo en el día de inicio; semana ISO 2026-W53', () => {
    const log = sessionLog({ startedAt: '2026-12-31T22:50:00.000Z' });
    const setLogs = [
      setLog('a', 1, { reps: 10, load: kg(60) }, { performedAt: '2026-12-31T22:58:00.000Z' }),
      setLog('a', 2, { reps: 10, load: kg(60) }, { performedAt: '2026-12-31T23:03:00.000Z' }),
    ];
    const a = analyzeSession(input({ versions: [v1], execution: { log, setLogs } }));
    expect(a.executedOn).toBe('2026-12-31');
    expect(a.daysFromPlanned).toBe(-1);
    expect(a.executedWeek).toEqual({ key: '2026-W53', start: '2026-12-28', end: '2027-01-03' });
    expect(a.executed.reps).toBe(20);
  });
  it('el mismo instante en Nueva York es otro día', () => {
    const log = sessionLog({
      startedAt: '2027-01-01T03:30:00.000Z',
      startTimeZone: 'America/New_York',
    });
    const a = analyzeSession(input({ versions: [v1], execution: { log, setLogs: [] } }));
    expect(a.executedOn).toBe('2026-12-31');
  });
  it('una hora de inicio ajustada se dice; la fecha no se corrige en silencio', () => {
    const log = sessionLog({ startClockAdjustment: 'before_lower_bound' });
    const a = analyzeSession(input({ versions: [v1], execution: { log, setLogs: [] } }));
    expect(a.executedOnFromAdjustedTime).toBe(true);
  });
});
