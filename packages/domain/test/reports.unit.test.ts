import { describe, expect, it } from 'vitest';
import {
  buildClientReport,
  parseCsv,
  reportRows,
  rowsToRecords,
  safeText,
  stableStringify,
  toCsv,
  type ReportInput,
} from '../src';

describe('CSV (§14: CSV injection)', () => {
  it('neutralizes formulas in text cells, keeps numbers, quotes and uses decimal comma', () => {
    const csv = toCsv([
      ['Nombre', 'Nota', 'Carga'],
      ['=HYPERLINK("http://x")', '+34 600', 82.5],
      ['@SUM(A1)', 'línea 1\nlínea 2', -2.5],
      ['Ana; Pérez', null, true],
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[1]![0]).toBe(`'=HYPERLINK("http://x")`);
    expect(rows[1]![1]).toBe(`'+34 600`);
    expect(rows[1]![2]).toBe('82,5');
    // Negative numbers are numbers, not formulas.
    expect(rows[2]![2]).toBe('-2,5');
    expect(rows[2]![0]).toBe(`'@SUM(A1)`);
    expect(rows[2]![1]).toBe('línea 1\nlínea 2');
    expect(rows[3]).toEqual(['Ana; Pérez', '', 'sí']);
    expect(safeText('-1+1')).toBe("'-1+1");
  });

  it('parses comma or semicolon files, BOM, quoted separators and blank lines', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,"x, y"\r\n\r\n2,z\n')).toEqual([
      ['a', 'b'],
      ['1', 'x, y'],
      ['2', 'z'],
    ]);
    const { headers, records } = rowsToRecords(
      parseCsv('Nombre;Fecha de nacimiento\nAna;1990-01-02'),
    );
    expect(headers).toEqual(['nombre', 'fecha_de_nacimiento']);
    expect(records).toEqual([{ nombre: 'Ana', fecha_de_nacimiento: '1990-01-02' }]);
  });
});

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  generatedAt: '2026-10-04T10:00:00.000Z',
  period: { from: '2026-07-01', to: '2026-10-04' },
  organization: 'Centro Demo',
  trainers: ['Pablo Ibarra'],
  client: {
    name: 'Iker Arrieta',
    age: 22,
    sex: 'Hombre',
    modality: 'Híbrido',
    experience: 'Intermedio',
    sessionsPerWeek: 3,
    minutesPerSession: 60,
    since: '2026-04-01',
  },
  goals: [{ name: 'Rendimiento en deportes de equipo', primary: true, sport: 'Fútbol' }],
  screening: 'clear',
  assessments: [{ date: '2026-09-22', context: 'Reevaluación', tests: ['CMJ', 'Sprint 10 m'] }],
  results: [
    {
      test: 'CMJ',
      unit: 'cm',
      value: 35.93,
      date: '2026-09-22',
      reference: { label: 'Medio', source: 'futbolistas sub-23 (ref. verificada)' },
    },
  ],
  series: [
    {
      test: 'CMJ',
      unit: 'cm',
      points: [
        { date: '2026-06-16', value: 34.2 },
        { date: '2026-09-22', value: 35.93 },
      ],
      change: { from: 34.2, to: 35.93, delta: 1.73, label: 'Cambio posible', mdc95: 2.4 },
      note: null,
    },
  ],
  traits: [{ label: 'Fuerza relativa baja', value: true, basis: 'umbral del centro' }],
  needs: [{ label: 'Fuerza máxima', direction: 'desarrollar' }],
  plan: {
    name: 'Deporte de equipo · 3 días',
    status: 'Activo',
    startDate: '2026-09-21',
    endDate: '2026-12-13',
    weeks: 12,
    sessionsPerWeek: 3,
    currentWeek: 3,
    phase: 'Base',
    revisions: 2,
  },
  adjustments: [
    { title: 'Sentadilla: subir de 80 kg a 82,5 kg', status: 'Aceptada', date: '2026-10-03' },
  ],
  adherence: {
    last4: { planned: 6, done: 6, percent: 100 },
    last12: { planned: 6, done: 6, percent: 100 },
    weeks: [{ weekStart: '2026-09-21', planned: 3, done: 3, load: 1080 }],
  },
  feedback: {
    sessionsWithRpe: 6,
    avgRpe: 6.3,
    avgWellness: null,
    painReports: null,
    comments: [{ date: '2026-09-30', text: 'Bien, algo cargado de piernas.' }],
  },
  recommendations: [
    {
      text: 'P1 · Fuerza máxima: 2 sesiones/semana',
      status: 'Aceptada',
      evidence: [{ citation: 'Seitz LB et al. 2014', doi: '10.1007/s40279-014-0227-1' }],
    },
  ],
  trainerNotes: 'Mantener el trabajo de fuerza en semanas de dos partidos.',
  nextReassessment: { date: '2026-11-02', basis: 'cada 6 semanas desde la última evaluación' },
  ...over,
});

describe('client report (§34: 11 sections)', () => {
  it('has the 11 sections in order with interpretation against measurement error', () => {
    const r = buildClientReport(input());
    expect(r.sections.map((s) => s.title)).toEqual([
      'Datos',
      'Objetivos',
      'Evaluación',
      'Resultados',
      'Evolución',
      'Interpretación',
      'Planificación',
      'Adherencia',
      'Feedback',
      'Recomendaciones',
      'Próxima reevaluación',
    ]);
    const interp = JSON.stringify(r.sections[5]);
    expect(interp).toMatch(
      /CMJ: cambio posible \(\+1,73 cm; el error de medida permite detectar cambios desde 2,4 cm\)/,
    );
    expect(interp).toMatch(/No es un diagnóstico/);
    expect(JSON.stringify(r.sections[4])).toMatch(/"kind":"chart"/);
    expect(JSON.stringify(r.sections[9])).toMatch(/https:\/\/doi.org\/10.1007\/s40279-014-0227-1/);
    expect(JSON.stringify(r.sections[10])).toMatch(/02\/11\/2026 \(cada 6 semanas/);
  });

  it('never shows pain without consent and warns on a positive screening (no diagnosis)', () => {
    const noConsent = buildClientReport(input());
    expect(JSON.stringify(noConsent)).not.toMatch(/molestias/i);
    const withPain = buildClientReport(
      input({ screening: 'refer', feedback: { ...input().feedback, painReports: 2 } }),
    );
    expect(JSON.stringify(withPain.sections[8])).toMatch(/Sesiones con molestias declaradas: 2/);
    expect(withPain.sections[2]!.blocks[0]).toMatchObject({
      tone: 'warn',
      text: expect.stringMatching(/requiere valoración por profesional sanitario/),
    });
  });

  it('empty data gives explicit messages, not invented numbers', () => {
    const r = buildClientReport(
      input({
        results: [],
        series: [],
        assessments: [],
        plan: null,
        recommendations: [],
        trainerNotes: null,
        traits: [],
        needs: [],
      }),
    );
    const all = JSON.stringify(r);
    expect(all).toMatch(/Sin resultados registrados/);
    expect(all).toMatch(/Se necesitan al menos dos mediciones/);
    expect(all).toMatch(/Sin plan activo/);
    expect(all).toMatch(/Sin recomendaciones aceptadas/);
  });

  it('is deterministic and flattens to rows for CSV/XLSX', () => {
    expect(stableStringify(buildClientReport(input()))).toBe(
      stableStringify(buildClientReport(input())),
    );
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    const rows = reportRows(buildClientReport(input()));
    expect(rows[0]).toEqual(['Informe de Iker Arrieta']);
    expect(rows.some((r) => r[0] === '11. Próxima reevaluación')).toBe(true);
  });
});
