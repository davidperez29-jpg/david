import 'server-only';
import { type LibraryVM, type VariantDetailVM, type VariantRefVM } from '@/contracts/trainer';
import { canAdaptExercise, canEditExercise, canViewExercise } from '@/domain/access';
import {
  effectiveSteps,
  type ExerciseVariant,
  type ProgressionLink,
} from '@/domain/library/exercise';
import { SYSTEM_TAXONOMY, type Taxonomy, visibleTo } from '@/domain/library/taxonomy';
import { type RequestContext, type TrainerContext } from '../context';

/** Taxonomía que ve un entrenador: la del sistema más sus categorías y etiquetas propias. */
async function taxonomyFor(ctx: TrainerContext): Promise<Taxonomy> {
  const [categories, tags] = await Promise.all([
    ctx.repos.library.customTagCategories(),
    ctx.repos.library.customTags(),
  ]);
  return {
    ...SYSTEM_TAXONOMY,
    // Las categorías archivadas (p. ej., «Control y estabilidad») no se ofrecen.
    tagCategories: [
      ...SYSTEM_TAXONOMY.tagCategories,
      ...visibleTo(categories, ctx.actor.trainerId),
    ].filter((category) => !category.archived),
    tags: [
      ...SYSTEM_TAXONOMY.tags,
      ...visibleTo(tags, ctx.actor.trainerId).filter((t) => !t.archived),
    ],
  };
}

/** Variantes visibles para el entrenador, con sus etiquetas personales añadidas (solo para él). */
async function visibleVariants(ctx: TrainerContext): Promise<ExerciseVariant[]> {
  const [variants, tagging] = await Promise.all([
    ctx.repos.library.variants(),
    ctx.repos.library.personalTagging(ctx.actor.trainerId),
  ]);
  return variants
    .filter((v) => canViewExercise(ctx.actor, v))
    .map((v) => {
      const personal = tagging.filter((t) => t.variantId === v.id).map((t) => t.tagId);
      return personal.length ? { ...v, tagIds: [...new Set([...v.tagIds, ...personal])] } : v;
    });
}

export async function getLibrary(ctx: TrainerContext): Promise<LibraryVM> {
  const [taxonomy, variants, exercises, favorites] = await Promise.all([
    taxonomyFor(ctx),
    visibleVariants(ctx),
    ctx.repos.library.exercises(),
    ctx.repos.library.favorites(ctx.actor.trainerId),
  ]);
  const visibleIds = new Set(variants.map((v) => v.id));
  return {
    taxonomy,
    exercises: exercises.filter((e) => canViewExercise(ctx.actor, e)),
    variants,
    favoriteIds: favorites.map((f) => f.variantId).filter((id) => visibleIds.has(id)),
  };
}

const ref = (v: ExerciseVariant, note?: string): VariantRefVM => ({
  id: v.id,
  name: v.name,
  isPrimary: v.isPrimary,
  visibility: v.visibility,
  ...(note ? { note } : {}),
});

const related = (
  ids: string[],
  byId: Map<string, ExerciseVariant>,
  links: ProgressionLink[],
  key: 'from' | 'to',
  self: string,
) =>
  ids.flatMap((id) => {
    const target = byId.get(id);
    if (!target) return []; // la relación apunta a algo que este entrenador no puede ver
    const link = links.find((l) =>
      key === 'to'
        ? l.fromVariantId === self && l.toVariantId === id
        : l.toVariantId === self && l.fromVariantId === id,
    );
    return [ref(target, link?.note)];
  });

