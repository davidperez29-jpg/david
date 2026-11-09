import { describe, expect, it } from 'vitest';
import { utcOffsetMinutes } from '../time';
import {
  effortToLegacy,
  itemFromLegacy,
  itemToLegacy,
  loadFromLegacy,
  loadToLegacy,
  toLegacyLog,
  toLegacySession,
} from './compat';
import { describeEffort, effortIssues } from './effort';
import {
  effectiveSetLogs,
  executionDate,
  executionInstant,
  executionStatus,
  type SessionLogV2,
  type SetLogV2,
} from './execution';
import { describeLoad, loadIssues, prescribedExternalKg } from './load';
import { type ExercisePrescription } from './prescription';
import {
  blockLetter,
  changeSummary,
  contentIssues,
  lockIssues,
  normalizeContent,
  publishIssues,
  publishWarnings,
  resolveSets,
  sameContent,
  type SessionContent,
  type SessionItem,
} from './session-v2';

const TODAY = '2026-11-09';
const usable = { isUsableVariant: (id: string) => id.startsWith('ex-') };

const squat = (overrides: Partial<SessionItem> = {}): SessionItem => ({
  id: 'itm-1',
  variantId: 'ex-back-squat',
  variantName: 'Sentadilla trasera con barra',
  order: 1,
  block: 'A',
  blockMode: 'sequential',
  sets: 3,
  defaults: {
    reps: { kind: 'fixed', reps: 10 },
    load: { kind: 'external', kg: 60, basis: 'total' },
    effort: { kind: 'rir', rir: 2 },
    restSeconds: 120,
  },
  perSet: [],
  ...overrides,
});

const content = (
  items: SessionItem[] = [squat()],
  extra: Partial<SessionContent> = {},
): SessionContent => ({
  schema: 1,
  plannedDate: TODAY,
  dayOrder: 1,
  label: 'Mañana',
  title: 'Fuerza · pierna',
  focus: 'Sentadilla',
  estimatedMinutes: 40,
  items,
  ...extra,
});

describe('prescripción por serie', () => {
  it('aplica las excepciones de cada serie sobre los valores comunes', () => {
    const sets = resolveSets(
      squat({
        sets: 4,
        perSet: [
          {
            setNumber: 4,
            load: { kind: 'external', kg: 85, basis: 'total' },
            effort: { kind: 'rir', rir: 1 },
          },
        ],
      }),
    );
    expect(sets).toHaveLength(4);
    expect(sets[0]).toMatchObject({ setNumber: 1, load: { kg: 60 }, effort: { rir: 2 } });
    expect(sets[3]).toMatchObject({
      setNumber: 4,
      load: { kg: 85 },
      effort: { rir: 1 },
      restSeconds: 120,
    });
  });

  it('normaliza orden, bloques, textos y excepciones de series que ya no existen', () => {
    const normalized = normalizeContent(
      content(
        [
          squat({
            id: 'b',
            order: 5,
            block: 'Q',
            clientNote: '  ',
            perSet: [{ setNumber: 9, restSeconds: 60 }],
          }),
          squat({ id: 'a', order: 2, block: 'K', title: undefined } as Partial<SessionItem>),
          squat({ id: 'c', order: 7, block: 'Q' }),
        ],
        { title: '  Fuerza  ' },
      ),
    );
    // Orden 1…n y bloques renombrados por orden de aparición, conservando los pares (B1, B2).
    expect(normalized.items.map((i) => [i.id, i.order, i.block])).toEqual([
      ['a', 1, 'A'],
      ['b', 2, 'B'],
      ['c', 3, 'B'],
    ]);
    expect(normalized.items[1]!.perSet).toEqual([]);
    expect(normalized.items[1]!.clientNote).toBeUndefined();
    expect(normalized.title).toBe('Fuerza');
    expect([blockLetter(26), blockLetter(27)]).toEqual(['Z', 'AA']);
  });

  it('compara contenidos sin depender del orden de las claves', () => {
    const a = content();
    const b = JSON.parse(JSON.stringify(a)) as SessionContent;
    expect(
      sameContent(a, { ...b, items: [{ ...b.items[0]!, defaults: { ...b.items[0]!.defaults } }] }),
    ).toBe(true);
    expect(sameContent(a, content([squat({ sets: 4 })]))).toBe(false);
  });
});

