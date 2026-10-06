import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canAdvance,
  CASE_STATUS_LABELS,
  caseStatus,
  decisionText,
  evaluateCriterion,
  lsi,
  PHASE_SCAFFOLD,
  readChange,
  rtpChecklist,
  RTP_OUTCOMES,
  symptomAlerts,
  type CriterionDef,
  type PhaseState,
} from '../src';

const crit = (over: Partial<CriterionDef> = {}): CriterionDef => ({
  id: 'c',
  role: 'progression',
  text: 'LSI del salto ≥ 90 %',
  mandatory: true,
  auto: { testSlug: 'single_leg_cmj_height', metric: 'lsi', operator: '>=', threshold: 90 },
  ...over,
});
const state = (over: Partial<PhaseState> = {}): PhaseState => ({
  phaseIndex: 1,
  phasesCount: 4,
  mandatory: [true, true],
  stopMet: 0,
  openAlerts: 0,
  decisionRequested: false,
  ...over,
});

describe('safety alerts (§3)', () => {
  it('neurological symptoms stop the progression; pain over the threshold, worsening and flags ask to review', () => {
    expect(symptomAlerts({ recordedOn: '2026-10-01', pain: 1, neurological: true }, null)).toEqual([
      expect.objectContaining({ kind: 'neurological', severity: 'stop' }),
    ]);
    const a = symptomAlerts(
      { recordedOn: '2026-10-02', pain: 6, swelling: true },
      { recordedOn: '2026-10-01', pain: 3 },
      5,
    );
    expect(a.map((x) => x.kind)).toEqual(['pain_high', 'worsening', 'swelling']);
    expect(a.every((x) => x.message.includes('Revisar antes de progresar'))).toBe(true);
    expect(
      symptomAlerts({ recordedOn: '2026-10-02', pain: 2 }, { recordedOn: '2026-10-01', pain: 3 }),
    ).toEqual([]);
  });
  it('property: pain at or over the threshold always raises an alert; below never (alone)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), fc.integer({ min: 1, max: 10 }), (pain, th) => {
        const a = symptomAlerts({ recordedOn: 'x', pain }, null, th);
        expect(a.some((x) => x.kind === 'pain_high')).toBe(pain >= th);
      }),
    );
  });
});

describe('criteria', () => {
  it('LSI of the injured side; missing data is never «met»', () => {
    expect(lsi(18, 20)).toBe(90);
    expect(lsi(1.1, 1.0, 'lower')).toBeCloseTo(90.909, 2);
    expect(evaluateCriterion(crit(), { left: 18, right: 20, better: 'higher' }, 'left')).toEqual({
      met: true,
      value: 90,
    });
    expect(evaluateCriterion(crit(), { left: 17, right: 20, better: 'higher' }, 'left')).toEqual({
      met: false,
      value: 85,
    });
    // Injured right: the right side is the numerator.
    expect(
      evaluateCriterion(crit(), { left: 17, right: 20, better: 'higher' }, 'right')!.value,
    ).toBeCloseTo(117.6, 1);
    expect(
      evaluateCriterion(crit(), { left: 17, right: null, better: 'higher' }, 'left'),
    ).toBeNull();
    expect(
      evaluateCriterion(crit({ auto: null }), { value: 1, better: 'higher' }, 'left'),
    ).toBeNull();
    expect(
      evaluateCriterion(
        crit({ auto: { testSlug: 't', metric: 'value', operator: '<=', threshold: 11 } }),
        { value: 10.5, better: 'lower' },
        'none',
      ),
    ).toEqual({ met: true, value: 10.5 });
  });
});

describe('phases and case status (§4)', () => {
  it('advance only with every mandatory criterion met, no open alerts and no stop criterion', () => {
    expect(canAdvance(state()).allowed).toBe(true);
    expect(canAdvance(state({ openAlerts: 1 })).reasons.join(' ')).toMatch(/alerta/);
    expect(canAdvance(state({ mandatory: [true, null] })).allowed).toBe(false);
    expect(canAdvance(state({ stopMet: 1 })).allowed).toBe(false);
    expect(canAdvance(state({ phaseIndex: 3 })).reasons.join(' ')).toMatch(/última fase/);
    expect(canAdvance(state({ phaseIndex: null })).allowed).toBe(false);
  });

  it('status: the highest computed state is «Listo para valoración»; never «apto»', () => {
    expect(caseStatus(state({ phaseIndex: null }))).toBe('not_started');
    expect(caseStatus(state({ mandatory: [true, false] }))).toBe('partial');
    expect(caseStatus(state({ mandatory: [false, false] }))).toBe('in_progress');
    expect(caseStatus(state({ phaseIndex: 3 }))).toBe('ready_for_assessment');
    expect(caseStatus(state({ phaseIndex: 3, openAlerts: 1 }))).toBe('in_progress');
    expect(caseStatus(state({ phaseIndex: 3, decisionRequested: true }))).toBe('decision_pending');
    const all = [
      ...Object.values(CASE_STATUS_LABELS),
      ...Object.values(RTP_OUTCOMES),
      ...PHASE_SCAFFOLD,
    ].join(' ');
    expect(all).not.toMatch(/\bapt[oa]s?\b/i);
  });

  it('property: an open alert always blocks the advance and «Listo para valoración»', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(true, false, null), { maxLength: 6 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 7 }),
        (mandatory, openAlerts, phaseIndex) => {
          const s = state({ mandatory, openAlerts, phaseIndex, phasesCount: 8 });
          expect(canAdvance(s).allowed).toBe(false);
          expect(caseStatus(s)).not.toBe('ready_for_assessment');
        },
      ),
    );
  });
});

describe('return to play', () => {
  it('checklist: met / pending / no aplica; the team item only with a recorded decision', () => {
    const c = rtpChecklist(
      [
        { item: 'strength', met: true },
        { item: 'strength', met: true },
        { item: 'running', met: null },
      ],
      false,
    );
    const by = Object.fromEntries(c.map((x) => [x.item, x.status]));
    expect(by.strength).toBe('met');
    expect(by.running).toBe('pending');
    expect(by.rom).toBe('not_applicable');
    expect(by.team_assessment).toBe('pending');
    expect(rtpChecklist([], true).find((x) => x.item === 'team_assessment')!.status).toBe('met');
    expect(c).toHaveLength(14);
  });
  it('a decision is a person’s, with name and role', () => {
    expect(
      decisionText({
        stage: 'return_to_sport',
        outcome: 'authorized',
        decidedBy: 'Dra. Ruiz',
        role: 'Médica del club',
        decidedOn: '2026-10-05',
      }),
    ).toBe(
      'Vuelta al deporte: autorizada por el equipo responsable (Dra. Ruiz, Médica del club, 05/10/2026).',
    );
  });
});

describe('readaptation comparison (§25)', () => {
  const err = { te: 1, mdc95: 2.8, swc: null, origin: 'published' as const, basis: '', label: '' };
  it('improves / worsens beyond the error; stable within; no data is never filled', () => {
    expect(readChange(30, 34, 'higher', err).reading).toBe('improves');
    expect(readChange(30, 26, 'higher', err).reading).toBe('worsens');
    expect(readChange(30, 31, 'higher', err).reading).toBe('stable');
    expect(readChange(null, 31, 'higher', err).reading).toBe('no_data');
    // Without a known error the direction is shown, flagged.
    expect(readChange(2.0, 1.9, 'lower', null)).toMatchObject({
      reading: 'improves',
      errorKnown: false,
    });
  });
});
