/**
 * Golden test (restructure phase 4): the engine reproduces the club workbook. The fixture holds
 * synthetic players run through the workbook's own formulas by LibreOffice
 * (scripts/golden/make_club_fixture.py; no real names or data): same medians of the skinfolds,
 * same minimum of the sprint attempts, same Σ pliegues, % graso, masa grasa, MLG, IMC, asymmetry,
 * N, mean, SD, max, min, best and worst, and same Z against the team.
 */
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/club-golden.json';
import {
  aggregateAttempts,
  asymmetryPercent,
  bestAndWorst,
  computeDerived,
  groupStats,
  zAgainstGroup,
  type Direction,
} from '../src';

type Player = {
  name: string;
  attempts: Record<string, number[]>;
  values: Record<string, number>;
  excel: Record<string, number | null>;
};
const players = fixture.players as Player[];
const group = fixture.group as Record<
  string,
  {
    n: number;
    mean: number | null;
    sd: number | null;
    max: number | null;
    min: number | null;
    best: string;
    worst: string;
  }
>;

const SKINFOLDS = [
  'skinfold_triceps',
  'skinfold_subscapular',
  'skinfold_iliac_crest',
  'skinfold_abdominal',
  'skinfold_front_thigh',
  'skinfold_medial_calf',
];
const SPRINTS = ['sprint_5m', 'sprint_10m', 'sprint_20m', 'sprint_30m', 'cod_505', 'dribbling'];

/** The platform's result for one player: result rules, then the formula catalogue (♂ team). */
function engine(p: Player): Record<string, number | null> {
  const values: Record<string, number> = { ...p.values };
  for (const s of SKINFOLDS)
    if (p.attempts[s])
      values[s] = aggregateAttempts(p.attempts[s], {
        aggregation: 'median',
        betterDirection: 'lower',
      }).value;
  for (const s of SPRINTS)
    if (p.attempts[s])
      values[s] = aggregateAttempts(p.attempts[s], {
        aggregation: 'min',
        betterDirection: 'lower',
      }).value;
  const out: Record<string, number | null> = { ...values };
  for (const d of computeDerived(values, undefined, { sex: 'male' })) out[d.formula.slug] = d.value;
  return out;
}
const results = players.map(engine);
const col = (k: string) => results.map((r) => r[k] ?? null);
/** The workbook's columns, by the fixture's output name (inputs come from `values`). */
const excelCol = (k: string) => players.map((p) => p.excel[k] ?? p.values[k] ?? null);

const close = (a: number | null | undefined, b: number | null | undefined, digits: number) => {
  if (b == null) expect(a ?? null).toBeNull();
  else expect(a).toBeCloseTo(b, digits);
};