describe('validaciones al guardar y al publicar', () => {
  it('acepta una prescripción común válida', () => {
    expect(contentIssues(content(), usable)).toEqual([]);
    expect(publishIssues(content(), usable)).toEqual([]);
  });

  it('rechaza valores imposibles al guardar', () => {
    const bad = content([
      squat({
        sets: 0,
        defaults: {
          reps: { kind: 'range', min: 8, max: 6 },
          load: { kind: 'external', kg: 900, basis: 'total' },
          effort: { kind: 'rpe', rpe: 7.3, scale: 'rir_based' },
          restSeconds: 4000,
        },
      }),
      squat({ id: 'itm-1', variantId: 'otra-cosa' }),
    ]);
    const paths = contentIssues(bad, usable).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'items.0.sets',
        'items.0.defaults.reps',
        'items.0.defaults.load.kg',
        'items.0.defaults.effort.rpe',
        'items.0.defaults.restSeconds',
        'items.1.id',
        'items.1.variantId',
      ]),
    );
  });

  it('los ejercicios de un mismo bloque deben ir seguidos (A1, A2; no A, B, A)', () => {
    const together = content([
      squat({ id: 'x', order: 1, block: 'A' }),
      squat({ id: 'y', order: 2, block: 'A' }),
      squat({ id: 'z', order: 3, block: 'B' }),
    ]);
    expect(contentIssues(together, usable)).toEqual([]);
    const split = content([
      squat({ id: 'x', order: 1, block: 'A' }),
      squat({ id: 'y', order: 2, block: 'B' }),
      squat({ id: 'z', order: 3, block: 'A' }),
    ]);
    expect(contentIssues(split, usable).map((i) => i.path)).toEqual(['items.2.block']);
  });

  it('un borrador incompleto se guarda, pero no se publica', () => {
    const draft = content([], { focus: '', estimatedMinutes: undefined });
    expect(contentIssues(draft, usable)).toEqual([]);
    expect(publishIssues(draft, usable).map((i) => i.path)).toEqual([
      'focus',
      'estimatedMinutes',
      'items',
    ]);
  });

  it('no permite RIR en series por tiempo ni RIR y RPE con la escala basada en RIR', () => {
    expect(
      effortIssues({ kind: 'rir', rir: 2 }, { kind: 'seconds', seconds: 30 }, 'e'),
    ).toHaveLength(1);
    const redundant = effortIssues(
      {
        kind: 'rir_and_rpe',
        rir: 2,
        rpe: 8,
        scale: 'rir_based' as never,
        justification: 'x'.repeat(10),
      },
      { kind: 'fixed', reps: 5 },
      'e',
    );
    expect(redundant.map((i) => i.path)).toContain('e.scale');
  });

  it('el %1RM sin referencia resuelta no se publica', () => {
    const percent = content([
      squat({
        defaults: {
          ...squat().defaults,
          load: { kind: 'percent_1rm', percent: 75, referenceResultId: 'a-1', roundingStepKg: 2.5 },
        },
      }),
    ]);
    expect(contentIssues(percent, usable)).toEqual([]);
    expect(publishIssues(percent, usable).some((i) => i.message.includes('1RM'))).toBe(true);
  });

  it('avisa (sin bloquear) de RIR alto, RIR con series largas y fechas pasadas', () => {
    const warnings = publishWarnings(
      content(
        [
          squat({
            defaults: {
              ...squat().defaults,
              reps: { kind: 'fixed', reps: 15 },
              effort: { kind: 'rir', rir: 5 },
            },
          }),
        ],
        { plannedDate: '2026-11-01' },
      ),
      TODAY,
    ).map((w) => w.message);
    expect(warnings.some((m) => m.includes('5 o más'))).toBe(true);
    expect(warnings.some((m) => m.includes('12 repeticiones'))).toBe(true);
    expect(warnings.some((m) => m.includes('ya ha pasado'))).toBe(true);
  });
});

