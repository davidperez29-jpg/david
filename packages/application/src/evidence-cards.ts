/**
 * «Fuente» cards (restructure phase 9, docs/SCIENCE_SYSTEM.md §1 and §6): what each important
 * recommendation can show where it is used — article, DOI/PMID, population, what it supports,
 * evidence kind, limitations and origin.
 *
 * Only a verified source is ever shown as support. Anything else (cited in a document, not
 * verifiable, retracted) is listed apart, flagged, and never counts as backing.
 */
import { schema, type Executor } from '@tp/db';
import {
  canSupport,
  designLabel,
  EVIDENCE_KINDS,
  LEVEL_LABELS,
  ORIGINS,
  VERIFICATION_LABELS,
  type EvidenceKind,
  type EvidenceLevel,
  type Origin,
  type StudyDesign,
  type VerificationStatus,
} from '@tp/domain';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';

const {
  evidenceSources,
  evidenceFindings,
  claimEvidence,
  knowledgeClaims,
  methodNotes,
  methodVariables,
  populations,
} = schema;

export interface SourceCard {
  id: string;
  citation: string;
  title: string;
  journal: string | null;
  year: number | null;
  doi: string | null;
  pmid: string | null;
  design: string;
  population: string | null;
  limitations: string | null;
  origin: string;
  citedIn: string | null;
  verification: string;
  /** Published claims this source backs, with what kind of evidence they are. */
  supports: {
    statement: string;
    level: string;
    evidenceKind: string | null;
    population: string | null;
    limitations: string | null;
  }[];
}
export interface EvidenceCards {
  cards: SourceCard[];
  /** Cited but not usable as support (never shown as backing). */
  notSupporting: { id: string; citation: string; verification: string; citedIn: string | null }[];
}

export const citeShort = (s: { authors: string[] | null; year: number | null }) => {
  const a = s.authors ?? [];
  const who = a.length === 0 ? 's. a.' : a.length > 2 ? `${a[0]} et al.` : a.join(' y ');
  return `${who} (${s.year ?? 's. f.'})`;
};

/** Cards for some sources (global or of the organization), verified ones first by year. */
export async function sourceCards(
  db: Executor,
  organizationId: string,
  ids: string[],
): Promise<EvidenceCards> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return { cards: [], notSupporting: [] };
  const rows = await db
    .select()
    .from(evidenceSources)
    .where(
      and(
        inArray(evidenceSources.id, uniq),
        or(
          isNull(evidenceSources.organizationId),
          eq(evidenceSources.organizationId, organizationId),
        ),
      ),
    );
  const ok = rows.filter((r) => canSupport(r.verificationStatus));
  const links = ok.length
    ? await db
        .select({
          sourceId: evidenceFindings.sourceId,
          statement: knowledgeClaims.statement,
          level: knowledgeClaims.evidenceLevel,
          kind: knowledgeClaims.evidenceKind,
          limitations: knowledgeClaims.limitations,
          population: populations.name,
          claimId: knowledgeClaims.id,
        })
        .from(claimEvidence)
        .innerJoin(evidenceFindings, eq(evidenceFindings.id, claimEvidence.findingId))
        .innerJoin(knowledgeClaims, eq(knowledgeClaims.id, claimEvidence.claimId))
        .leftJoin(populations, eq(populations.id, evidenceFindings.populationId))
        .where(
          and(
            inArray(
              evidenceFindings.sourceId,
              ok.map((r) => r.id),
            ),
            eq(claimEvidence.role, 'supports'),
            eq(knowledgeClaims.status, 'published'),
          ),
        )
    : [];
  const cards: SourceCard[] = ok
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title))
    .map((r) => {
      const seen = new Set<string>();
      return {
        id: r.id,
        citation: citeShort(r),
        title: r.title,
        journal: r.journal,
        year: r.year,
        doi: r.doi,
        pmid: r.pmid,
        design: designLabel(r.studyDesign as StudyDesign),
        population: r.populationSummary,
        limitations: r.limitations,
        origin: ORIGINS[r.origin as Origin],
        citedIn: r.citedIn,
        verification: VERIFICATION_LABELS[r.verificationStatus as VerificationStatus],
        supports: links
          .filter((l) => l.sourceId === r.id && !seen.has(l.claimId) && seen.add(l.claimId))
          .map((l) => ({
            statement: l.statement,
            level: `${l.level} — ${LEVEL_LABELS[l.level as EvidenceLevel]}`,
            evidenceKind: l.kind ? EVIDENCE_KINDS[l.kind as EvidenceKind] : null,
            population: l.population,
            limitations: l.limitations,
          })),
      };
    });
  return {
    cards,
    notSupporting: rows
      .filter((r) => !canSupport(r.verificationStatus))
      .map((r) => ({
        id: r.id,
        citation: citeShort(r),
        verification: VERIFICATION_LABELS[r.verificationStatus as VerificationStatus],
        citedIn: r.citedIn,
      })),
  };
}

/** Sources behind some methods: the claims their doses and notes cite, and those claims' findings. */
export async function methodSourceIds(db: Executor, methodIds: string[]): Promise<string[]> {
  if (!methodIds.length) return [];
  const [vars, notes] = await Promise.all([
    db
      .select({ claimId: methodVariables.claimId })
      .from(methodVariables)
      .where(inArray(methodVariables.methodId, methodIds)),
    db
      .select({ claimId: methodNotes.claimId })
      .from(methodNotes)
      .where(inArray(methodNotes.methodId, methodIds)),
  ]);
  const claimIds = [...new Set([...vars, ...notes].flatMap((x) => (x.claimId ? [x.claimId] : [])))];
  if (!claimIds.length) return [];
  const rows = await db
    .select({ sourceId: evidenceFindings.sourceId })
    .from(claimEvidence)
    .innerJoin(evidenceFindings, eq(evidenceFindings.id, claimEvidence.findingId))
    .where(and(inArray(claimEvidence.claimId, claimIds), eq(claimEvidence.role, 'supports')));
  return [...new Set(rows.map((r) => r.sourceId))];
}

/** The «Fuente» cards of some sources and/or methods (staff; science is read by the team). */
async function evidenceCards_(
  ctx: RequestContext,
  q: { sourceIds?: string[]; methodIds?: string[] },
): Promise<EvidenceCards> {
  requirePermission(ctx, 'science:read');
  const ids = [...(q.sourceIds ?? []), ...(await methodSourceIds(ctx.db, q.methodIds ?? []))];
  return sourceCards(ctx.db, ctx.actor.organizationId, ids);
}
export const evidenceCards = secured(evidenceCards_);
