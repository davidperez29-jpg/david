import { describe, expect, it } from 'vitest';
import { FORMULA_REGISTRY, isRegisteredFormula, registryIssues } from './formulas';
import { measurementIssues, provenanceIssues, type Provenance } from './measurement';

const base: Provenance = {
  origin: 'direct',
  method: 'Cronometraje con fotocélulas',
  instrument: 'Fotocélulas (demo)',
  measuredAt: '2026-11-02T10:00:00Z',
  recordedAt: '2026-11-02T10:05:00Z',
  recordedBy: 'trainer',
};

describe('procedencia de los datos', () => {
  it('acepta una medición directa completa', () => {
    expect(provenanceIssues(base)).toEqual([]);
  });

  it('exige fórmula registrada a los valores calculados o estimados', () => {
    expect(provenanceIssues({ ...base, origin: 'estimated' })).toContain(
      'Un valor calculado o estimado debe indicar la fórmula y su versión.',
    );
    const unknown = {
      ...base,
      origin: 'calculated' as const,
      formula: { id: 'x', version: '9.9.9' },
    };
    expect(provenanceIssues(unknown, isRegisteredFormula)).toContain(
      'La fórmula x v9.9.9 no está registrada.',
    );
    const known = {
      ...base,
      origin: 'calculated' as const,
      formula: { id: 'training.volume-load', version: '1.0.0' },
    };
    expect(provenanceIssues(known, isRegisteredFormula)).toEqual([]);
  });

  it('no permite atribuir una fórmula a una medición directa', () => {
    const issues = provenanceIssues({
      ...base,
      formula: { id: 'training.volume-load', version: '1.0.0' },
    });
    expect(issues).toContain(
      'Solo los valores calculados o estimados pueden hacer referencia a una fórmula.',
    );
  });

  it('exige la procedencia de los datos importados', () => {
    expect(provenanceIssues({ ...base, origin: 'imported' })).toContain(
      'Un dato importado debe indicar de dónde procede.',
    );
  });

  it('detecta fechas incoherentes y valores no numéricos', () => {
    const issues = measurementIssues({
      value: Number.NaN,
      unit: 's',
      provenance: { ...base, measuredAt: '2026-11-03T10:00:00Z' },
    });
    expect(issues).toEqual([
      'El valor no es un número válido.',
      'La medición no puede ser posterior a su registro.',
    ]);
  });
});

describe('registro de fórmulas', () => {
  it('es íntegro: sin duplicados, versionado y con limitaciones documentadas', () => {
    expect(registryIssues(FORMULA_REGISTRY)).toEqual([]);
  });

  it('rechaza fórmulas científicas sin referencias verificadas', () => {
    const issues = registryIssues([
      { ...FORMULA_REGISTRY[0]!, kind: 'scientific_formula', references: [] },
    ]);
    expect(issues[0]).toMatch(/sin referencias verificadas/);
  });

  it('rechaza duplicados y versiones mal formadas', () => {
    const formula = FORMULA_REGISTRY[0]!;
    expect(registryIssues([formula, formula])).toContain(
      `Fórmula duplicada: ${formula.id}@${formula.version}.`,
    );
    expect(registryIssues([{ ...formula, version: 'v1' }])[0]).toMatch(/Versión no válida/);
  });
});
