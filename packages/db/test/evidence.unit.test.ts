import { gradeFinding } from '@tp/domain';
import { describe, expect, it } from 'vitest';
import { loadEvidenceFiles, OUTCOMES, POPULATIONS, PRESCRIPTION_VARIABLES } from '../src';
import { EVIDENCE_DIR } from '../src/testing';

const data = loadEvidenceFiles(EVIDENCE_DIR);
const outcomes = new Set(OUTCOMES.map(([slug]) => slug));
const populations = new Set(POPULATIONS.map((p) => p.slug));
const variables = new Set(PRESCRIPTION_VARIABLES.map((v) => v.key));
const CAUSAL =
  /\b(previene|prevenir|garantiza|cura|elimina el riesgo|reduce a la mitad|siempre|nunca falla)\b/i;

describe('evidence seed files', () => {
  it('has well-formed, PubMed-identified sources', () => {
    const sources = data.topics.flatMap((t) => t.sources);
    expect(sources.length).toBeGreaterThan(100);
    for (const s of sources) {
      expect(s.pmid, s.key).toMatch(/^\d{1,9}$/);
      if (s.doi) expect(s.doi, s.key).toMatch(/^10\.\d{4,9}\/\S+$/);
      expect(s.title.length, s.key).toBeGreaterThan(5);
    }
  });

  it('findings use catalogued outcomes/populations, cite their topic sources and carry a quote', () => {
    for (const t of data.topics) {
      const keys = new Set(t.sources.map((s) => s.key));
      for (const f of t.findings) {
        expect(keys.has(f.source), `${t.topic}:${f.key}`).toBe(true);
        expect(outcomes.has(f.outcome), f.outcome).toBe(true);
        expect(populations.has(f.population), f.population).toBe(true);
        expect(f.quote.trim().length, f.key).toBeGreaterThan(10);
        const g = gradeFinding(
          { ...f.grading, design: t.sources.find((s) => s.key === f.source)!.studyDesign },
          true,
        );
        expect(g.level).toMatch(/^[A-G]$/);
      }
    }
  });

  it('claims cite findings of their own topic, use known populations and avoid causal wording', () => {
    const seen = new Set<string>();
    for (const t of data.topics) {
      const fk = new Set(t.findings.map((f) => f.key));
      for (const c of t.claims) {
        expect(seen.has(c.key), `duplicate claim ${c.key}`).toBe(false);
        seen.add(c.key);
        for (const l of c.findings) expect(fk.has(l.finding), `${c.key} → ${l.finding}`).toBe(true);
        for (const p of [...(c.applicability?.appliesTo ?? []), ...(c.applicability?.notFor ?? [])])
          expect(populations.has(p), p).toBe(true);
        expect(CAUSAL.test(c.statement), c.key).toBe(false);
      }
    }
  });

  it('methods cite existing claims and catalogued prescription variables', () => {
    const claims = new Set(data.topics.flatMap((t) => t.claims.map((c) => c.key)));
    expect(data.methods.length).toBeGreaterThan(15);
    for (const m of data.methods) {
      expect(m.definition.length, m.slug).toBeGreaterThan(10);
      for (const n of m.notes)
        if (n.claim) expect(claims.has(n.claim), `${m.slug} → ${n.claim}`).toBe(true);
      for (const v of m.variables) {
        expect(variables.has(v.variableKey), v.variableKey).toBe(true);
        expect(v.claim && claims.has(v.claim), `${m.slug}.${v.variableKey}`).toBe(true);
        if (v.population) expect(populations.has(v.population)).toBe(true);
        if (v.min != null && v.max != null) expect(v.min).toBeLessThanOrEqual(v.max);
      }
    }
  });
});
