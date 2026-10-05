import { describe, expect, it } from 'vitest';
import { LEVEL_DIMENSIONS, LEVEL_NAMES, suggestLevel } from '../src';

describe('programming levels', () => {
  it('three named levels', () => {
    expect(LEVEL_NAMES).toEqual({ 1: 'Inicial', 2: 'Intermedio', 3: 'Avanzado' });
  });

  it('every dimension of the brief has a distinct descriptor per level', () => {
    expect(LEVEL_DIMENSIONS.map((d) => d.key)).toEqual([
      'complejidad',
      'intensidad',
      'volumen',
      'densidad',
      'especificidad',
      'velocidad',
      'demanda_neuromuscular',
      'control_tecnico',
      'tolerancia',
      'experiencia',
    ]);
    for (const d of LEVEL_DIMENSIONS) {
      expect(d.levels).toHaveLength(3);
      expect(new Set(d.levels).size).toBe(3);
      for (const t of d.levels) expect(t.trim()).not.toBe('');
    }
  });

  it('suggests the starting level from the declared experience only', () => {
    expect(suggestLevel('advanced')).toBe(3);
    expect(suggestLevel('intermediate')).toBe(2);
    expect(suggestLevel('beginner')).toBe(1);
    expect(suggestLevel('none')).toBe(1);
    expect(suggestLevel(null)).toBe(1);
    expect(suggestLevel(undefined)).toBe(1);
  });
});