describe('modalidades de carga', () => {
  it('describe cada modalidad y solo cuenta kg externos para el tonelaje', () => {
    expect(describeLoad({ kind: 'external', kg: 60, basis: 'total' })).toBe('60 kg');
    expect(describeLoad({ kind: 'bodyweight' })).toBe('Peso corporal');
    expect(describeLoad({ kind: 'bodyweight_plus', addedKg: 5 })).toBe('Peso corporal + 5 kg');
    expect(describeLoad({ kind: 'none' })).toBe('Sin carga');
    expect(prescribedExternalKg({ kind: 'external', kg: 60, basis: 'total' })).toBe(60);
    expect(prescribedExternalKg({ kind: 'bodyweight_plus', addedKg: 5 })).toBeNull();
    expect(prescribedExternalKg({ kind: 'assisted', assistanceKg: 20, via: 'machine' })).toBeNull();
  });

  it('valida los campos de cada modalidad', () => {
    expect(loadIssues({ kind: 'external', kg: 0, basis: 'total' }, 'l')).toHaveLength(1);
    expect(loadIssues({ kind: 'external', kg: 20, basis: 'per_implement' }, 'l')).toHaveLength(1);
    expect(
      loadIssues({ kind: 'external_range', minKg: 75, maxKg: 70, basis: 'total' }, 'l'),
    ).toHaveLength(1);
    expect(loadIssues({ kind: 'elastic', descriptor: '' }, 'l')).toHaveLength(1);
    expect(describeEffort({ kind: 'rir', rir: { min: 1, max: 3 } })).toBe('RIR 1–3');
  });
});

describe('versiones: bloqueos y resumen de cambios', () => {
  const v1 = content([
    squat({
      sets: 4,
      defaults: {
        ...squat().defaults,
        reps: { kind: 'fixed', reps: 6 },
        load: { kind: 'external', kg: 80, basis: 'total' },
      },
    }),
  ]);
  const logged = [
    { prescriptionId: 'itm-1', setNumber: 1 },
    { prescriptionId: 'itm-1', setNumber: 2 },
  ];

  it('permite cambiar lo pendiente sin tocar las series registradas (S-05)', () => {
    const v2 = content([
      squat({
        sets: 3,
        defaults: v1.items[0]!.defaults,
        perSet: [{ setNumber: 3, load: { kind: 'external', kg: 75, basis: 'total' } }],
      }),
    ]);
    expect(lockIssues(v1, v2, logged)).toEqual([]);
    const summary = changeSummary(v1, v2).map((c) => c.text);
    expect(summary).toContain('Sentadilla trasera con barra: 4 → 3 series');
    expect(
      summary.some((t) => t.includes('serie 3') && t.includes('80 kg') && t.includes('75 kg')),
    ).toBe(true);
  });

  it('bloquea cambiar o quitar lo ya registrado', () => {
    const changed = content([
      squat({
        sets: 4,
        defaults: { ...v1.items[0]!.defaults, load: { kind: 'external', kg: 75, basis: 'total' } },
      }),
    ]);
    expect(lockIssues(v1, changed, logged).map((i) => i.path)).toEqual([
      'items.0.sets.1',
      'items.0.sets.2',
    ]);
    expect(lockIssues(v1, content([]), logged)[0]!.message).toMatch(/no se puede quitar/);
    expect(
      lockIssues(
        v1,
        content([squat({ variantId: 'ex-front-squat', sets: 4, defaults: v1.items[0]!.defaults })]),
        logged,
      )[0]!.path,
    ).toBe('items.0.variantId');
    expect(
      lockIssues(v1, content([squat({ sets: 1, defaults: v1.items[0]!.defaults })]), logged)[0]!
        .path,
    ).toBe('items.0.sets');
  });

  it('marca como privados los cambios de la nota del entrenador', () => {
    const next = content([squat({ ...v1.items[0]!, privateNote: 'Vigilar la rodilla' })]);
    const changes = changeSummary(v1, next);
    expect(changes).toEqual([expect.objectContaining({ trainerOnly: true })]);
  });
});

