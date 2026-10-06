import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildReport,
  languageIssues,
  REPORT_KINDS,
  reportLanguageIssues,
  reportRows,
  RTP_MAX_STATUS,
  stableStringify,
  strengthsAndImprovements,
  type ComparisonData,
  type ComparativeSnapshot,
  type PerformanceSnapshot,
  type RtpSnapshot,
} from '../src';
import { input } from './fixtures/report-input';

const comparison: ComparisonData = {
  a: { date: '2026-06-16' },
  b: { date: '2026-09-22' },
  scale: { key: 'z_group', label: 'Z frente al grupo', neutral: 0, range: [-3, 3] },
  basisLabel: 'Juvenil A, 2026-09-22',
  neutralLabel: 'Media del grupo',
  dimensions: [
    { name: 'Potencia', scoreA: 0.2, scoreB: 1.4 },
    { name: 'Aceleración', scoreA: -0.5, scoreB: -1.2 },
    { name: 'Composición corporal', scoreA: null, scoreB: 0.3 },
    { name: 'Resistencia', scoreA: null, scoreB: null },
  ],
  items: [
    {
      name: 'CMJ',
      unit: 'cm',
      direction: 'higher',
      rawA: 33,
      rawB: 36,
      scoreA: 0.2,
      scoreB: 1.4,
      basis: 'Juvenil A',
      change: { delta: 3, deltaPercent: 9.1, label: 'Mejora probable', mdc95: 2.1 },
    },
    {
      name: 'Sprint 5 m',
      unit: 's',
      direction: 'lower',
      rawA: 1.04,
      rawB: 1.07,
      scoreA: -0.5,
      scoreB: -1.2,
      basis: 'Juvenil A',
      change: { delta: 0.03, deltaPercent: 2.9, label: 'Dentro del error de medida', mdc95: null },
    },
  ],
  notes: [],
};
const period = { input: input(), comparison, goals: [{ name: 'Fuerza', status: 'achieved' }] };
const comparative: ComparativeSnapshot = {
  generatedAt: '2026-10-04T10:00:00.000Z',
  organization: 'Centro Demo',
  client: { name: 'Iker Arrieta' },
  reference: 'group',
  comparison,
  series: [
    {
      test: 'CMJ',
      unit: 'cm',
      points: [
        { date: '2026-06-16', value: 33 },
        { date: '2026-09-22', value: 36 },
      ],
    },
  ],
  trainerNotes: null,
};
const performance: PerformanceSnapshot = {
  generatedAt: '2026-10-04T10:00:00.000Z',
  organization: 'Centro Demo',
  group: {
    name: 'Juvenil A',
    date: '2026-09-22',
    members: ['Jugador 1', 'Jugador 2', 'Jugador 3'],
    missing: [],
  },
  rows: [
    {
      name: 'CMJ',
      unit: 'cm',
      direction: 'higher',
      n: 3,
      mean: 34,
      sd: 2,
      max: 36,
      min: 32,
      best: 0,
      worst: 2,
      reference: null,
      z: [1, 0, -1],
      values: [36, 34, 32],
      flags: [null, null, null],
    },
  ],
  players: [
    {
      name: 'Jugador 1',
      dimensions: [
        { name: 'Potencia', score: 1 },
        { name: 'Aceleración', score: 0.4 },
        { name: 'Composición corporal', score: -1.3 },
      ],
      items: [{ name: 'CMJ', score: 1.2 }],
    },
  ],
  trainerNotes: null,
};
const rtp: RtpSnapshot = {
  generatedAt: '2026-10-04T10:00:00.000Z',
  organization: 'Centro Demo',
  client: { name: 'Iker Arrieta' },
  consent: true,
  injury: {
    type: 'Lesión',
    region: 'Isquiosurales',
    declaredOn: '2026-08-01',
    status: 'Activa',
    cleared: false,
  },
  pain: [
    { date: '2026-08-05', intensity: 6, region: 'Isquiosurales' },
    { date: '2026-09-01', intensity: 2, region: 'Isquiosurales' },
  ],
  comparison,
  trainerNotes: null,
};
const SNAPSHOTS: Record<string, unknown> = {
  client_report: input(),
  client: input(),
  initial: period,
  follow_up: period,
  final: period,
  comparative,
  performance,
  rtp,
};