/** Ficha de una variante. `null` si no existe o el entrenador no puede verla (no se distingue). */
export async function getVariantDetail(
  ctx: TrainerContext,
  variantId: string,
): Promise<VariantDetailVM | null> {
  const [taxonomy, variants, exercises, links, notes, favorites] = await Promise.all([
    taxonomyFor(ctx),
    visibleVariants(ctx),
    ctx.repos.library.exercises(),
    ctx.repos.library.progressions(),
    ctx.repos.library.notes(ctx.actor.trainerId),
    ctx.repos.library.favorites(ctx.actor.trainerId),
  ]);
  const variant = variants.find((v) => v.id === variantId);
  const exercise = exercises.find((e) => e.id === variant?.exerciseId);
  if (!variant || !exercise) return null;

  const byId = new Map(variants.map((v) => [v.id, v]));
  const visibleLinks = links.filter(
    (l) => l.owner.kind === 'system' || l.owner.trainerId === ctx.actor.trainerId,
  );
  const names = (ids: string[], items: readonly { id: string; name: string }[]) =>
    ids.map((id) => items.find((i) => i.id === id)?.name ?? id);
  const { steps, inheritedFrom } = effectiveSteps(variant, variants);

  const tagGroups = taxonomy.tagCategories
    .map((category) => ({
      category: category.name,
      personal: category.owner.kind === 'trainer',
      tags: taxonomy.tags
        .filter((t) => t.categoryId === category.id && variant.tagIds.includes(t.id))
        .map((t) => ({ id: t.id, name: t.name, personal: t.owner.kind === 'trainer' })),
    }))
    .filter((group) => group.tags.length > 0);

  return {
    variant,
    exercise,
    tagGroups,
    patterns: [...variant.patterns]
      .sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1))
      .map((p) => ({
        id: p.id,
        role: p.role,
        name: taxonomy.patterns.find((n) => n.id === p.id)?.name ?? p.id,
      })),
    equipment: names(variant.equipmentIds, taxonomy.equipment),
    regions: names(variant.regionIds, taxonomy.regions),
    environments: names(variant.environmentIds, taxonomy.environments),
    steps,
    stepsInheritedFrom: inheritedFrom ? { id: inheritedFrom.id, name: inheritedFrom.name } : null,
    siblings: variants
      .filter((v) => v.exerciseId === exercise.id && v.id !== variant.id)
      .map((v) => ref(v)),
    progressions: related(
      visibleLinks.filter((l) => l.fromVariantId === variant.id).map((l) => l.toVariantId),
      byId,
      visibleLinks,
      'to',
      variant.id,
    ),
    regressions: related(
      visibleLinks.filter((l) => l.toVariantId === variant.id).map((l) => l.fromVariantId),
      byId,
      visibleLinks,
      'from',
      variant.id,
    ),
    trainerNote: notes.find((n) => n.variantId === variant.id)?.text ?? null,
    isFavorite: favorites.some((f) => f.variantId === variant.id),
    canEdit: canEditExercise(ctx.actor, variant),
    canAdapt: canAdaptExercise(ctx.actor, variant),
    derivedFrom:
      variant.derivedFrom && byId.get(variant.derivedFrom.variantId)
        ? ref(byId.get(variant.derivedFrom.variantId)!)
        : null,
    adaptations: variants.filter((v) => v.derivedFrom?.variantId === variant.id).map((v) => ref(v)),
  };
}

/**
 * Variantes de unas sesiones, con las instrucciones efectivas (propias o de la variante de
 * referencia). Lo usan las pantallas de sesión del entrenador y del cliente.
 */
export async function loadSessionVariants(
  ctx: RequestContext<unknown>,
  variantIds: readonly string[],
) {
  const variants = await ctx.repos.library.getVariants([...new Set(variantIds)]);
  const needPrimary = variants
    .filter((v) => v.steps.length === 0 && !v.isPrimary)
    .map((v) => v.exerciseId);
  const primaries = needPrimary.length ? await ctx.repos.library.primaryVariants(needPrimary) : [];
  const pool = [...variants, ...primaries];
  return {
    byId: new Map(variants.map((v) => [v.id, v])),
    stepsOf: (variant: ExerciseVariant) => effectiveSteps(variant, pool).steps,
  };
}
