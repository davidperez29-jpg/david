import { describe, expect, it } from 'vitest';
import { compareResults, type AssessmentResult } from './assessment';
import { filterExercises, isSafeExternalUrl, type Exercise } from './exercises';
import { currentPhase, isPhaseComplete, type RehabCase } from './rehab';
import { initials, matchesSearch } from './text';
import { sessionStatus, type PlannedSession } from './training/session';

const result = (value: number, method = 'Fotocélulas'): AssessmentResult => ({
  id: `r-${value}`,
  clientId: 'c1',
  testId: 'sprint-20',
  date: '2026-11-01',
  measurement: {
    value,
    unit: 's',
    provenance: {
      origin: 'direct',
      method,
      measuredAt: '2026-11-01T10:00:00Z',
      recordedAt: '2026-11-01T10:00:00Z',
      recordedBy: 'trainer',
    },
  },
});

describe('comparación de evaluaciones', () => {
  it('interpreta la mejora según el sentido de la prueba', () => {
    const comparison = compareResults(result(3.7), result(3.6), 'lower');
    expect(comparison.comparable).toBe(true);
    if (comparison.comparable) {
      expect(comparison.improved).toBe(true);
      expect(comparison.absolute).toBeCloseTo(-0.1);
      expect(comparison.percent).toBeCloseTo(-2.7027, 3);
    }
  });

  it('no compara resultados obtenidos con métodos distintos', () => {
    expect(compareResults(result(3.7), result(3.6, 'Cronómetro manual'), 'lower')).toEqual({
      comparable: false,
      reason: 'El método o el instrumento no coinciden.',
    });
  });
});

describe('readaptación', () => {
  const rehab: RehabCase = {
    id: 'r1',
    clientId: 'c1',
    title: 'Caso',
    startedOn: '2026-10-01',
    status: 'active',
    phases: [
      {
        id: 'f2',
        order: 2,
        name: 'Fase 2',
        goal: '',
        criteria: [{ id: 'b', description: 'B', status: 'pending', definedBy: 'clinician' }],
      },
      {
        id: 'f1',
        order: 1,
        name: 'Fase 1',
        goal: '',
        criteria: [{ id: 'a', description: 'A', status: 'met', definedBy: 'clinician' }],
      },
      { id: 'f3', order: 3, name: 'Fase 3', goal: '', criteria: [] },
    ],
  };

  it('la fase actual es la primera, por orden, que no está superada', () => {
    expect(currentPhase(rehab)?.id).toBe('f2');
  });

  it('una fase sin criterios no se da por superada', () => {
    expect(isPhaseComplete(rehab.phases[2]!)).toBe(false);
  });
});

describe('sesiones', () => {
  const session: PlannedSession = {
    id: 's1',
    clientId: 'c1',
    date: '2026-11-03',
    title: 'Fuerza',
    focus: '',
    estimatedMinutes: 50,
    exercises: [],
  };

  it('deriva el estado a partir del registro y de la fecha', () => {
    expect(sessionStatus(session, undefined, '2026-11-04')).toBe('missed');
    expect(sessionStatus(session, undefined, '2026-11-03')).toBe('pending');
    const partial = {
      id: 'l',
      sessionId: 's1',
      clientId: 'c1',
      date: '2026-11-03',
      sets: [{ prescriptionId: 'p', setNumber: 1, reps: 5, loadKg: 20, completed: true }],
    };
    expect(sessionStatus(session, partial, '2026-11-04')).toBe('partial');
    expect(
      sessionStatus(session, { ...partial, completedAt: '2026-11-03T19:00:00Z' }, '2026-11-04'),
    ).toBe('completed');
  });
});

describe('búsqueda y textos', () => {
  const exercises = [
    { id: '1', name: 'Sentadilla búlgara', pattern: 'lunge', equipment: ['Mancuernas'] },
    { id: '2', name: 'Press de banca', pattern: 'push', equipment: ['Barra'] },
  ] as Exercise[];

  it('busca sin distinguir tildes ni mayúsculas', () => {
    expect(filterExercises(exercises, { query: 'BULGARA' }).map((e) => e.id)).toEqual(['1']);
    expect(filterExercises(exercises, { pattern: 'push' }).map((e) => e.id)).toEqual(['2']);
    expect(matchesSearch(['Marta Ríos'], 'rios')).toBe(true);
  });

  it('obtiene las iniciales', () => {
    expect(initials('Marta Ríos')).toBe('MR');
    expect(initials('  Carmen  ')).toBe('C');
  });

  it('solo admite enlaces externos https', () => {
    expect(isSafeExternalUrl('https://example.org/video')).toBe(true);
    expect(isSafeExternalUrl('http://example.org/video')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('intentos de evaluación', async () => {
  const { aggregateAttempts, resultIssues, compareResults } = await import('./assessment');
  const prov = (origin: 'imported' | 'calculated', formula?: { id: string; version: string }) => ({
    origin,
    method: 'Aplicación de salto',
    measuredAt: '2026-11-01T10:00:00Z',
    recordedAt: '2026-11-01T10:00:00Z',
    recordedBy: 'device' as const,
    ...(formula ? { formula } : {}),
    ...(origin === 'imported' ? { importedFrom: 'CSV' } : {}),
  });

  it('el mejor intento depende del sentido de la prueba', () => {
    expect(aggregateAttempts([30.1, 31.4, 30.8], 'best', 'higher')).toBe(31.4);
    expect(aggregateAttempts([3.71, 3.65], 'best', 'lower')).toBe(3.65);
    expect(aggregateAttempts([30, 31, 32], 'mean', 'higher')).toBe(31);
    expect(() => aggregateAttempts([], 'best', 'higher')).toThrow(RangeError);
  });

  it('un resultado agregado debe coincidir con sus intentos y ser «calculado»', () => {
    const attempts = [30.1, 31.4].map((value) => ({
      value,
      unit: 'cm' as const,
      provenance: prov('imported'),
    }));
    const good = {
      id: 'r',
      clientId: 'c',
      testId: 'cmj',
      date: '2026-11-01',
      attempts,
      aggregation: 'best' as const,
      measurement: {
        value: 31.4,
        unit: 'cm' as const,
        provenance: prov('calculated', { id: 'assessment.best-attempt', version: '1.0.0' }),
      },
    };
    expect(resultIssues(good)).toEqual([]);
    expect(resultIssues({ ...good, measurement: { ...good.measurement, value: 30.1 } })[0]).toMatch(
      /no coincide/,
    );
    expect(
      resultIssues({ ...good, measurement: { ...good.measurement, provenance: prov('imported') } }),
    ).toContain('Un resultado agregado debe ser «calculado» con la fórmula de su regla.');
    // No se comparan resultados obtenidos con reglas distintas.
    const mean = { ...good, aggregation: 'mean' as const };
    expect(compareResults(good, mean, 'higher')).toEqual({
      comparable: false,
      reason: 'La regla de agregación de intentos no coincide.',
    });
  });
});
