import { describe, expect, it } from 'vitest';
import {
  blockHint,
  equipmentFromName,
  profileFor,
  BLOCK_HINTS,
  MESO_PATTERNS,
  MESO_GROUPS,
} from '../scripts/exercise-bank/mapping';
import { MOVEMENT_PATTERNS, MUSCLES, EXERCISE_CATEGORIES, PRESCRIPTION_PROFILES } from '@tp/db';

describe('exercise bank mapping', () => {
  it('maps blocks by longest prefix, accent-insensitively', () => {
    expect(blockHint('Activación · Técnica de carrera y coordinación')?.pattern).toBe('sprint_cod');
    expect(blockHint('Activación · Movilidad dinámica')?.pattern).toBe('mobility_activation');
    expect(blockHint('HIPERTROFIA · biceps')?.primaryMuscles).toEqual(['biceps_brachii']);
    expect(blockHint('Bloque inventado')).toBeNull();
  });
  it('deduces equipment only from whole words', () => {
    expect(equipmentFromName('Remo con mancuerna a una mano').sort()).toEqual(['dumbbells']);
    expect(equipmentFromName('Press banca con barra').sort()).toEqual(['barbell', 'bench']);
    expect(equipmentFromName('Barrido de cadera')).toEqual([]); // "barra" must not match "Barrido"
  });
  it('picks a prescription profile', () => {
    expect(profileFor(null, ['isometric'], ['isometric'])).toBe('isometric');
    expect(profileFor('jump_plyometric', [], [])).toBe('plyometric');
    expect(profileFor('knee_dominant', ['strength'], [])).toBe('loaded_dynamic');
  });
  it('only references taxonomy slugs that exist in the catalogue', () => {
    const patterns = new Set(MOVEMENT_PATTERNS.map((p) => p[0]));
    const muscles = new Set(MUSCLES.map((m) => m[0]));
    const cats = new Set(EXERCISE_CATEGORIES.map((c) => c[0]));
    const profiles = new Set(PRESCRIPTION_PROFILES.map((p) => p[0]));
    for (const [, h] of BLOCK_HINTS) {
      if (h.pattern) expect(patterns).toContain(h.pattern);
      for (const m of h.primaryMuscles ?? []) expect(muscles).toContain(m);
      for (const c of h.categories) expect(cats).toContain(c);
      if (h.profile) expect(profiles).toContain(h.profile);
    }
    for (const p of Object.values(MESO_PATTERNS)) expect(patterns).toContain(p);
    for (const m of Object.values(MESO_GROUPS)) expect(muscles).toContain(m);
  });
});
