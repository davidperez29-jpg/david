import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RTP_ITEMS } from '@tp/domain';
import { loadInjuryFile, validateInjurySeed } from '../src/seed/injury';

const root = join(__dirname, '..', '..', '..', 'seed-data');
const data = loadInjuryFile(join(root, 'injury', 'protocols.json'));
const catalog = JSON.parse(readFileSync(join(root, 'assessment', 'catalog.json'), 'utf8')) as {
  tests: { slug: string; sided?: boolean }[];
};
const evidence = JSON.parse(readFileSync(join(root, 'evidence', 'injury.json'), 'utf8')) as {
  sources: { key: string }[];
};

describe('injury catalogue seed', () => {
  it('has the six initial conditions, each with a protocol', () => {
    expect(data.conditions.map((c) => c.slug).sort()).toEqual(
      [
        'achilles_tendinopathy',
        'acl',
        'adductor_strain',
        'hamstring_strain',
        'lateral_ankle_sprain',
        'patellar_tendinopathy',
      ].sort(),
    );
    for (const c of data.conditions)
      expect(data.protocols.some((p) => p.condition === c.slug)).toBe(true);
  });

  it('is structurally valid: tests exist, non-practical criteria cite sources, no «apto»', () => {
    expect(validateInjurySeed(data, new Set(catalog.tests.map((t) => t.slug)))).toEqual([]);
  });

  it('cites only verified sources of the evidence seed', () => {
    const keys = new Set(evidence.sources.map((s) => s.key));
    const cited = data.protocols.flatMap((p) => [
      ...p.sources,
      ...p.phases.flatMap((ph) => ph.criteria.flatMap((c) => c.sources ?? [])),
    ]);
    expect(cited.filter((k) => !keys.has(k))).toEqual([]);
  });

  it('LSI criteria use sided tests and checklist items exist', () => {
    const sided = new Set(catalog.tests.filter((t) => t.sided).map((t) => t.slug));
    for (const p of data.protocols)
      for (const ph of p.phases)
        for (const c of ph.criteria) {
          if (c.auto?.metric === 'lsi') expect(sided.has(c.auto.test), c.auto.test).toBe(true);
          if (c.rtpItem) expect(Object.keys(RTP_ITEMS)).toContain(c.rtpItem);
        }
  });

  it('every protocol ends with the human decision of the responsible team', () => {
    for (const p of data.protocols) {
      const last = p.phases.at(-1)!;
      expect(last.criteria.some((c) => /equipo responsable/u.test(c.text))).toBe(true);
    }
  });
});
