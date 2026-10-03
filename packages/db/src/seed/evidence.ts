/**
 * Global scientific library seed (MASTER_SPECIFICATION §10). Loads the curated JSON files in
 * `seed-data/evidence/` into the platform-wide (organization NULL, read-only) library.
 *
 * - Idempotent: sources by `source_key` (or PMID/DOI), findings by `finding_key`, claims by key,
 *   methods by slug. Re-running updates the rows in place.
 * - The same paper cited from several topic files becomes one source row.
 * - Finding and claim levels are computed from the stored grading rationale (never typed in).
 * - A claim is published only when the scientific QA reports no errors; otherwise it stays draft.
 * - A method is published only when it has a definition and every dose variable cites a claim.
 */
import {
  claimLevel,
  gradeFinding,
  qaClaim,
  type EvidenceLevel,
  type GradingRationale,
  type QaFinding,
  type QaIssue,
  type QaSource,
  type StudyDesign,
} from '@tp/domain';
import { and, eq, isNull, or } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from '../client';
import {
  claimEvidence,
  evidenceFindings,
  evidenceSources,
  knowledgeClaims,
  methodNotes,
  methods,
  methodVariables,
  outcomes,
  populations,
} from '../schema';

type Role = 'supports' | 'contradicts' | 'context';

export interface SeedSource {
  key: string;
  pmid?: string | null;
  doi?: string | null;
  title: string;
  journal?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  authors?: string[];
  year?: number | null;
  studyDesign: StudyDesign;
  populationSummary?: string | null;
  ageRange?: string | null;
  sex?: 'female' | 'male' | 'mixed' | 'unknown' | null;
  trainingStatus?: string | null;
  sport?: string | null;
  intervention?: string | null;
  comparison?: string | null;
  outcomesMeasured?: string | null;
  resultsSummary?: string | null;
  limitations?: string | null;
  practicalApplication?: string | null;
  access?: 'abstract_only' | 'full_text';
  verificationStatus?: 'retracted';
}
export interface SeedFinding {
  key: string;
  source: string;
  outcome: string;
  population: string;
  intervention?: string | null;
  comparator?: string | null;
  effectMetric?: string | null;
  effectValue?: number | null;
  ciLow?: number | null;
  ciHigh?: number | null;
  nStudies?: number | null;
  nParticipants?: number | null;
  heterogeneityI2?: number | null;
  quote: string;
  grading: Omit<GradingRationale, 'design'> & { design?: string };
  epistemicType?: 'fact' | 'inference' | 'hypothesis' | 'opinion';
}
export interface SeedClaim {
  key: string;
  statement: string;
  scope?: string | null;
  epistemicType: 'fact' | 'inference' | 'hypothesis' | 'opinion';
  confidence: 'high' | 'moderate' | 'low' | 'very_low';
  limitations?: string | null;
  findings: { finding: string; role: Role }[];
  applicability?: { appliesTo?: string[]; notFor?: string[] };
}
export interface SeedTopic {
  topic: string;
  sources: SeedSource[];
  findings: SeedFinding[];
  claims: SeedClaim[];
}
export interface SeedMethod {
  slug: string;
  name: string;
  kind:
    | 'training_method'
    | 'contraction_type'
    | 'organization_method'
    | 'autoregulation_method'
    | 'conditioning_method';
  definition: string;
  summaryForTrainer?: string;
  summaryForClient?: string;
  notes: {
    kind: 'mechanism' | 'indication' | 'precaution' | 'progression' | 'limitation';
    text: string;
    claim?: string;
  }[];
  variables: {
    variableKey: string;
    population?: string;
    min?: number;
    max?: number;
    typical?: number;
    unit?: string;
    claim?: string;
    notes?: string;
  }[];
}

export interface EvidenceSeedOptions {
  /** How the curated records were checked (stored on every source). */
  verificationMethod: string;
  /** When the records were checked (fixed, so re-imports do not change history). */
  verifiedAt: Date;
}

export interface EvidenceSeedReport {
  sources: number;
  findings: number;
  claims: { total: number; published: number; draft: string[] };
  methods: { total: number; published: number; draft: string[] };
  levels: Partial<Record<EvidenceLevel, number>>;
  qaErrors: QaIssue[];
}

