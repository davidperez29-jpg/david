/**
 * Comparativa and radar (restructure phase 5, docs/EVALUATION_SYSTEM.md §4 and §6): two
 * assessments of a client (A and B), each test standardized on one scale, grouped into radar
 * dimensions, with the change of every test against its measurement error.
 *
 * - Scales: Z against the group (the client's group session), Z against an applicable
 *   reference (mean ± SD), percentile in the group, % of the reference. `auto` uses the group
 *   when there is one and the reference otherwise.
 * - A and B are standardized against the same basis, so the radar shows what changed in the
 *   client, not in the basis.
 * - No data is a gap. Sided tests use the mean of both sides (asymmetry is shown apart).
 */
import { comparisonQuerySchema } from '@tp/contracts';
import { schema } from '@tp/db';
import {
  ALL_DIMENSIONS,
  DIMENSION_SETS,
  dimensionScore,
  DomainError,
  interpretChange,
  NEUTRAL,
  pickMeasurementError,
  referenceApplicability,
  SCALE_LABELS,
  SCALE_RANGE,
  scoreOf,
  type Basis,
  type ChangeInterpretation,
  type Direction,
  type RadarDimension,
  type Scale,
} from '@tp/domain';
import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  citation,
  loadClientContext,
  referenceRows,
  reliabilityRows,
  toReference,
  toReliability,
} from './assessments';
import { authorizeClient } from './authz';
import type { RequestContext } from './context';
import { formulasInForce } from './formulas';
import { secured } from './rls';
import { parse } from './validation';

const { assessments, assessmentResults, assessmentTests, derivedMetrics, clientGroups } = schema;

interface Item {
  slug: string;
  name: string;
  unit: string;
  direction: Direction;
  testId: string | null;
}

/** Values of each test (mean of sides when sided) and derived formula of some assessments. */
async function valuesOf(ctx: RequestContext, ids: string[]) {
  const out = new Map<string, Map<string, number>>(ids.map((id) => [id, new Map()]));
  if (!ids.length) return out;
  const [results, derived] = await Promise.all([
    ctx.db
      .select({
        assessmentId: assessmentResults.assessmentId,
        slug: assessmentTests.slug,
        side: assessmentResults.side,
        value: assessmentResults.value,
      })
      .from(assessmentResults)
      .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
      .where(
        and(
          inArray(assessmentResults.assessmentId, ids),
          eq(assessmentResults.valid, true),
          isNotNull(assessmentResults.value),
        ),
      ),
    ctx.db
      .select({
        assessmentId: derivedMetrics.assessmentId,
        metric: derivedMetrics.metric,
        value: derivedMetrics.value,
      })
      .from(derivedMetrics)
      .where(inArray(derivedMetrics.assessmentId, ids)),
  ]);
  const sides = new Map<string, number[]>();
  for (const r of results) {
    const m = out.get(r.assessmentId)!;
    if (r.side === 'both') m.set(r.slug, Number(r.value));
    else {
      const k = `${r.assessmentId}|${r.slug}`;
      sides.set(k, [...(sides.get(k) ?? []), Number(r.value)]);
    }
  }
  for (const [k, xs] of sides) {
    const [aid, slug] = k.split('|') as [string, string];
    const m = out.get(aid)!;
    if (!m.has(slug)) m.set(slug, xs.reduce((a, b) => a + b, 0) / xs.length);
  }
  for (const d of derived)
    if (d.assessmentId && !d.metric.includes(':'))
      out.get(d.assessmentId)!.set(d.metric, Number(d.value));
  return out;
}

