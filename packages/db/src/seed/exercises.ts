/**
 * Global exercise library (platform-wide, published, read-only for organizations) used by the
 * plan templates. Idempotent by slug: taxonomy links, instructions and progressions are replaced.
 * Technique text only; no videos (they need human verification, §28).
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import type { Database } from '../client';
import {
  equipment,
  exerciseCategories,
  exerciseCategoryLinks,
  exerciseEquipment,
  exerciseInstructions,
  exerciseMethodLinks,
  exerciseMuscles,
  exerciseProgressions,
  exercises,
  methods,
  movementPatterns,
  muscles,
  prescriptionProfiles,
} from '../schema';

type Level = 'beginner' | 'intermediate' | 'advanced';
export interface SeedExercise {
  slug: string;
  name: string;
  altNames?: string[];
  pattern: string;
  categories: string[];
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  equipment?: { slug: string; optional?: boolean }[];
  bodyRegion?: 'lower' | 'upper' | 'trunk' | 'full_body';
  laterality?: 'bilateral' | 'unilateral' | 'alternating' | 'asymmetric_load';
  planes?: ('sagittal' | 'frontal' | 'transverse')[];
  contractionEmphasis?: ('concentric' | 'eccentric' | 'isometric' | 'reactive_ssc' | 'mixed')[];
  intendedVelocity?: 'slow_controlled' | 'moderate' | 'maximal_intent' | 'ballistic';
  level: Level;
  spaceRequired?: 'minimal' | 'small' | 'large' | 'track_field';
  technicalComplexity?: number;
  axialLoad?: 'none' | 'low' | 'moderate' | 'high';
  impactLevel?: 'none' | 'low' | 'moderate' | 'high';
  profile: string;
  supportsVbt?: boolean;
  contactsPerRep?: number | null;
  clientDescription: string;
  instructions?: {
    kind: 'cue' | 'common_error' | 'precaution' | 'setup' | 'execution';
    text: string;
    audience?: 'client' | 'trainer' | 'both';
  }[];
  /** Global method slugs (science layer) this exercise is an example of. */
  methods?: string[];
}
export interface ExerciseSeed {
  exercises: SeedExercise[];
  progressions: { from: string; to: string; relation: 'progression' | 'regression' | 'variant' }[];
}

export function loadExerciseFile(path: string): ExerciseSeed {
  if (!existsSync(path)) return { exercises: [], progressions: [] };
  const d = JSON.parse(readFileSync(path, 'utf8')) as Partial<ExerciseSeed>;
  return { exercises: d.exercises ?? [], progressions: d.progressions ?? [] };
}

async function slugMap(
  tx: Database,
  table:
    | typeof movementPatterns
    | typeof muscles
    | typeof exerciseCategories
    | typeof prescriptionProfiles
    | typeof equipment
    | typeof methods,
): Promise<Map<string, string>> {
  const t = table as typeof movementPatterns;
  const rows = await tx.select({ id: t.id, slug: t.slug }).from(t).where(isNull(t.organizationId));
  return new Map(rows.map((r) => [r.slug, r.id]));
}

