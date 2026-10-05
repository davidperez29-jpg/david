/**
 * Derived formulas as data (restructure phase 4, docs/EVALUATION_SYSTEM.md §1): the platform's
 * catalogue plus the centre's own copies. A copy with the slug of a global formula replaces it
 * for that centre («constantes editables», like the club workbook); deleting it restores the
 * platform's formula. Values already computed keep the formula text they were computed with.
 */
import { formulaSchema, formulaSlugSchema } from '@tp/contracts';
import { schema, type Executor } from '@tp/db';
import {
  compileFormulas,
  DomainError,
  formulaText,
  type CompiledFormula,
  type FormulaDef,
} from '@tp/domain';
import { and, eq, isNull, or } from 'drizzle-orm';
import { writeAudit } from './audit';
import { requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { parse } from './validation';

const { derivedFormulas, assessmentTests } = schema;

type Row = typeof derivedFormulas.$inferSelect;

const toDef = (r: Row): FormulaDef => ({
  slug: r.slug,
  name: r.name,
  unit: r.unit,
  expression: r.expression,
  constants: r.constants,
  better: r.betterDirection,
  isEstimate: r.isEstimate,
  errorModel: r.errorModel,
  definition: r.definition,
  sex: (r.sex as 'male' | 'female' | null) ?? null,
});

/** Visible rows: the centre's copy wins over the global formula with the same slug. */
async function effectiveRows(db: Executor, organizationId: string): Promise<Row[]> {
  const rows = await db
    .select()
    .from(derivedFormulas)
    .where(
      and(
        or(
          isNull(derivedFormulas.organizationId),
          eq(derivedFormulas.organizationId, organizationId),
        ),
        eq(derivedFormulas.status, 'published'),
      ),
    );
  const bySlug = new Map<string, Row>();
  for (const r of rows) if (!bySlug.has(r.slug) || r.organizationId !== null) bySlug.set(r.slug, r);
  return [...bySlug.values()];
}

/**
 * The formulas in force for a centre, compiled in dependency order. Rows are validated when
 * saved; one that no longer compiles (e.g. a test was renamed) is left out instead of breaking
 * every assessment.
 */
export async function formulasInForce(
  db: Executor,
  organizationId: string,
): Promise<(CompiledFormula & { id: string; version: number; own: boolean })[]> {
  const rows = await effectiveRows(db, organizationId);
  const meta = new Map(rows.map((r) => [r.slug, r]));
  let defs = rows.map(toDef);
  for (;;) {
    try {
      return compileFormulas(defs).map((f) => {
        const r = meta.get(f.slug)!;
        return { ...f, id: r.id, version: r.version, own: r.organizationId !== null };
      });
    } catch (e) {
      // Drop the formula named in the error (and retry); never loop forever.
      const bad = defs.find((d) => e instanceof Error && e.message.includes(`«${d.name}»`));
      if (!bad) return [];
      defs = defs.filter((d) => d !== bad);
    }
  }
}

/** The definition shown next to a value: plain language plus the expression with its constants. */
export const formulaDescription = (
  f: Pick<FormulaDef, 'definition' | 'expression' | 'constants'>,
) =>
  Object.keys(f.constants).length ? `${f.definition} Cálculo: ${formulaText(f)}.` : f.definition;

async function listFormulas_(ctx: RequestContext) {
  const rows = await effectiveRows(ctx.db, ctx.actor.organizationId);
  const globals = await ctx.db
    .select({ slug: derivedFormulas.slug, constants: derivedFormulas.constants })
    .from(derivedFormulas)
    .where(isNull(derivedFormulas.organizationId));
  const original = new Map(globals.map((g) => [g.slug, g.constants]));
  return rows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      unit: r.unit,
      expression: r.expression,
      constants: r.constants,
      platformConstants: original.get(r.slug) ?? null,
      betterDirection: r.betterDirection,
      isEstimate: r.isEstimate,
      sex: r.sex,
      definition: r.definition,
      text: formulaText(toDef(r)),
      own: r.organizationId !== null,
      version: r.version,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
export type FormulaListItem = Awaited<ReturnType<typeof listFormulas_>>[number];

/**
 * Saves the centre's version of a formula (constants, or a whole new formula). It must compile
 * together with every other formula in force: unknown names and cycles are rejected.
 */
async function saveFormula_(ctx: RequestContext, slugInput: string, input: unknown) {
  const slug = parse(formulaSlugSchema, slugInput);
  const d = parse(formulaSchema, input);
  requirePermission(ctx, 'assessments:catalog', { organizationId: ctx.actor.organizationId });
  const org = ctx.actor.organizationId;
  const rows = await effectiveRows(ctx.db, org);
  const current = rows.find((r) => r.slug === slug);
  if (
    current &&
    current.organizationId !== null &&
    d.expectedVersion !== undefined &&
    d.expectedVersion !== current.version
  )
    throw new DomainError('conflict', 'Otra persona ha cambiado esta fórmula. Recarga la página.');
  const def: FormulaDef = {
    slug,
    name: d.name ?? current?.name ?? slug,
    unit: d.unit ?? current?.unit ?? '',
    expression: d.expression ?? current?.expression ?? '',
    constants: d.constants ?? current?.constants ?? {},
    better: d.betterDirection ?? current?.betterDirection ?? 'higher',
    isEstimate: d.isEstimate ?? current?.isEstimate ?? false,
    errorModel: current?.errorModel ?? 'none',
    definition: d.definition ?? current?.definition ?? '',
    sex: d.sex === undefined ? ((current?.sex as 'male' | 'female' | null) ?? null) : d.sex,
  };
  if (!def.expression || !def.name)
    throw new DomainError('validation', 'La fórmula necesita nombre y expresión.');
  const tests = new Set(
    (
      await ctx.db
        .select({ slug: assessmentTests.slug })
        .from(assessmentTests)
        .where(or(isNull(assessmentTests.organizationId), eq(assessmentTests.organizationId, org)))
    ).map((t) => t.slug),
  );
  if (tests.has(slug) && !current)
    throw new DomainError('validation', `«${slug}» ya es el nombre de un test.`);
  compileFormulas([...rows.filter((r) => r.slug !== slug).map(toDef), def], (n) => tests.has(n));
  const values = {
    name: def.name,
    unit: def.unit,
    expression: def.expression,
    constants: def.constants,
    betterDirection: def.better,
    isEstimate: def.isEstimate,
    errorModel: def.errorModel,
    sex: def.sex ?? null,
    definition: def.definition,
    status: 'published' as const,
    updatedBy: ctx.actor.userId,
  };
  let id: string;
  if (current && current.organizationId !== null) {
    id = current.id;
    await ctx.db
      .update(derivedFormulas)
      .set({ ...values, version: current.version + 1, updatedAt: new Date() })
      .where(eq(derivedFormulas.id, id));
  } else {
    const [row] = await ctx.db
      .insert(derivedFormulas)
      .values({ ...values, organizationId: org, slug, createdBy: ctx.actor.userId })
      .returning({ id: derivedFormulas.id });
    id = row!.id;
  }
  await writeAudit(ctx.db, ctx, {
    action: current?.organizationId ? 'update' : 'create',
    entityType: 'derived_formula',
    entityId: id,
    changes: { slug, expression: def.expression, constants: def.constants },
  });
  return { id };
}

/** Deletes the centre's copy: the platform's formula (if any) is in force again. */
async function resetFormula_(ctx: RequestContext, slugInput: string) {
  const slug = parse(formulaSlugSchema, slugInput);
  requirePermission(ctx, 'assessments:catalog', { organizationId: ctx.actor.organizationId });
  const [row] = await ctx.db
    .delete(derivedFormulas)
    .where(
      and(
        eq(derivedFormulas.organizationId, ctx.actor.organizationId),
        eq(derivedFormulas.slug, slug),
      ),
    )
    .returning({ id: derivedFormulas.id });
  if (!row) throw new DomainError('not_found', 'Esta fórmula no tiene versión propia del centro.');
  // Removing a formula others depend on is refused (the transaction rolls back).
  const remaining = await effectiveRows(ctx.db, ctx.actor.organizationId);
  compileFormulas(remaining.map(toDef));
  await writeAudit(ctx.db, ctx, {
    action: 'delete',
    entityType: 'derived_formula',
    entityId: row.id,
    changes: { slug },
  });
}

export const listFormulas = secured(listFormulas_);
export const saveFormula = secured(saveFormula_);
export const resetFormula = secured(resetFormula_);