describe('compatibilidad con el modelo de la Fase 1', () => {
  const legacy: ExercisePrescription = {
    id: 's-1-1',
    variantId: 'ex-back-squat',
    block: 'A',
    order: 1,
    sets: 4,
    reps: { kind: 'range', min: 6, max: 8 },
    load: { kind: 'kg', kg: 50 },
    restSeconds: 150,
    tempo: { eccentric: 3, firstPause: 1, concentric: 'X', secondPause: 0 },
    effort: { kind: 'rir', rir: 2 },
    notes: 'Repeticiones por pierna.',
  };

  it('una prescripción de la Fase 1 vuelve idéntica tras pasar por v2', () => {
    expect(itemToLegacy(itemFromLegacy(legacy))).toEqual(legacy);
    for (const load of [
      { kind: 'bodyweight' },
      { kind: 'text', text: '2 × 16 kg' },
      { kind: 'autoregulated' },
    ] as const) {
      expect(loadToLegacy(loadFromLegacy(load))).toEqual(load);
    }
  });

  it('las series que varían se resumen sin inventar datos', () => {
    const item = squat({
      perSet: [
        {
          setNumber: 3,
          reps: { kind: 'fixed', reps: 6 },
          load: { kind: 'external', kg: 70, basis: 'total' },
        },
      ],
    });
    const rx = itemToLegacy(item);
    expect(rx.reps).toEqual({ kind: 'range', min: 6, max: 10 });
    expect(rx.load).toEqual({ kind: 'text', text: 'Variable por serie' });
    expect(effortToLegacy({ kind: 'rir', rir: { min: 1, max: 3 } })).toEqual({ kind: 'none' });
  });

  it('proyecta el registro: series efectivas, pendientes como no completadas y RIR común', () => {
    const planned = toLegacySession({ id: 's-1', clientId: 'c-1' }, content());
    const log: SessionLogV2 = {
      id: 'l-1',
      sessionId: 's-1',
      clientId: 'c-1',
      startedAt: '2026-11-09T22:50:00.000Z', // 23:50 en Madrid
      startDeviceAt: '2026-11-09T22:50:00.000Z',
      startTimeZone: 'Europe/Madrid',
      startUtcOffsetMin: 60,
      startReceivedAt: '2026-11-09T22:50:01.000Z',
      lastActivityAt: '2026-11-09T23:05:00.000Z',
    };
    const set = (id: string, setNumber: number, extra: Partial<SetLogV2> = {}): SetLogV2 => ({
      clientSetId: id,
      sessionLogId: 'l-1',
      sessionId: 's-1',
      clientId: 'c-1',
      versionNumber: 1,
      prescriptionId: 'itm-1',
      variantId: 'ex-back-squat',
      setNumber,
      role: 'working',
      completed: true,
      reps: 10,
      load: { kind: 'external', kg: 60 },
      rir: 2,
      performedAt: '2026-11-09T22:58:00.000Z',
      deviceRecordedAt: '2026-11-09T22:58:00.000Z',
      deviceTimeZone: 'Europe/Madrid',
      deviceUtcOffsetMin: 60,
      receivedAt: '2026-11-09T22:58:01.000Z',
      clockAdjusted: false,
      ...extra,
    });
    const legacyLog = toLegacyLog(planned, log, [
      set('a', 1),
      set('b', 2, { reps: 8 }),
      set('c', 2, { reps: 10, supersedes: 'b' }), // corrección
    ]);
    expect(legacyLog.date).toBe('2026-11-09');
    expect(legacyLog.sets).toEqual([
      { prescriptionId: 'itm-1', setNumber: 1, reps: 10, loadKg: 60, completed: true },
      { prescriptionId: 'itm-1', setNumber: 2, reps: 10, loadKg: 60, completed: true },
      { prescriptionId: 'itm-1', setNumber: 3, reps: 0, loadKg: null, completed: false },
    ]);
    expect(legacyLog.exerciseFeedback).toEqual([{ prescriptionId: 'itm-1', rir: 2 }]);
  });
});