describe('report language (§16: frases prohibidas)', () => {
  it('rejects «previene lesiones» without incidence evidence, allows it with it', () => {
    for (const t of [
      'Este programa previene lesiones de isquiosurales.',
      'El trabajo excéntrico evita las lesiones.',
      'Reduce el riesgo de lesión.',
    ]) {
      expect(
        languageIssues(t).map((i) => i.rule),
        t,
      ).toContain('prevention');
      expect(languageIssues(t, { incidenceEvidence: true })).toEqual([]);
    }
  });
  it('never «apto» or «alta deportiva»; no diagnoses or promises', () => {
    expect(languageIssues('Ya está apto para competir').map((i) => i.rule)).toEqual(['aptitude']);
    expect(languageIssues('Se da el alta deportiva').map((i) => i.rule)).toEqual(['aptitude']);
    expect(languageIssues('Padece una tendinopatía').map((i) => i.rule)).toEqual(['diagnosis']);
    expect(languageIssues('Garantiza resultados').map((i) => i.rule)).toEqual(['diagnosis']);
    // Not false positives.
    for (const ok of [
      'No es un diagnóstico.',
      'Plan adaptado a su material.',
      `Estado: ${RTP_MAX_STATUS}.`,
      'Mejora la fuerza excéntrica de isquiosurales, un factor de riesgo.',
      'Procura dormir bien.',
    ])
      expect(languageIssues(ok), ok).toEqual([]);
  });
});

describe('report kinds', () => {
  it('there are 8 kinds and every one builds from its snapshot, deterministically', () => {
    expect(Object.keys(REPORT_KINDS)).toHaveLength(8);
    for (const [type, snap] of Object.entries(SNAPSHOTS)) {
      const a = buildReport(type, snap);
      expect(stableStringify(a), type).toBe(
        stableStringify(buildReport(type, structuredClone(snap))),
      );
      expect(a.sections.length, type).toBeGreaterThan(2);
      expect(reportRows(a).length, type).toBeGreaterThan(5);
    }
  });

  it('the engine never writes forbidden phrases (no incidence evidence assumed)', () => {
    for (const [type, snap] of Object.entries(SNAPSHOTS))
      expect(reportLanguageIssues(buildReport(type, snap)), type).toEqual([]);
  });

  it('comparative and final carry a radar (vector in the PDF) and its table rows', () => {
    const r = buildReport('comparative', comparative);
    const radar = r.sections.flatMap((s) => s.blocks).find((b) => b.kind === 'radar')!;
    expect(radar).toMatchObject({
      kind: 'radar',
      axes: ['Potencia', 'Aceleración', 'Composición corporal'],
    });
    expect(
      reportRows(r).some((row) => row[1] === 'Potencia' && row[2] === 0.2 && row[3] === 1.4),
    ).toBe(true);
    // «Sin referencia»: no scale, no radar, real values only.
    const none = buildReport('comparative', {
      ...comparative,
      reference: 'none',
      comparison: { ...comparison, scale: null },
    });
    expect(none.sections.flatMap((s) => s.blocks).some((b) => b.kind === 'radar')).toBe(false);
    expect(
      buildReport('final', period)
        .sections.flatMap((s) => s.blocks)
        .some((b) => b.kind === 'radar'),
    ).toBe(true);
  });

  it('initial: strengths and points to improve come from the band of each score', () => {
    const text = reportRows(buildReport('initial', period)).flat().join('\n');
    expect(text).toMatch(/CMJ: destacado \(Z \+1,4/);
    expect(text).toMatch(/Sprint 5 m: a mejorar \(Z -1,2/);
  });

  it('property: a score above +1 is always a strength and never a point to improve', () => {
    fc.assert(
      fc.property(fc.double({ min: -5, max: 5, noNaN: true }), (z) => {
        const r = strengthsAndImprovements([{ name: 'X', score: z }], 'z_group', 'el grupo');
        expect(r.strengths.length).toBe(z > 1 ? 1 : 0);
        expect(r.improve.length).toBe(z < -1 ? 1 : 0);
      }),
    );
  });

  it('RTP: never «apto»; without consent no injury or symptoms; the maximum status is named', () => {
    const r = buildReport('rtp', rtp);
    const all = reportRows(r).flat().join('\n');
    expect(all).toContain(RTP_MAX_STATUS);
    expect(all).not.toMatch(/\bapt[oa]\b/i);
    const noConsent = reportRows(buildReport('rtp', { ...rtp, consent: false }))
      .flat()
      .join('\n');
    expect(noConsent).toContain('Sin consentimiento');
    expect(noConsent).not.toContain('Isquiosurales');
  });

  it('performance: group summary, Z with bands and a radar per selected person', () => {
    const r = buildReport('performance', performance);
    expect(r.sections.map((s) => s.title)).toEqual([
      'Grupo',
      'Resumen del grupo',
      'Z frente al grupo',
      'Jugador 1',
      'Notas',
    ]);
    const text = reportRows(r).flat().join('\n');
    expect(text).toContain('Z +1 En la media'); // destacado is strictly above +1
    expect(text).toContain('Z -1 En la media');
    expect(text).toContain('Grupo pequeño (3)');
    expect(r.sections[3]!.blocks[0]!.kind).toBe('radar');
  });
});