describe('club workbook golden test (synthetic players)', () => {
  it('uses the workbook constants (Faulkner 0,153 · 5,783; Yuhasz 0,1051 · 2,585)', () => {
    expect(fixture.constants).toEqual({
      faulkner: { a: 0.153, b: 5.783 },
      yuhasz: { a: 0.1051, b: 2.585 },
    });
  });

  it('per player: medians, minimums and formulas match the workbook, gaps stay gaps', () => {
    const DIGITS: Record<string, number> = {
      bmi: 2,
      sum_6_skinfolds: 6,
      sum_4_skinfolds: 6,
      body_fat_faulkner: 2,
      body_fat_yuhasz: 2,
      fat_mass: 2,
      fat_free_mass: 2,
    };
    players.forEach((p, i) => {
      for (const k of [...SKINFOLDS, ...SPRINTS, ...Object.keys(DIGITS)])
        close(results[i]![k], p.excel[k], DIGITS[k] ?? 9);
    });
    // The gaps on purpose: Σ6 needs all six skinfolds; one side only gives no asymmetry.
    expect(results[6]!.sum_6_skinfolds ?? null).toBeNull();
    expect(results[6]!.sum_4_skinfolds).not.toBeNull();
    expect(results[17]!.fat_mass ?? null).toBeNull();
  });

  it('relative MTP: the formula agrees with the value the club typed (rounded to 0,01)', () => {
    players.forEach((p, i) => {
      const typed = p.values.imtp_relative_input;
      if (typed == null) expect(results[i]!.imtp_relative ?? null).toBeNull();
      else expect(Math.abs(results[i]!.imtp_relative! - typed)).toBeLessThanOrEqual(0.006);
    });
  });

  it('CMJ asymmetry |D − I| / max × 100 matches (our value is rounded to 0,1)', () => {
    players.forEach((p) => {
      const r = p.values['single_leg_cmj_height.right'];
      const l = p.values['single_leg_cmj_height.left'];
      const a = r != null && l != null ? asymmetryPercent(l, r, 'higher') : null;
      if (p.excel.cmj_asymmetry == null) expect(a).toBeNull();
      else expect(Math.abs(a!.value - p.excel.cmj_asymmetry)).toBeLessThanOrEqual(0.05 + 1e-9);
    });
  });

  it('Z against the team (sample SD, sign corrected) matches the six Z columns', () => {
    const Z: [string, string, Direction][] = [
      ['z.sum_6_skinfolds', 'sum_6_skinfolds', 'lower'],
      ['z.sprint_5m', 'sprint_5m', 'lower'],
      ['z.sprint_30m', 'sprint_30m', 'lower'],
      ['z.cmj_height', 'cmj_height', 'higher'],
      ['z.ift_30_15', 'ift_30_15', 'higher'],
      ['z.rsi', 'rsi', 'higher'],
    ];
    for (const [z, k, dir] of Z) {
      const ours = zAgainstGroup(col(k), dir);
      players.forEach((p, i) => close(ours[i], p.excel[z], 9));
    }
    const mtp = zAgainstGroup(excelCol('imtp_relative_input'), 'higher');
    players.forEach((p, i) => close(mtp[i], p.excel['z.imtp_relative'], 9));
  });

  it('Informe Grupal: N, mean, SD, max, min, best and worst for every row', () => {
    const ROWS: [string, string, Direction][] = [
      ['Altura (cm)', 'height', 'target_range'],
      ['Peso (kg)', 'body_mass', 'target_range'],
      ['IMC (kg/m²)', 'bmi', 'target_range'],
      ['Pliegue tríceps (mm)  ↓', 'skinfold_triceps', 'lower'],
      ['Pliegue subescapular (mm)  ↓', 'skinfold_subscapular', 'lower'],
      ['Pliegue cresta ilíaca (mm)  ↓', 'skinfold_iliac_crest', 'lower'],
      ['Pliegue abdominal (mm)  ↓', 'skinfold_abdominal', 'lower'],
      ['Pliegue muslo anterior (mm)  ↓', 'skinfold_front_thigh', 'lower'],
      ['Pliegue gemelo medial (mm)  ↓', 'skinfold_medial_calf', 'lower'],
      ['Σ6 pliegues (mm)  ↓', 'sum_6_skinfolds', 'lower'],
      ['Σ4 pliegues (mm)  ↓', 'sum_4_skinfolds', 'lower'],
      ['% Grasa Faulkner (%)  ↓', 'body_fat_faulkner', 'lower'],
      ['% Grasa Yuhasz (%)  ↓', 'body_fat_yuhasz', 'lower'],
      ['Masa grasa (kg)  ↓', 'fat_mass', 'lower'],
      ['Masa libre de grasa (kg)  ↑', 'fat_free_mass', 'higher'],
      ['Aceleración 5 m (s)  ↓', 'sprint_5m', 'lower'],
      ['Sprint 10 m (s)  ↓', 'sprint_10m', 'lower'],
      ['Sprint 20 m (s)  ↓', 'sprint_20m', 'lower'],
      ['Sprint 30 m (s)  ↓', 'sprint_30m', 'lower'],
      ['Cambio de dirección (s)  ↓', 'cod_505', 'lower'],
      ['Dribbling (s)  ↓', 'dribbling', 'lower'],
      ['30-15 IFT · VIFT (km/h)  ↑', 'ift_30_15', 'higher'],
      ['Mid thigh pull (N)  ↑', 'imtp_peak_force', 'higher'],
      ['CMJ (cm)  ↑', 'cmj_height', 'higher'],
      ['CMJ pierna derecha (cm)  ↑', 'single_leg_cmj_height.right', 'higher'],
      ['CMJ pierna izquierda (cm)  ↑', 'single_leg_cmj_height.left', 'higher'],
      ['RSI best 5  ↑', 'rsi', 'higher'],
      ['DSI best 5  ↑', 'dsi', 'higher'],
    ];
    expect(ROWS.length + 2).toBe(Object.keys(group).length); // + MTP rel, asymmetry (below)
    for (const [label, k, dir] of ROWS) {
      const g = group[label]!;
      const xs = col(k);
      const s = groupStats(xs);
      expect(s.n, label).toBe(g.n);
      // Formula results are rounded to 0,001 by the platform: compare at that precision.
      const d = [
        'bmi',
        'body_fat_faulkner',
        'body_fat_yuhasz',
        'fat_mass',
        'fat_free_mass',
      ].includes(k)
        ? 2
        : 9;
      close(s.mean, g.mean, d);
      close(s.sd, g.sd, d);
      close(s.max, g.max, d);
      close(s.min, g.min, d);
      // Best / worst by direction; descriptive rows name the max and min, as the workbook.
      const bw =
        dir === 'target_range'
          ? { best: xs.indexOf(s.max), worst: xs.indexOf(s.min) }
          : bestAndWorst(xs, dir)!;
      expect(g.best.startsWith(players[bw.best]!.name), label).toBe(true);
      expect(g.worst.startsWith(players[bw.worst]!.name), label).toBe(true);
    }
    const mtp = groupStats(excelCol('imtp_relative_input'));
    close(mtp.mean, group['MTP relativo (N/kg)  ↑']!.mean, 9);
    close(mtp.sd, group['MTP relativo (N/kg)  ↑']!.sd, 9);
    expect(group['Asimetría CMJ (%)  ↓']!.n).toBe(19);
  });
});