export const DEFAULT_EVIDENCE_VERIFICATION: EvidenceSeedOptions = {
  verificationMethod:
    'PubMed (conector NCBI): metadatos (título, autores, revista, año, DOI, PMID) y resumen comparados; citas copiadas literalmente del resumen.',
  verifiedAt: new Date('2026-10-03T00:00:00Z'),
};

export function loadEvidenceFiles(dir: string): { topics: SeedTopic[]; methods: SeedMethod[] } {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const topics: SeedTopic[] = [];
  let ms: SeedMethod[] = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>;
    if (f === 'methods.json') ms = (data.methods as SeedMethod[]) ?? [];
    else topics.push(data as unknown as SeedTopic);
  }
  return { topics, methods: ms };
}

const n = (v: number | null | undefined) => (v == null ? null : String(v));
const isVerified = (s: string) => s === 'verified' || s === 'verified_with_corrections';

export async function seedEvidence(
  db: Database,
  data: { topics: SeedTopic[]; methods: SeedMethod[] },
  opts: EvidenceSeedOptions = DEFAULT_EVIDENCE_VERIFICATION,
): Promise<EvidenceSeedReport> {
  return db.transaction(async (txx) => {
    const tx = txx as unknown as Database;
    const popRows = await tx
      .select({ id: populations.id, slug: populations.slug })
      .from(populations)
      .where(isNull(populations.organizationId));
    const outRows = await tx
      .select({ id: outcomes.id, slug: outcomes.slug })
      .from(outcomes)
      .where(isNull(outcomes.organizationId));
    const pop = new Map(popRows.map((r) => [r.slug, r.id]));
    const out = new Map(outRows.map((r) => [r.slug, r.id]));
    const need = (m: Map<string, string>, slug: string, what: string) => {
      const id = m.get(slug);
      if (!id) throw new Error(`Evidence seed: unknown ${what} «${slug}»`);
      return id;
    };

    // ── Sources (deduplicated by PMID/DOI across topic files) ──
    const sourceId = new Map<string, string>(); // `${topic}:${key}` → id
    const sourceRow = new Map<string, { status: string; design: StudyDesign; qa: QaSource }>(); // id → info
    for (const t of data.topics) {
      for (const s of t.sources) {
        const status: 'verified' | 'retracted' = s.verificationStatus ?? 'verified';
        const values = {
          title: s.title,
          authors: s.authors ?? [],
          year: s.year ?? null,
          journal: s.journal ?? null,
          volume: s.volume ?? null,
          issue: s.issue ?? null,
          pages: s.pages ?? null,
          doi: s.doi ?? null,
          pmid: s.pmid ?? null,
          studyDesign: s.studyDesign,
          populationSummary: s.populationSummary ?? null,
          ageRange: s.ageRange ?? null,
          sex: s.sex ?? null,
          trainingStatus: (s.trainingStatus ?? null) as 'mixed' | null,
          sport: s.sport ?? null,
          intervention: s.intervention ?? null,
          comparison: s.comparison ?? null,
          outcomesMeasured: s.outcomesMeasured ?? null,
          resultsSummary: s.resultsSummary ?? null,
          limitations: s.limitations ?? null,
          practicalApplication: s.practicalApplication ?? null,
          access: s.access ?? 'abstract_only',
          verificationStatus: status,
          verificationMethod: opts.verificationMethod,
          verifiedAt: isVerified(status) ? opts.verifiedAt : null,
        };
        const ids = [eq(evidenceSources.sourceKey, s.key)];
        if (s.pmid) ids.push(eq(evidenceSources.pmid, s.pmid));
        if (s.doi) ids.push(eq(evidenceSources.doi, s.doi));
        const [existing] = await tx
          .select({ id: evidenceSources.id, sourceKey: evidenceSources.sourceKey })
          .from(evidenceSources)
          .where(and(isNull(evidenceSources.organizationId), or(...ids)));
        let id: string;
        if (existing) {
          id = existing.id;
          // The first topic that cited the paper owns the row; later citations reuse it.
          if (existing.sourceKey === s.key)
            await tx.update(evidenceSources).set(values).where(eq(evidenceSources.id, id));
        } else {
          const [row] = await tx
            .insert(evidenceSources)
            .values({ ...values, organizationId: null, sourceKey: s.key })
            .returning({ id: evidenceSources.id });
          id = row!.id;
        }
        sourceId.set(`${t.topic}:${s.key}`, id);
        if (!sourceRow.has(id)) {
          sourceRow.set(id, {
            status,
            design: s.studyDesign,
            qa: {
              key: id,
              doi: values.doi,
              pmid: values.pmid,
              verificationStatus: status as QaSource['verificationStatus'],
              verifiedAt: values.verifiedAt,
              verificationMethod: values.verificationMethod,
              populationSummary: values.populationSummary,
            },
          });
        }
      }
    }

    // ── Findings (keys are namespaced by topic: different files may reuse a short key) ──
    const findingId = new Map<string, string>();
    const findingQa = new Map<string, QaFinding>();
    const findingLevel = new Map<string, EvidenceLevel>();
    for (const t of data.topics) {
      for (const f of t.findings) {
        const sid = sourceId.get(`${t.topic}:${f.source}`);
        if (!sid)
          throw new Error(`Evidence seed: finding ${f.key} cites unknown source ${f.source}`);
        const src = sourceRow.get(sid)!;
        const rationale: GradingRationale = { ...f.grading, design: src.design };
        const g = gradeFinding(rationale, isVerified(src.status));
        const findingKey = `${t.topic}:${f.key}`;
        const values = {
          sourceId: sid,
          outcomeId: need(out, f.outcome, 'outcome'),
          populationId: need(pop, f.population, 'population'),
          intervention: f.intervention ?? null,
          comparator: f.comparator ?? null,
          effectMetric: f.effectMetric ?? null,
          effectValue: n(f.effectValue),
          ciLow: n(f.ciLow),
          ciHigh: n(f.ciHigh),
          nStudies: f.nStudies ?? null,
          nParticipants: f.nParticipants ?? null,
          heterogeneityI2: n(f.heterogeneityI2),
          quote: f.quote,
          gradingRationale: rationale,
          evidenceLevel: g.level,
          epistemicType: f.epistemicType ?? 'fact',
        };
        const [existing] = await tx
          .select({ id: evidenceFindings.id })
          .from(evidenceFindings)
          .where(
            and(
              isNull(evidenceFindings.organizationId),
              eq(evidenceFindings.findingKey, findingKey),
            ),
          );
        let id: string;
        if (existing) {
          id = existing.id;
          await tx.update(evidenceFindings).set(values).where(eq(evidenceFindings.id, id));
        } else {
          const [row] = await tx
            .insert(evidenceFindings)
            .values({ ...values, organizationId: null, findingKey })
            .returning({ id: evidenceFindings.id });
          id = row!.id;
        }
        findingId.set(findingKey, id);
        findingLevel.set(id, g.level);
        findingQa.set(id, {
          key: id,
          sourceKey: sid,
          populationSlug: f.population,
          quote: f.quote,
          effectValue: f.effectValue ?? null,
        });
      }
    }

    // ── Claims ──
    const sourcesQa = new Map([...sourceRow.values()].map((s) => [s.qa.key, s.qa]));
    const claimId = new Map<string, string>();
    const claimPublished = new Set<string>();
    const report: EvidenceSeedReport = {
      sources: sourceRow.size,
      findings: findingId.size,
      claims: { total: 0, published: 0, draft: [] },
      methods: { total: 0, published: 0, draft: [] },
      levels: {},
      qaErrors: [],
    };
    for (const t of data.topics) {
      for (const c of t.claims) {
        const links = c.findings.map((l) => {
          const id = findingId.get(`${t.topic}:${l.finding}`);
          if (!id)
            throw new Error(`Evidence seed: claim ${c.key} cites unknown finding ${l.finding}`);
          return { findingId: id, role: l.role };
        });
        const level = claimLevel(
          links.map((l) => ({ level: findingLevel.get(l.findingId)!, role: l.role })),
        );
        const appliesTo = c.applicability?.appliesTo ?? [];
        const notFor = c.applicability?.notFor ?? [];
        for (const p of [...appliesTo, ...notFor]) need(pop, p, 'population');
        const qa = qaClaim(
          {
            key: c.key,
            statement: c.statement,
            status: 'published',
            level,
            appliesTo,
            findings: links.map((l) => ({ findingKey: l.findingId, role: l.role })),
          },
          findingQa,
          sourcesQa,
        );
        const errors = qa.filter((i) => i.severity === 'error');
        report.qaErrors.push(...errors);
        const status = errors.length ? 'draft' : 'published';
        const values = {
          statement: c.statement,
          scope: c.scope ?? null,
          epistemicType: c.epistemicType,
          confidence: c.confidence,
          limitations: c.limitations ?? null,
          applicability: { appliesTo, notFor },
          evidenceLevel: level,
          status: status as 'draft' | 'published',
          reviewedAt: status === 'published' ? opts.verifiedAt : null,
        };
        const [existing] = await tx
          .select({ id: knowledgeClaims.id })
          .from(knowledgeClaims)
          .where(and(isNull(knowledgeClaims.organizationId), eq(knowledgeClaims.key, c.key)));
        let id: string;
        if (existing) {
          id = existing.id;
          await tx.update(knowledgeClaims).set(values).where(eq(knowledgeClaims.id, id));
          await tx.delete(claimEvidence).where(eq(claimEvidence.claimId, id));
        } else {
          const [row] = await tx
            .insert(knowledgeClaims)
            .values({ ...values, organizationId: null, key: c.key })
            .returning({ id: knowledgeClaims.id });
          id = row!.id;
        }
        // The same paper may appear twice in a claim through two topic files: keep one link per finding.
        const uniq = [...new Map(links.map((l) => [l.findingId, l])).values()];
        if (uniq.length)
          await tx.insert(claimEvidence).values(uniq.map((l) => ({ claimId: id, ...l })));
        claimId.set(c.key, id);
        if (status === 'published') claimPublished.add(c.key);
        else report.claims.draft.push(c.key);
        report.levels[level] = (report.levels[level] ?? 0) + 1;
        report.claims.total++;
      }
    }
    report.claims.published = claimPublished.size;

    // ── Methods ──
    for (const m of data.methods) {
      const claimOf = (key: string | undefined) => {
        if (!key) return null;
        const id = claimId.get(key);
        if (!id) throw new Error(`Evidence seed: method ${m.slug} cites unknown claim ${key}`);
        return id;
      };
      const justified = m.variables.every((v) => v.claim && claimPublished.has(v.claim));
      const status = m.definition?.trim() && justified ? 'published' : 'draft';
      const values = {
        name: m.name,
        kind: m.kind,
        definition: m.definition,
        summaryForTrainer: m.summaryForTrainer ?? null,
        summaryForClient: m.summaryForClient ?? null,
        status: status as 'draft' | 'published',
      };
      const [existing] = await tx
        .select({ id: methods.id })
        .from(methods)
        .where(and(isNull(methods.organizationId), eq(methods.slug, m.slug)));
      let id: string;
      if (existing) {
        id = existing.id;
        await tx.update(methods).set(values).where(eq(methods.id, id));
        await tx.delete(methodNotes).where(eq(methodNotes.methodId, id));
        await tx.delete(methodVariables).where(eq(methodVariables.methodId, id));
      } else {
        const [row] = await tx
          .insert(methods)
          .values({ ...values, organizationId: null, slug: m.slug })
          .returning({ id: methods.id });
        id = row!.id;
      }
      if (m.notes.length)
        await tx.insert(methodNotes).values(
          m.notes.map((x, i) => ({
            methodId: id,
            kind: x.kind,
            text: x.text,
            claimId: claimOf(x.claim),
            position: i + 1,
          })),
        );
      if (m.variables.length) {
        await tx.insert(methodVariables).values(
          m.variables.map((v) => ({
            organizationId: null,
            methodId: id,
            variableKey: v.variableKey,
            populationId: v.population ? need(pop, v.population, 'population') : null,
            minValue: n(v.min),
            maxValue: n(v.max),
            typicalValue: n(v.typical),
            unit: v.unit ?? null,
            claimId: claimOf(v.claim),
            isDefaultSuggestion: false,
            notes: v.notes ?? null,
          })),
        );
      }
      report.methods.total++;
      if (status === 'published') report.methods.published++;
      else report.methods.draft.push(m.slug);
    }
    return report;
  });
}
