import { schema } from '@tp/db';
import { and, eq } from 'drizzle-orm';
import type { RequestContext } from './context';
import { addExerciseVideo, createExercise, listLibraryTaxonomies } from './library';

/** Shape produced by scripts/exercise-bank/normalize.ts (seed-data/exercise-bank/bank.json). */
export interface ImportedBankEntry {
  key: string;
  name: string;
  workbooks: string[];
  blocks: string[];
  sources: string[];
  videos: string[];
  pattern: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  categories: string[];
  contraction: string[];
  equipment: string[];
  bodyRegion: string | null;
  profile: string;
  battery: {
    number: number;
    type: string;
    mode: string | null;
    targetZone: string | null;
    dose: string | null;
    execution: string | null;
    error: string | null;
  } | null;
  review: string[];
}

export interface ImportReport {
  created: number;
  skippedExisting: number;
  videos: number;
  failed: { name: string; error: string }[];
}

/**
 * Imports a normalized exercise bank into the actor's organization as DRAFTS flagged
 * `needs_review`. Idempotent: entries already imported (same source_ref) are skipped.
 * Videos are attached as `pending_verification` — never shown to clients until verified.
 */
export async function importExerciseBank(
  ctx: RequestContext,
  entries: ImportedBankEntry[],
  opts: { sourceLabel?: string } = {},
): Promise<ImportReport> {
  const tax = await listLibraryTaxonomies(ctx);
  const id = <T extends { slug: string; id: string }>(list: T[], slug: string) =>
    list.find((x) => x.slug === slug)?.id;
  const report: ImportReport = { created: 0, skippedExisting: 0, videos: 0, failed: [] };
  const existing = new Set(
    (
      await ctx.db
        .select({ ref: schema.exercises.sourceRef })
        .from(schema.exercises)
        .where(
          and(
            eq(schema.exercises.organizationId, ctx.actor.organizationId),
            eq(schema.exercises.source, opts.sourceLabel ?? 'excel'),
          ),
        )
    ).map((r) => r.ref),
  );
  for (const e of entries) {
    const ref = `bank:${e.key}`;
    if (existing.has(ref)) {
      report.skippedExisting++;
      continue;
    }
    try {
      const muscles = [
        ...e.primaryMuscles.map((m) => ({
          muscleId: id(tax.muscles, m),
          role: 'primary' as const,
        })),
        ...e.secondaryMuscles.map((m) => ({
          muscleId: id(tax.muscles, m),
          role: 'secondary' as const,
        })),
      ].filter((m): m is { muscleId: string; role: 'primary' | 'secondary' } => !!m.muscleId);
      const b = e.battery;
      const trainerLines = [
        b ? `Batería preventiva n.º ${b.number} (${b.type}).` : null,
        b?.targetZone ? `Zona objetivo: ${b.targetZone}.` : null,
        b?.dose ? `Dosis de referencia del documento: ${b.dose}.` : null,
        `Bloques de origen: ${e.blocks.join(' | ')}.`,
        `Origen: ${e.workbooks.join(', ')}${e.sources.length ? ` · fuente indicada: ${e.sources.join(', ')}` : ''}.`,
      ].filter(Boolean);
      const instructions = [
        ...(b?.execution
          ? [
              {
                kind: 'execution' as const,
                text: b.execution.slice(0, 500),
                audience: 'trainer' as const,
              },
            ]
          : []),
        ...(b?.error
          ? [
              {
                kind: 'common_error' as const,
                text: b.error.slice(0, 500),
                audience: 'both' as const,
              },
            ]
          : []),
      ];
      const { id: exerciseId } = await createExercise(
        ctx,
        {
          name: e.name.slice(0, 120),
          movementPatternId: e.pattern ? (id(tax.patterns, e.pattern) ?? null) : null,
          bodyRegion: e.bodyRegion as 'lower' | 'upper' | 'trunk' | 'full_body' | null,
          contractionEmphasis: e.contraction as ('concentric' | 'eccentric' | 'isometric')[],
          prescriptionProfileId: id(tax.profiles, e.profile) ?? null,
          categoryIds: e.categories
            .map((c) => id(tax.categories, c))
            .filter((x): x is string => !!x),
          muscles,
          equipment: e.equipment
            .map((q) => id(tax.equipment, q))
            .filter((x): x is string => !!x)
            .map((equipmentId) => ({ equipmentId, optional: false })),
          trainerDescription: trainerLines.join('\n'),
          instructions,
        },
        {
          source: opts.sourceLabel ?? 'excel',
          sourceRef: ref,
          needsReview: true,
          reviewNotes: e.review.join(' '),
        },
      );
      report.created++;
      for (const url of e.videos) {
        await addExerciseVideo(ctx, exerciseId, { url, channel: e.sources.join(', ') || null });
        report.videos++;
      }
    } catch (err) {
      report.failed.push({ name: e.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return report;
}
