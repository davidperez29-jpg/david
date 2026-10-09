import { describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS, importRowSchemas } from '../src';

describe('import row validation (Spanish spreadsheets → canonical values)', () => {
  it('clients: dates, enums in Spanish, email normalization and per-field errors', () => {
    const ok = importRowSchemas.clients.safeParse({
      nombre: 'Ana',
      apellidos: 'García',
      fecha_nacimiento: '4/3/1995',
      sexo: 'Mujer',
      email: 'Ana@Example.com',
      modalidad: 'Híbrido',
      experiencia: 'principiante',
      sesiones_semana: '3',
      objetivo: '',
    });
    expect(ok.success && ok.data).toMatchObject({
      fecha_nacimiento: '1995-03-04',
      sexo: 'female',
      email: 'ana@example.com',
      modalidad: 'hybrid',
      experiencia: 'beginner',
      sesiones_semana: 3,
      objetivo: undefined,
    });
    const bad = importRowSchemas.clients.safeParse({
      nombre: '',
      apellidos: 'X',
      fecha_nacimiento: '31/02/1995',
      sexo: 'quizá',
      email: 'no-es-email',
    });
    expect(bad.success).toBe(false);
    const fields = bad.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['nombre', 'fecha_nacimiento', 'sexo', 'email']));
  });

  it('assessments: attempts with decimal comma; references: DOI and design', () => {
    const a = importRowSchemas.assessments.parse({
      email_cliente: 'ana@example.com',
      fecha: '2026-09-01',
      test: 'CMJ',
      valor: '30,1|31,4',
      lado: 'izquierdo',
    });
    expect(a).toMatchObject({ valor: [30.1, 31.4], lado: 'left' });
    expect(
      importRowSchemas.assessments.safeParse({
        email_cliente: 'a@b.es',
        fecha: 'ayer',
        test: 'CMJ',
        valor: 'x',
      }).success,
    ).toBe(false);
    const r = importRowSchemas.references.parse({
      titulo: 'Resistance training review',
      autores: 'Smith J|Pérez L',
      doi: '10.1007/s40279-021-01492-5',
      diseno: 'Revisión sistemática',
    });
    expect(r).toMatchObject({ autores: ['Smith J', 'Pérez L'], diseno: 'systematic_review' });
    expect(
      importRowSchemas.references.safeParse({
        titulo: 'Título largo',
        autores: '',
        doi: 'doi:10.1/x',
      }).success,
    ).toBe(false);
  });

  it('reference values: percentile lists parse; malformed or oversized ones are refused fast', () => {
    const base = {
      test: 'handgrip_strength',
      variable: 'Prensión',
      unidad: 'kg',
      poblacion: 'adults_general',
      estadistico: 'percentiles',
      fuente_doi: '10.9999/prueba',
    };
    const parse = (percentiles: string) =>
      importRowSchemas.reference_values.safeParse({ ...base, percentiles });
    const ok = parse(' P10=21 | p 50 : 29,5 |P90=37|');
    expect(ok.success && ok.data.percentiles).toEqual({ p10: 21, p50: 29.5, p90: 37 });
    for (const bad of ['P10=21', 'P10=1.234,5|P50=2', 'P10=21|P50=', 'P100=1|P50=2'])
      expect(parse(bad).success).toBe(false);
    // Long blanks used to backtrack for seconds (40 000 spaces ≈ 1.6 s): now bounded and linear.
    const evil = [
      '|' + ' '.repeat(40_000) + 'x',
      '|' + ' '.repeat(450) + 'x',
      'P10=' + ' '.repeat(450) + 'x|P50=1',
      'p' + ' '.repeat(450) + '1=x',
    ];
    for (const e of evil) {
      const t0 = performance.now();
      expect(parse(e).success).toBe(false);
      expect(performance.now() - t0).toBeLessThan(200);
    }
  });

  it('every entity documents its columns with an example', () => {
    for (const cols of Object.values(IMPORT_COLUMNS))
      expect(cols.every((c) => c.header && c.key && c.example !== undefined)).toBe(true);
  });
});