describe('ejecución: correcciones, horas y estados', () => {
  const base = {
    sessionLogId: 'l',
    sessionId: 's',
    clientId: 'c',
    versionNumber: 1,
    prescriptionId: 'p',
    variantId: 'v',
    role: 'working' as const,
    completed: true,
    performedAt: '2026-11-09T10:00:00.000Z',
    deviceRecordedAt: '2026-11-09T10:00:00.000Z',
    deviceTimeZone: 'Europe/Madrid',
    deviceUtcOffsetMin: 60,
    receivedAt: '2026-11-09T10:00:00.000Z',
    clockAdjusted: false,
  };

  it('el registro efectivo es el último de la cadena de correcciones', () => {
    const logs = [
      { ...base, clientSetId: 'a', setNumber: 1 },
      { ...base, clientSetId: 'b', setNumber: 1, supersedes: 'a' },
      { ...base, clientSetId: 'c', setNumber: 1, supersedes: 'b' },
      { ...base, clientSetId: 'd', setNumber: 2 },
    ];
    expect(effectiveSetLogs(logs).map((l) => l.clientSetId)).toEqual(['c', 'd']);
  });

  it('usa la hora del dispositivo salvo que sea posterior a la recepción', () => {
    expect(executionInstant('2026-11-09T23:58:00.000Z', '2026-11-10T08:00:00.000Z')).toEqual({
      performedAt: '2026-11-09T23:58:00.000Z',
      clockAdjusted: false,
    });
    expect(executionInstant('2026-11-10T09:00:00.000Z', '2026-11-10T08:00:00.000Z')).toEqual({
      performedAt: '2026-11-10T08:00:00.000Z',
      clockAdjusted: true,
    });
  });

  it('la fecha de ejecución es la local del inicio, también con el cambio de hora', () => {
    expect(
      executionDate({ startedAt: '2026-11-09T22:50:00.000Z', startTimeZone: 'Europe/Madrid' }),
    ).toBe('2026-11-09');
    expect(
      executionDate({ startedAt: '2026-11-09T23:10:00.000Z', startTimeZone: 'Europe/Madrid' }),
    ).toBe('2026-11-10');
    // 25-10-2026: Madrid pasa de UTC+2 a UTC+1 a las 03:00 locales.
    expect(utcOffsetMinutes('2026-10-25T00:30:00.000Z', 'Europe/Madrid')).toBe(120);
    expect(utcOffsetMinutes('2026-10-25T01:30:00.000Z', 'Europe/Madrid')).toBe(60);
    expect(
      executionDate({ startedAt: '2026-10-24T22:30:00.000Z', startTimeZone: 'Europe/Madrid' }),
    ).toBe('2026-10-25');
  });

  it('deduce los seis estados', () => {
    const currentSets = [
      { prescriptionId: 'p', setNumber: 1 },
      { prescriptionId: 'p', setNumber: 2 },
    ];
    const log: SessionLogV2 = {
      id: 'l',
      sessionId: 's',
      clientId: 'c',
      startedAt: '2026-11-09T09:00:00.000Z',
      startDeviceAt: '2026-11-09T09:00:00.000Z',
      startTimeZone: 'Europe/Madrid',
      startUtcOffsetMin: 60,
      startReceivedAt: '2026-11-09T09:00:00.000Z',
      lastActivityAt: '2026-11-09T09:10:00.000Z',
    };
    const one = [{ ...base, clientSetId: 'a', setNumber: 1 }];
    const both = [...one, { ...base, clientSetId: 'b', setNumber: 2 }];
    const status = (overrides: Partial<Parameters<typeof executionStatus>[0]>) =>
      executionStatus({
        plannedDate: TODAY,
        currentSets,
        log: null,
        setLogs: [],
        today: TODAY,
        timeZone: 'Europe/Madrid',
        ...overrides,
      });
    expect(status({})).toBe('planned');
    expect(status({ plannedDate: '2026-11-08' })).toBe('overdue');
    expect(status({ log, setLogs: one })).toBe('in_progress');
    expect(status({ log, setLogs: one, today: '2026-11-10' })).toBe('interrupted');
    expect(status({ log, setLogs: both })).toBe('completed');
    expect(
      status({
        log: {
          ...log,
          finishedAt: log.lastActivityAt,
          finishReason: 'ended_early',
          pendingSetsConfirmed: 1,
        },
        setLogs: one,
      }),
    ).toBe('partial');
    // Una serie hecha con menos repeticiones cuenta como hecha: completada.
    expect(status({ log, setLogs: [{ ...one[0]!, reps: 9 }, both[1]!] })).toBe('completed');
  });
});
