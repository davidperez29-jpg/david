import { DERIVED_FORMULAS, MAXIMAL_TESTS } from '@tp/domain';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAssessmentFiles, POPULATIONS } from '../src';
import { SEED_DIR } from '../src/testing';

const data = loadAssessmentFiles(join(SEED_DIR, 'assessment'));
const tests = new Set(data.tests.map((t) => t.slug));
const sources = new Set(data.sources.map((s) => s.key));
const populations = new Set(POPULATIONS.map((p) => p.slug));

describe('assessment seed files', () => {
  it('has unique tests with valid aggregation and PubMed-identified sources', () => {
    expect(tests.size).toBe(data.tests.length);
    expect(tests.size).toBeGreaterThan(35);
    for (const t of data.tests) {
      if (t.aggregation === 'mean_of_best_n') expect(t.aggregationN, t.slug).toBeGreaterThan(0);
      for (const s of t.sources ?? []) expect(sources.has(s), `${t.slug} → ${s}`).toBe(true);
    }
    for (const s of data.sources) expect(s.pmid, s.key).toMatch(/^\d{1,9}$/);
  });

  it('reliability and reference rows cite sources, known tests and populations, with a quote', () => {
    for (const r of [...data.reliability, ...data.references]) {
      expect(tests.has(r.test), r.test).toBe(true);
      expect(sources.has(r.source), r.source).toBe(true);
      if (r.population) expect(populations.has(r.population), r.population).toBe(true);
      expect(r.quote?.length ?? 0, `${r.test} quote`).toBeGreaterThan(10);
    }
    for (const r of data.references)
      expect(r.population, 'references need a population').toBeTruthy();
    for (const r of data.reliability) if (r.icc != null) expect(r.icc).toBeLessThanOrEqual(1);
  });

  it('batteries, derived formulas and safety rules reference existing tests', () => {
    for (const b of data.batteries)
      for (const t of b.tests) expect(tests.has(t.test), `${b.slug} → ${t.test}`).toBe(true);
    for (const f of DERIVED_FORMULAS)
      for (const i of f.inputs) expect(tests.has(i), `${f.id} → ${i}`).toBe(true);
    for (const m of MAXIMAL_TESTS) expect(tests.has(m), `maximal ${m}`).toBe(true);
  });
});
