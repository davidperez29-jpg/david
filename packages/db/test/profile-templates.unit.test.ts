import { templateSessions, validateDefinition, validatePrescription } from '@tp/domain';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateProfileTemplates,
  loadEvidenceFiles,
  loadExerciseFile,
  loadTemplateFiles,
  methodsOf,
  PROFILE_TEMPLATE_SPECS,
  PROGRAMMING_PROFILES,
  templateFacets,
} from '../src';
import { SEED_DIR } from '../src/testing';

const exercises = new Map(
  loadExerciseFile(join(SEED_DIR, 'exercises', 'global.json')).exercises.map((e) => [e.slug, e]),
);
const methods = new Set(loadEvidenceFiles(join(SEED_DIR, 'evidence')).methods.map((m) => m.slug));
const handWritten = loadTemplateFiles(join(SEED_DIR, 'templates'));
const generated = generateProfileTemplates(handWritten);
const exercisesOf = (t: (typeof generated)[number]) =>
  templateSessions(t.definition).flatMap((s) => s.blocks.flatMap((b) => b.exercises));

describe('generated templates (profile × level × days)', () => {
  it('fill every offered combination exactly once, next to the hand-written templates', () => {
    const all = [...handWritten, ...generated];
    expect(new Set(all.map((t) => t.slug)).size).toBe(all.length);
    const key = (t: (typeof all)[number]) => {
      const f = templateFacets(t);
      return `${f.profile}:${f.levelN}:${t.definition.sessionsPerWeek}:${f.kind}`;
    };
    const training = all.filter((t) => templateFacets(t).kind === 'training');
    expect(new Set(training.map(key)).size).toBe(training.length);
    for (const spec of PROFILE_TEMPLATE_SPECS)
      for (const level of [1, 2, 3] as const)
        for (const days of spec.days[level])
          expect(
            all.some((t) => key(t) === `${spec.profile}:${level}:${days}:training`),
            `${spec.profile} N${level} ${days}d`,
          ).toBe(true);
    // The decision engine picks templates by the goal prefix (hipertrofia-, fuerza-…): generated
    // templates never take part in that choice.
    for (const t of generated) expect(t.slug).toMatch(/^(perfil|riesgo)-/);
  });

  it('only offer profiles that have generic templates (not readaptation or custom)', () => {
    const offered = new Set(PROFILE_TEMPLATE_SPECS.map((s) => s.profile));
    for (const p of PROGRAMMING_PROFILES)
      expect(offered.has(p.slug), p.slug).toBe(
        !['readaptacion', 'personalizado'].includes(p.family),
      );
  });

  it('have valid definitions, known exercises and methods, and valid prescriptions', () => {
    for (const t of generated) {
      expect(validateDefinition(t.definition), t.slug).toEqual([]);
      expect(t.definition.durationMonths).toBe(3);
      expect(t.methods, t.slug).toEqual(methodsOf(t.definition));
      expect(t.methods.length, t.slug).toBeGreaterThan(0);
      for (const m of t.methods) expect(methods.has(m), `${t.slug} → ${m}`).toBe(true);
      for (const e of exercisesOf(t)) {
        const g = exercises.get(e.exercise);
        expect(g, `${t.slug} → ${e.exercise}`).toBeTruthy();
        expect(
          validatePrescription(e.prescription, {
            supportsVbt: g!.supportsVbt ?? false,
            clientExperience: 'advanced',
          }),
          `${t.slug} ${e.exercise}`,
        ).toEqual({});
        // Every exercise says how much: reps, time, distance or contacts.
        const p = e.prescription;
        expect(
          p.repsMin ?? p.durationS ?? p.distanceM ?? p.contacts,
          `${t.slug} ${e.exercise}`,
        ).toBeTruthy();
      }
    }
  });

  it('match the level: no advanced exercises at level 1 and no high impact for older adults or PC at levels 1–2', () => {
    for (const t of generated) {
      const f = templateFacets(t);
      for (const e of exercisesOf(t)) {
        const g = exercises.get(e.exercise)!;
        if (f.levelN === 1) expect(g.level, `${t.slug} ${e.exercise}`).not.toBe('advanced');
        if (
          (f.population.includes('adulto_mayor') || f.population.includes('pc_leve')) &&
          f.levelN !== 3
        )
          expect(g.impactLevel, `${t.slug} ${e.exercise}`).not.toBe('high');
      }
    }
  });

  it('cite the evidence that fits each population', () => {
    const uses = (slug: string, m: string) =>
      generated.find((t) => t.slug === slug)!.methods.includes(m);
    expect(uses('perfil-adulto-mayor-n1-3d', 'equilibrio-mayores')).toBe(true);
    expect(uses('perfil-adulto-mayor-n1-3d', 'fuerza-mayores')).toBe(true);
    expect(uses('perfil-paralisis-cerebral-leve-n1-2d', 'fuerza-paralisis-cerebral')).toBe(true);
    expect(uses('perfil-salud-n2-3d', 'actividad-fisica-oms')).toBe(true);
    // Evidence for older adults is not reused for other adults.
    for (const t of generated.filter((x) => templateFacets(x).profile !== 'adulto-mayor'))
      expect(
        t.methods.includes('equilibrio-mayores') || t.methods.includes('fuerza-mayores'),
        t.slug,
      ).toBe(false);
    // fuerza-maxima (> 80 % 1RM) is not cited by level-1 doses.
    for (const t of generated.filter((x) => x.levelN === 1 && x.kind !== 'risk_reduction'))
      expect(t.methods, t.slug).not.toContain('fuerza-maxima');
  });

  it('give each risk-reduction routine three levels, never as an injury guarantee', () => {
    const routines = generated.filter((t) => t.kind === 'risk_reduction');
    expect(routines.map((t) => t.slug).sort()).toEqual(
      ['aductores', 'cuadriceps', 'isquiosurales'].flatMap((r) =>
        [1, 2, 3].map((n) => `riesgo-${r}-n${n}`),
      ),
    );
    for (const t of routines) {
      expect(templateFacets(t).profile, t.slug).toBeNull();
      expect(t.population).toEqual(['deportistas']);
      expect(t.description, t.slug).not.toMatch(
        /\bprevien[ea]\b|\bevita las lesiones|\breduce las lesiones/i,
      );
    }
  });
});
