import { describe, expect, it } from 'vitest';
import {
  describeTempo,
  formatEffort,
  formatLoad,
  formatSetsAndReps,
  formatTempo,
  parseTempo,
  prescriptionIssues,
  type ExercisePrescription,
} from './prescription';

const valid: ExercisePrescription = {
  id: 'p1',
  variantId: 'e1',
  block: 'A',
  order: 1,
  sets: 4,
  reps: { kind: 'range', min: 6, max: 8 },
  load: { kind: 'kg', kg: 62.5 },
  restSeconds: 120,
  tempo: { eccentric: 3, firstPause: 1, concentric: 'X', secondPause: 0 },
  effort: { kind: 'rir', rir: 2 },
};

describe('prescripción', () => {
  it('lee y escribe el tempo, incluida la fase explosiva', () => {
    expect(parseTempo('3-1-x-0')).toEqual({
      eccentric: 3,
      firstPause: 1,
      concentric: 'X',
      secondPause: 0,
    });
    expect(parseTempo('3-1-1')).toBeNull();
    expect(formatTempo(valid.tempo!)).toBe('3-1-X-0');
    expect(describeTempo(valid.tempo!)).toEqual([
      '3 s en la fase excéntrica (frenando el peso)',
      '1 s de pausa al final de la fase excéntrica',
      'Fase concéntrica explosiva, lo más rápido posible con buena técnica',
      'Sin pausa antes de la siguiente repetición',
    ]);
  });

  it('formatea series, carga y esfuerzo en español', () => {
    expect(formatSetsAndReps(4, valid.reps)).toBe('4 × 6–8');
    expect(formatSetsAndReps(3, { kind: 'seconds', seconds: 30 })).toBe('3 × 30 s');
    expect(formatLoad(valid.load)).toBe('62,5 kg');
    expect(formatEffort({ kind: 'character', performed: 6, possible: 12 })).toBe('Carácter 6 (12)');
    expect(formatEffort({ kind: 'none' })).toBeNull();
  });

  it('acepta una prescripción válida', () => {
    expect(prescriptionIssues(valid)).toEqual([]);
  });

  it('detecta prescripciones imposibles', () => {
    const issues = prescriptionIssues({
      ...valid,
      sets: 0,
      reps: { kind: 'range', min: 8, max: 6 },
      effort: { kind: 'character', performed: 10, possible: 8 },
    });
    expect(issues).toHaveLength(3);
    expect(prescriptionIssues({ ...valid, effort: { kind: 'rpe', rpe: 7.3 } })).toHaveLength(1);
  });
});
