import { validateDefinition, validatePrescription } from '@tp/domain';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXERCISE_CATEGORIES,
  loadEvidenceFiles,
  loadExerciseFile,
  loadTemplateFiles,
  MOVEMENT_PATTERNS,
  MUSCLES,
  PRESCRIPTION_PROFILES,
} from '../src';
import { SEED_DIR } from '../src/testing';

const ex = loadExerciseFile(join(SEED_DIR, 'exercises', 'global.json'));
const templates = loadTemplateFiles(join(SEED_DIR, 'templates'));
const methods = new Set(loadEvidenceFiles(join(SEED_DIR, 'evidence')).methods.map((m) => m.slug));
const slugs = new Map(ex.exercises.map((e) => [e.slug, e]));

describe('global exercises', () => {
  it('use catalogued taxonomy and meet the publish requirements', () => {
    const patterns = new Set(MOVEMENT_PATTERNS.map(([s]) => s));
    const muscles = new Set(MUSCLES.map(([s]) => s));
    const cats = new Set(EXERCISE_CATEGORIES.map(([s]) => s));
    const profiles = new Set(PRESCRIPTION_PROFILES.map(([s]) => s));
    expect(slugs.size).toBe(ex.exercises.length);
    for (const e of ex.exercises) {
      expect(patterns.has(e.pattern), e.slug).toBe(true);
      expect(profiles.has(e.profile), e.slug).toBe(true);
      expect(e.categories.length, e.slug).toBeGreaterThan(0);
      for (const c of e.categories) expect(cats.has(c), `${e.slug} ${c}`).toBe(true);
      for (const m of [...e.primaryMuscles, ...(e.secondaryMuscles ?? [])])
        expect(muscles.has(m), `${e.slug} ${m}`).toBe(true);
      expect(e.clientDescription.length, e.slug).toBeGreaterThan(10);
    }
  });
  it('progressions reference known exercises', () => {
    for (const p of ex.progressions) {
      expect(slugs.has(p.from), p.from).toBe(true);
      expect(slugs.has(p.to), p.to).toBe(true);
    }
  });
});

describe('plan templates', () => {
  it('cover the goal × frequency matrix with valid definitions, exercises, methods and prescriptions', () => {
    expect(templates.length).toBeGreaterThanOrEqual(17);
    expect(new Set(templates.map((t) => t.slug)).size).toBe(templates.length);
    for (const t of templates) {
      expect(validateDefinition(t.definition), t.slug).toEqual([]);
      for (const m of t.methods) expect(methods.has(m), `${t.slug} → ${m}`).toBe(true);
      for (const s of t.definition.sessions)
        for (const b of s.blocks)
          for (const e of b.exercises) {
            const g = slugs.get(e.exercise);
            expect(g, `${t.slug} → ${e.exercise}`).toBeTruthy();
            expect(
              validatePrescription(e.prescription, {
                supportsVbt: g!.supportsVbt ?? false,
                clientExperience: 'advanced',
              }),
              `${t.slug} ${e.exercise}`,
            ).toEqual({});
            for (const m of e.methods ?? []) expect(t.methods).toContain(m);
          }
    }
  });
});