async function clientComparison_(ctx: RequestContext, clientId: string, query: unknown) {
  const q = parse(comparisonQuerySchema, query ?? {});
  await authorizeClient(ctx, 'assessments:read', clientId);
  const list = await ctx.db
    .select({
      id: assessments.id,
      assessedOn: assessments.assessedOn,
      groupId: assessments.groupId,
      context: assessments.context,
      results: sql<number>`(SELECT count(*)::int FROM assessment_results r WHERE r.assessment_id = assessments.id)`,
    })
    .from(assessments)
    .where(and(eq(assessments.clientId, clientId), sql`${assessments.status} <> 'cancelled'`))
    .orderBy(asc(assessments.assessedOn), asc(assessments.createdAt));
  const withData = list.filter((a) => a.results > 0);
  const pick = (id: string | undefined, fallback: (typeof list)[number] | undefined) => {
    if (!id) return fallback ?? null;
    const a = list.find((x) => x.id === id);
    if (!a) throw new DomainError('not_found', 'Evaluación no encontrada.');
    return a;
  };
  const b = pick(q.b, withData.at(-1));
  // Default A: the earlier assessment with most tests in common with B (else the previous one).
  let a = q.a ? pick(q.a, undefined) : null;
  if (!q.a && b) {
    const earlier = withData.filter((x) => x !== b && x.assessedOn <= b.assessedOn);
    const rows = await ctx.db
      .select({ id: assessmentResults.assessmentId, testId: assessmentResults.testId })
      .from(assessmentResults)
      .where(inArray(assessmentResults.assessmentId, [b.id, ...earlier.map((x) => x.id)]));
    const inB = new Set(rows.filter((r) => r.id === b.id).map((r) => r.testId));
    const shared = earlier.map((x) => ({
      id: x.id,
      n: new Set(rows.filter((r) => r.id === x.id && inB.has(r.testId)).map((r) => r.testId)).size,
    }));
    // Most tests in common with B; the latest one on a tie.
    const overlap = (id: string) => shared.find((y) => y.id === id)?.n ?? 0;
    const best = Math.max(0, ...earlier.map((x) => overlap(x.id)));
    a =
      (best > 0 ? earlier.filter((x) => overlap(x.id) === best).at(-1) : earlier.at(-1)) ??
      withData.filter((x) => x !== b).at(-1) ??
      null;
  }
  const base = {
    assessments: list.map((x) => ({
      id: x.id,
      assessedOn: x.assessedOn,
      context: x.context,
      hasResults: x.results > 0,
    })),
    scales: Object.entries(SCALE_LABELS).map(([value, label]) => ({ value, label })),
  };
  if (!b)
    return {
      ...base,
      a: null,
      b: null,
      scale: null,
      basis: null,
      dimensions: [],
      allDimensions: ALL_DIMENSIONS.map((d) => ({ key: d.key, name: d.name })),
      items: [],
      notes: ['Sin evaluaciones con resultados.'],
    };

  const [cc, formulas] = await Promise.all([
    loadClientContext(ctx, clientId, false),
    formulasInForce(ctx.db, ctx.actor.organizationId),
  ]);

  // The group: B's own group session, or the client's most recent one.
  let group: { id: string; name: string; date: string; ids: string[] } | null = null;
  const anchor = b.groupId ? b : list.filter((x) => x.groupId).at(-1);
  if (anchor?.groupId) {
    const gid = anchor.groupId;
    const date = anchor.assessedOn;
    const [g] = await ctx.db
      .select({ id: clientGroups.id, name: clientGroups.name })
      .from(clientGroups)
      .where(eq(clientGroups.id, gid));
    const members = await ctx.db
      .select({ id: assessments.id })
      .from(assessments)
      .where(
        and(
          eq(assessments.groupId, gid),
          eq(assessments.assessedOn, date),
          sql`${assessments.status} <> 'cancelled'`,
        ),
      );
    if (g) group = { id: g.id, name: g.name, date, ids: members.map((m) => m.id) };
  }
  const ids = [...new Set([b.id, ...(a ? [a.id] : []), ...(group?.ids ?? [])])];
  const values = await valuesOf(ctx, ids);
  const vA = a ? values.get(a.id)! : new Map<string, number>();
  const vB = values.get(b.id)!;

  // Items present in A or B: tests and formulas, with their direction.
  const slugs = [...new Set([...vA.keys(), ...vB.keys()])];
  const tests = slugs.length
    ? await ctx.db
        .select({
          id: assessmentTests.id,
          slug: assessmentTests.slug,
          name: assessmentTests.name,
          unit: assessmentTests.unit,
          direction: assessmentTests.betterDirection,
          organizationId: assessmentTests.organizationId,
        })
        .from(assessmentTests)
        .where(inArray(assessmentTests.slug, slugs))
        .orderBy(desc(assessmentTests.organizationId))
    : [];
  const items = new Map<string, Item>();
  for (const t of tests)
    if (
      !items.has(t.slug) &&
      (t.organizationId === null || t.organizationId === ctx.actor.organizationId)
    )
      items.set(t.slug, {
        slug: t.slug,
        name: t.name,
        unit: t.unit,
        direction: t.direction,
        testId: t.id,
      });
  for (const f of formulas)
    if (slugs.includes(f.slug) && !items.has(f.slug))
      items.set(f.slug, {
        slug: f.slug,
        name: f.name,
        unit: f.unit,
        direction: f.better,
        testId: null,
      });

  // References (mean ± SD or median) applicable to this client, per test.
  const testIds = [...items.values()].flatMap((i) => (i.testId ? [i.testId] : []));
  const [refs, rels] = await Promise.all([
    referenceRows(ctx.db, testIds),
    reliabilityRows(ctx.db, testIds),
  ]);
  const refFor = (testId: string | null) => {
    if (!testId) return null;
    for (const r of refs.filter((x) => x.v.testId === testId)) {
      const ref = toReference(r);
      if (!referenceApplicability(ref, cc.subject, null).applicable) continue;
      const v = ref.values as Record<string, unknown>;
      const mean = typeof v.mean === 'number' ? v.mean : null;
      const sd = typeof v.sd === 'number' ? v.sd : null;
      const median = typeof v.median === 'number' ? v.median : null;
      if (mean == null && median == null) continue;
      return {
        mean,
        sd,
        center: mean ?? median!,
        label: `${r.population} · ${citation(r.source)}${r.source.doi ? `, doi:${r.source.doi}` : ''}`,
      };
    }
    return null;
  };

  const groupValues = (slug: string) =>
    (group?.ids ?? []).flatMap((id) => {
      const x = values.get(id)?.get(slug);
      return x == null ? [] : [x];
    });
  const scale: Scale = q.scale === 'auto' ? (group ? 'z_group' : 'z_reference') : q.scale;
  const basisOf = (it: Item): { basis: Basis; label: string } | null => {
    if (scale === 'z_group' || scale === 'percentile') {
      const xs = groupValues(it.slug);
      return group && xs.length >= 2
        ? { basis: { scale, values: xs }, label: `${group.name} (${xs.length} personas)` }
        : null;
    }
    const ref = refFor(it.testId);
    if (!ref) return null;
    if (scale === 'z_reference')
      return ref.mean != null && ref.sd != null
        ? { basis: { scale, mean: ref.mean, sd: ref.sd }, label: ref.label }
        : null;
    return { basis: { scale, reference: ref.center }, label: ref.label };
  };

  const rows = [...items.values()].map((it) => {
    const basis = basisOf(it);
    const rawA = vA.get(it.slug) ?? null;
    const rawB = vB.get(it.slug) ?? null;
    let change: ChangeInterpretation | null = null;
    if (rawA != null && rawB != null) {
      const err = it.testId
        ? pickMeasurementError(
            toReliability(
              rels.filter((x) => x.r.testId === it.testId),
              cc.subject,
            ),
            it.unit,
            rawA,
            null,
          )
        : null;
      change = interpretChange(rawA, rawB, it.direction, err);
    }
    return {
      slug: it.slug,
      name: it.name,
      unit: it.unit,
      direction: it.direction,
      rawA,
      rawB,
      scoreA: basis ? scoreOf(rawA, it.direction, basis.basis) : null,
      scoreB: basis ? scoreOf(rawB, it.direction, basis.basis) : null,
      basis: basis?.label ?? null,
      change,
    };
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  // Dimensions: those asked for, or the default set with more data in B.
  let dims: RadarDimension[];
  if (q.dims?.length) dims = ALL_DIMENSIONS.filter((d) => q.dims!.includes(d.key));
  else {
    const covered = (set: RadarDimension[]) =>
      set.filter((d) => d.items.some((i) => bySlug.get(i.slug)?.scoreB != null)).length;
    dims =
      covered(DIMENSION_SETS.health) > covered(DIMENSION_SETS.performance)
        ? DIMENSION_SETS.health
        : DIMENSION_SETS.performance;
  }
  const dimensions = dims.map((d) => {
    const score = (k: 'scoreA' | 'scoreB') =>
      dimensionScore(d.items.map((i) => ({ ...i, score: bySlug.get(i.slug)?.[k] ?? null })));
    const A = score('scoreA');
    const B = score('scoreB');
    return {
      key: d.key,
      name: d.name,
      scoreA: A.score,
      scoreB: B.score,
      usedA: A.used,
      usedB: B.used,
      items: d.items
        .filter((i) => bySlug.has(i.slug))
        .map((i) => ({ slug: i.slug, weight: i.weight })),
    };
  });

  const notes: string[] = [];
  if ((scale === 'z_group' || scale === 'percentile') && !group)
    notes.push('El cliente no está en ningún grupo evaluado: elige una escala de referencia.');
  if (group && group.ids.length < 5)
    notes.push(
      `Grupo pequeño (${group.ids.length}): la Z y el percentil cambian mucho con una sola persona.`,
    );
  if (!rows.some((r) => r.scoreB != null))
    notes.push('Ningún test tiene base de comparación con esta escala: prueba otra.');

  return {
    ...base,
    a: a ? { id: a.id, assessedOn: a.assessedOn } : null,
    b: { id: b.id, assessedOn: b.assessedOn },
    scale: {
      value: scale,
      label: SCALE_LABELS[scale],
      neutral: NEUTRAL[scale],
      range: SCALE_RANGE[scale],
    },
    basis:
      group && (scale === 'z_group' || scale === 'percentile')
        ? { kind: 'group' as const, label: `${group.name}, ${group.date}` }
        : { kind: 'reference' as const, label: 'Referencias aplicables a este cliente' },
    dimensions,
    allDimensions: ALL_DIMENSIONS.map((d) => ({ key: d.key, name: d.name })),
    items: rows.sort((x, y) => x.name.localeCompare(y.name, 'es')),
    notes,
  };
}
export type ClientComparison = Awaited<ReturnType<typeof clientComparison_>>;

export const clientComparison = secured(clientComparison_);