export async function seedGlobalExercises(
  db: Database,
  data: ExerciseSeed,
): Promise<{ exercises: number; progressions: number }> {
  if (!data.exercises.length) return { exercises: 0, progressions: 0 };
  return db.transaction(async (txx) => {
    const tx = txx as unknown as Database;
    const [pat, mus, cat, prof, eq_, meth] = await Promise.all([
      slugMap(tx, movementPatterns),
      slugMap(tx, muscles),
      slugMap(tx, exerciseCategories),
      slugMap(tx, prescriptionProfiles),
      slugMap(tx, equipment),
      slugMap(tx, methods),
    ]);
    const need = (m: Map<string, string>, slug: string, what: string) => {
      const id = m.get(slug);
      if (!id) throw new Error(`Exercise seed: unknown ${what} «${slug}»`);
      return id;
    };
    const ids = new Map<string, string>();
    for (const e of data.exercises) {
      const values = {
        name: e.name,
        altNames: e.altNames ?? [],
        movementPatternId: need(pat, e.pattern, 'pattern'),
        bodyRegion: e.bodyRegion ?? null,
        laterality: e.laterality ?? null,
        planes: e.planes ?? [],
        contractionEmphasis: e.contractionEmphasis ?? [],
        intendedVelocity: e.intendedVelocity ?? null,
        level: e.level,
        spaceRequired: e.spaceRequired ?? null,
        technicalComplexity: e.technicalComplexity ?? null,
        axialLoad: e.axialLoad ?? null,
        impactLevel: e.impactLevel ?? null,
        clientDescription: e.clientDescription,
        prescriptionProfileId: need(prof, e.profile, 'prescription profile'),
        supportsVbt: e.supportsVbt ?? false,
        contactsPerRep: e.contactsPerRep ?? null,
        status: 'published' as const,
        source: 'platform',
        sourceRef: `global:${e.slug}`,
        needsReview: false,
      };
      const [existing] = await tx
        .select({ id: exercises.id })
        .from(exercises)
        .where(and(isNull(exercises.organizationId), eq(exercises.slug, e.slug)));
      let id: string;
      if (existing) {
        id = existing.id;
        await tx.update(exercises).set(values).where(eq(exercises.id, id));
      } else {
        const [row] = await tx
          .insert(exercises)
          .values({ ...values, organizationId: null, slug: e.slug })
          .returning({ id: exercises.id });
        id = row!.id;
      }
      ids.set(e.slug, id);
      await Promise.all([
        tx.delete(exerciseCategoryLinks).where(eq(exerciseCategoryLinks.exerciseId, id)),
        tx.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, id)),
        tx.delete(exerciseEquipment).where(eq(exerciseEquipment.exerciseId, id)),
        tx.delete(exerciseInstructions).where(eq(exerciseInstructions.exerciseId, id)),
        tx.delete(exerciseMethodLinks).where(eq(exerciseMethodLinks.exerciseId, id)),
      ]);
      const cats = [...new Set(e.categories)];
      await tx.insert(exerciseCategoryLinks).values(
        cats.map((c, i) => ({
          exerciseId: id,
          categoryId: need(cat, c, 'category'),
          isPrimary: i === 0,
        })),
      );
      const musRows = new Map<string, 'primary' | 'secondary'>();
      for (const m of e.secondaryMuscles ?? []) musRows.set(m, 'secondary');
      for (const m of e.primaryMuscles) musRows.set(m, 'primary');
      if (musRows.size)
        await tx.insert(exerciseMuscles).values(
          [...musRows].map(([m, role]) => ({
            exerciseId: id,
            muscleId: need(mus, m, 'muscle'),
            role,
          })),
        );
      const eqRows = new Map((e.equipment ?? []).map((x) => [x.slug, x.optional ?? false]));
      if (eqRows.size)
        await tx.insert(exerciseEquipment).values(
          [...eqRows].map(([s, optional]) => ({
            exerciseId: id,
            equipmentId: need(eq_, s, 'equipment'),
            optional,
          })),
        );
      const pos: Record<string, number> = {};
      if (e.instructions?.length) {
        await tx.insert(exerciseInstructions).values(
          e.instructions.map((x) => ({
            exerciseId: id,
            kind: x.kind,
            position: (pos[x.kind] = (pos[x.kind] ?? 0) + 1),
            text: x.text,
            audience: x.audience ?? 'both',
          })),
        );
      }
      const ms = [...new Set(e.methods ?? [])].map((m) => need(meth, m, 'method'));
      if (ms.length)
        await tx
          .insert(exerciseMethodLinks)
          .values(ms.map((methodId) => ({ exerciseId: id, methodId })));
    }
    const all = [...ids.values()];
    await tx
      .delete(exerciseProgressions)
      .where(
        and(
          isNull(exerciseProgressions.organizationId),
          inArray(exerciseProgressions.fromExerciseId, all),
        ),
      );
    const edges = data.progressions.map((p) => {
      const from = ids.get(p.from);
      const to = ids.get(p.to);
      if (!from || !to)
        throw new Error(
          `Exercise seed: progression ${p.from} → ${p.to} references an unknown exercise`,
        );
      // Same normalization as the use case: regression A→B is stored as progression B→A.
      return p.relation === 'regression'
        ? { fromExerciseId: to, toExerciseId: from, relation: 'progression' as const }
        : { fromExerciseId: from, toExerciseId: to, relation: p.relation };
    });
    const uniq = [
      ...new Map(
        edges.map((x) => [`${x.fromExerciseId}:${x.toExerciseId}:${x.relation}`, x]),
      ).values(),
    ];
    if (uniq.length)
      await tx
        .insert(exerciseProgressions)
        .values(uniq.map((x) => ({ ...x, organizationId: null })));
    return { exercises: ids.size, progressions: uniq.length };
  });
}
