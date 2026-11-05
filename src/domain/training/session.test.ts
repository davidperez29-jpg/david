import { describe, expect, it } from 'vitest';
import { summarizeVolume } from './volume';
import {
  deriveSessionStatus,
  effectiveSetRecords,
  isValidPerceivedEffort,
  sessionStatus,
  summarizeExecution,
  type PlannedSession,
  type SessionLog,
  type SetRecord,
} from './session';

const rx = (id: string, sets: number) => ({
  id,
  variantId: 'v',
  block: 'A',
  order: 1,
  sets,
  reps: { kind: 'fixed' as const, reps: 5 },
  load: { kind: 'kg' as const, kg: 50 },
  restSeconds: 60,
  effort: { kind: 'none' as const },
});

// 16 series en 5 ejercicios, como la sesión de la captura revisada.
const session: PlannedSession = {
  id: 's1',
  clientId: 'c1',
  date: '2026-11-05',
  title: 'Fuerza',
  focus: '',
  estimatedMinutes: 55,
  exercises: [rx('a1', 4), rx('a2', 3), rx('b1', 3), rx('b2', 3), rx('c1', 3)],
};

const done = (prescriptionId: string, setNumber: number, reps = 5): SetRecord => ({
  prescriptionId,
  setNumber,
  reps,
  loadKg: 50,
  completed: true,
});

const log = (sets: SetRecord[], extra: Partial<SessionLog> = {}): SessionLog => ({
  id: 'l1',
  sessionId: 's1',
  clientId: 'c1',
  date: '2026-11-05',
  startedAt: '2026-11-05T18:00:00Z',
  sets,
  ...extra,
});

const fourSets = [1, 2, 3, 4].map((n) => done('a1', n));
const allSets = session.exercises.flatMap((e) =>
  Array.from({ length: e.sets }, (_, i) => done(e.id, i + 1)),
);

describe('estado de una sesión', () => {
  it('4 de 16 series y terminada por el cliente: parcial, nunca completada', () => {
    expect(
      sessionStatus(session, log(fourSets, { finishedAt: '2026-11-05T19:00:00Z' }), '2026-11-05'),
    ).toBe('partial');
  });

  it('empezada hoy y sin terminar: en curso', () => {
    expect(sessionStatus(session, log(fourSets), '2026-11-05')).toBe('in_progress');
    expect(sessionStatus(session, log([]), '2026-11-05')).toBe('in_progress');
  });

  it('empezada y abandonada (pasó el día): parcial o interrumpida', () => {
    expect(sessionStatus(session, log(fourSets), '2026-11-06')).toBe('partial');
  });

  it('completada solo si están hechas todas las series prescritas', () => {
    expect(sessionStatus(session, log(allSets), '2026-11-05')).toBe('completed');
    expect(
      sessionStatus(
        session,
        log(allSets.slice(1), { finishedAt: '2026-11-05T19:00:00Z' }),
        '2026-11-05',
      ),
    ).toBe('partial');
  });

  it('sin registro: pendiente hasta que pasa el día; terminar sin series: no realizada', () => {
    expect(sessionStatus(session, undefined, '2026-11-05')).toBe('pending');
    expect(sessionStatus(session, undefined, '2026-11-06')).toBe('missed');
    expect(
      sessionStatus(session, log([], { finishedAt: '2026-11-05T18:05:00Z' }), '2026-11-05'),
    ).toBe('missed');
  });

  it('una sesión sin series prescritas no se da por completada', () => {
    expect(
      deriveSessionStatus(
        { plannedSets: 0, completedSets: 0 },
        { started: true, finished: true, dayPassed: false },
      ),
    ).toBe('missed');
  });
});

describe('resumen de la ejecución', () => {
  it('refleja series y ejercicios prescritos y realizados', () => {
    const summary = summarizeExecution(session, [...fourSets, done('a2', 1)]);
    expect(summary).toMatchObject({
      plannedSets: 16,
      completedSets: 5,
      plannedExercises: 5,
      completedExercises: 1,
      startedExercises: 1,
      ignoredRecords: 0,
    });
  });

  it('no cuenta dos veces una serie registrada dos veces (cuenta el último registro)', () => {
    const records = [done('a1', 1, 5), done('a1', 1, 8), done('a1', 2, 5)];
    const effective = effectiveSetRecords(session, records);
    expect(effective).toHaveLength(2);
    expect(effective.find((r) => r.setNumber === 1)?.reps).toBe(8);
    expect(summarizeExecution(session, records).ignoredRecords).toBe(1);
    // El tonelaje se calcula sobre las series efectivas: (8 + 5) × 50 kg.
    expect(summarizeVolume(effective).volumeLoadKg).toBe(650);
  });

  it('descarta registros que no corresponden a lo prescrito', () => {
    const records = [done('a1', 5), done('a1', 0), done('zz', 1), done('a1', 1)];
    expect(effectiveSetRecords(session, records)).toHaveLength(1);
  });

  it('una serie desmarcada deja de contar', () => {
    const records = [done('a1', 1), { ...done('a1', 1), completed: false }];
    expect(summarizeExecution(session, records).completedSets).toBe(0);
  });
});

describe('esfuerzo percibido', () => {
  it('acepta enteros de 0 a 10', () => {
    expect([0, 5, 10].every(isValidPerceivedEffort)).toBe(true);
    expect([-1, 11, 5.5, Number.NaN, '7'].some(isValidPerceivedEffort)).toBe(false);
  });
});
