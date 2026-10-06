import { describe, expect, it } from 'vitest';
import {
  buildClientReport,
  clientReportView,
  VERDICT_LABELS,
  parseCsv,
  reportRows,
  rowsToRecords,
  safeText,
  stableStringify,
  toCsv,
} from '../src';
import { input } from './fixtures/report-input';

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

describe("client's version of a shared report (plain language)", () => {
  it('seven plain sections from the same snapshot; no technical tables or jargon', () => {
    const r = clientReportView(
      input({
        series: [
          {
            ...input().series[0]!,
            change: {
              from: 34.2,
              to: 37.1,
              delta: 2.9,
              label: VERDICT_LABELS.probable_improvement,
              mdc95: 2.4,
            },
          },
        ],
      }),
    );
    expect(r.title).toBe('Tu informe, Iker');
    expect(r.sections.map((s) => s.key)).toEqual([
      'resumen',
      'objetivos',
      'constancia',
      'progreso',
      'plan',
      'mensaje',
      'proxima',
    ]);
    const text = JSON.stringify(r);
    expect(text).toMatch(/has hecho 6 de 6 sesiones/);
    expect(text).toMatch(
      /CMJ: de 34,2 cm \(16\/06\/2026\) a 35,93 cm \(22\/09\/2026\)\. Has mejorado/,
    );
    expect(text).toMatch(/Vas por la semana 3 de 12 \(base\)/);
    expect(text).toMatch(/ajustado el plan una vez/);
    expect(text).toMatch(/Mantener el trabajo de fuerza/);
    expect(text).toMatch(/Hacia el 02\/11\/2026/);
    expect(text).not.toMatch(/MDC|UA|Fuerza relativa baja|Seitz|desarrollar|Carga interna/);
    expect(r.sections.flatMap((s) => s.blocks).some((b) => b.kind === 'table')).toBe(false);
    // Deterministic, like the trainer's report.
    expect(clientReportView(input())).toEqual(clientReportView(input()));
  });

  it('safety and missing data: referral, non-comparable series, nothing planned, no message', () => {
    const r = clientReportView(
      input({
        screening: 'refer',
        series: [{ ...input().series[0]!, change: null, note: 'Métodos distintos.' }],
        adherence: {
          last4: { planned: 0, done: 0, percent: null },
          last12: { planned: 0, done: 0, percent: null },
          weeks: [],
        },
        plan: null,
        trainerNotes: null,
        goals: [],
        nextReassessment: { date: null, basis: 'Sin evaluaciones' },
      }),
    );
    const text = JSON.stringify(r);
    expect(text).toMatch(/requiere valoración por profesional sanitario/);
    expect(text).toMatch(/no son comparables/);
    expect(text).toMatch(/No había sesiones planificadas/);
    expect(text).toMatch(/no tienes un plan activo/);
    expect(text).toMatch(/Sin mensaje/);
    expect(text).toMatch(/Tu entrenador te dirá la fecha/);
    expect(
      clientReportView(input({ series: [], results: [] })).sections[3]!.blocks[0],
    ).toMatchObject({
      text: 'Aún no hay evaluaciones en este periodo.',
    });
  });
});
