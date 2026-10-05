/**
 * Groups and teams (restructure phase 4, docs/EVALUATION_SYSTEM.md §3): a team assessed on one
 * date (one assessment per member, the «hoja de intentos») and the group report that reproduces
 * the club workbook: N, mean, reference, SD, max, min, best, worst, Z against the team with its
 * band, and values to confirm. Staff only: a client never sees the group or the others.
 */
import {
  groupAssessmentSchema,
  groupMembersSchema,
  groupReportQuerySchema,
  groupSchema,
  updateGroupSchema,
} from '@tp/contracts';
import { schema } from '@tp/db';
import {
  bandOf,
  bestAndWorst,
  DomainError,
  groupStats,
  measurementFlags,
  MIN_GROUP_FOR_Z,
  zAgainstGroup,
  type Band,
  type Direction,
  type Flag,
} from '@tp/domain';
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { citation, createAssessmentInTx, referenceRows } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient } from './authz';
import type { RequestContext } from './context';
import { formulasInForce } from './formulas';
import { secured } from './rls';
import { parse } from './validation';

const {
  clientGroups,
  clientGroupMembers,
  clients,
  assessments,
  assessmentResults,
  assessmentTests,
  derivedMetrics,
} = schema;

const staffOnly = (ctx: RequestContext) => {
  if (!ctx.actor.roles.includes('ADMIN') && !ctx.actor.roles.includes('TRAINER'))
    throw new DomainError('forbidden', 'No tienes permiso para esta acción.');
};

async function loadGroup(ctx: RequestContext, id: string) {
  staffOnly(ctx);
  const [g] = await ctx.db
    .select()
    .from(clientGroups)
    .where(and(eq(clientGroups.id, id), eq(clientGroups.organizationId, ctx.actor.organizationId)));
  if (!g) throw new DomainError('not_found', 'Grupo no encontrado.');
  return g;
}

async function listGroups_(ctx: RequestContext, opts: { archived?: boolean } = {}) {
  staffOnly(ctx);
  const rows = await ctx.db
    .select({
      g: clientGroups,
      members: sql<number>`(SELECT count(*)::int FROM client_group_members m WHERE m.group_id = client_groups.id)`,
      lastAssessedOn: sql<
        string | null
      >`(SELECT max(a.assessed_on)::text FROM assessments a WHERE a.group_id = client_groups.id AND a.status <> 'cancelled')`,
    })
    .from(clientGroups)
    .where(
      and(
        eq(clientGroups.organizationId, ctx.actor.organizationId),
        opts.archived ? undefined : isNull(clientGroups.archivedAt),
      ),
    )
    .orderBy(asc(clientGroups.name));
  return rows.map((r) => ({
    id: r.g.id,
    name: r.g.name,
    description: r.g.description,
    archived: r.g.archivedAt !== null,
    members: r.members,
    lastAssessedOn: r.lastAssessedOn,
  }));
}
export type GroupListItem = Awaited<ReturnType<typeof listGroups_>>[number];

async function getGroup_(ctx: RequestContext, id: string) {
  const g = await loadGroup(ctx, id);
  const [members, sessions] = await Promise.all([
    ctx.db
      .select({
        clientId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        role: clientGroupMembers.role,
      })
      .from(clientGroupMembers)
      .innerJoin(clients, eq(clients.id, clientGroupMembers.clientId))
      .where(eq(clientGroupMembers.groupId, id))
      .orderBy(asc(clients.lastName), asc(clients.firstName)),
    ctx.db
      .select({ assessedOn: assessments.assessedOn, n: count() })
      .from(assessments)
      .where(and(eq(assessments.groupId, id), sql`${assessments.status} <> 'cancelled'`))
      .groupBy(assessments.assessedOn)
      .orderBy(sql`${assessments.assessedOn} DESC`),
  ]);
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    archived: g.archivedAt !== null,
    version: g.version,
    members: members.map((m) => ({ ...m, name: `${m.firstName} ${m.lastName}` })),
    sessions: sessions.map((x) => ({ assessedOn: x.assessedOn, assessments: x.n })),
  };
}
export type GroupDetail = Awaited<ReturnType<typeof getGroup_>>;

async function createGroup_(ctx: RequestContext, input: unknown) {
  const d = parse(groupSchema, input);
  staffOnly(ctx);
  const [dup] = await ctx.db
    .select({ id: clientGroups.id })
    .from(clientGroups)
    .where(
      and(eq(clientGroups.organizationId, ctx.actor.organizationId), eq(clientGroups.name, d.name)),
    );
  if (dup)
    throw new DomainError('validation', 'Ya hay un grupo con ese nombre.', { name: ['duplicate'] });
  const [row] = await ctx.db
    .insert(clientGroups)
    .values({
      organizationId: ctx.actor.organizationId,
      name: d.name,
      description: d.description ?? null,
      createdBy: ctx.actor.userId,
    })
    .returning({ id: clientGroups.id });
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'client_group',
    entityId: row!.id,
    changes: { name: d.name },
  });
  return { id: row!.id };
}

async function updateGroup_(ctx: RequestContext, id: string, input: unknown) {
  const { expectedVersion, archived, ...d } = parse(updateGroupSchema, input);
  const g = await loadGroup(ctx, id);
  if (g.version !== expectedVersion)
    throw new DomainError('conflict', 'El grupo ha cambiado. Recarga la página.');
  await ctx.db
    .update(clientGroups)
    .set({
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? ctx.now() : null } : {}),
      version: g.version + 1,
      updatedBy: ctx.actor.userId,
      updatedAt: ctx.now(),
    })
    .where(eq(clientGroups.id, id));
  await writeAudit(ctx.db, ctx, {
    action: archived ? 'archive' : 'update',
    entityType: 'client_group',
    entityId: id,
    changes: { ...d, ...(archived !== undefined ? { archived } : {}) },
  });
}

/** Adds and removes members (each one must be a client this person can access). */
async function setGroupMembers_(ctx: RequestContext, id: string, input: unknown) {
  const d = parse(groupMembersSchema, input);
  await loadGroup(ctx, id);
  for (const clientId of [...d.add, ...d.remove])
    await authorizeClient(ctx, 'clients:write', clientId);
  if (d.add.length)
    await ctx.db
      .insert(clientGroupMembers)
      .values(
        [...new Set(d.add)].map((clientId) => ({
          organizationId: ctx.actor.organizationId,
          groupId: id,
          clientId,
        })),
      )
      .onConflictDoNothing();
  if (d.remove.length)
    await ctx.db
      .delete(clientGroupMembers)
      .where(
        and(eq(clientGroupMembers.groupId, id), inArray(clientGroupMembers.clientId, d.remove)),
      );
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'client_group',
    entityId: id,
    changes: { added: d.add.length, removed: d.remove.length },
  });
}

/**
 * Assesses the whole group on one date: one assessment per member with the same tests (members
 * who already have one that day for this group are skipped, so repeating it is harmless).
 */
async function createGroupAssessment_(ctx: RequestContext, id: string, input: unknown) {
  const d = parse(groupAssessmentSchema, input);
  const g = await getGroup_(ctx, id);
  if (!g.members.length)
    throw new DomainError(
      'validation',
      'El grupo no tiene miembros: añade primero a los jugadores.',
    );
  if (!d.batteryId && !d.testIds.length)
    throw new DomainError('validation', 'Elige una batería o al menos un test.', {
      testIds: ['required'],
    });
  const existing = new Set(
    (
      await ctx.db
        .select({ clientId: assessments.clientId })
        .from(assessments)
        .where(
          and(
            eq(assessments.groupId, id),
            eq(assessments.assessedOn, d.assessedOn),
            sql`${assessments.status} <> 'cancelled'`,
          ),
        )
    ).map((r) => r.clientId),
  );
  let created = 0;
  for (const m of g.members) {
    if (existing.has(m.clientId)) continue;
    await createAssessmentInTx(ctx, m.clientId, { ...d, context: d.context ?? g.name }, id);
    created++;
  }
  return { created, skipped: g.members.length - created, assessedOn: d.assessedOn };
}

export interface GroupReportRow {
  key: string;
  kind: 'test' | 'formula' | 'asymmetry';
  name: string;
  unit: string;
  category: string;
  direction: Direction;
  isEstimate: boolean;
  /** Test id (attempts sheet); null for formulas and asymmetries. */
  testId: string | null;
  side: 'both' | 'left' | 'right';
  values: (number | null)[];
  n: number;
  mean: number | null;
  sd: number | null;
  max: number | null;
  min: number | null;
  best: number | null;
  worst: number | null;
  z: (number | null)[];
  bands: (Band | null)[];
  flags: (Flag | null)[];
  references: string[];
  definition: string | null;
}

const CATEGORY_ORDER = [
  'body_composition',
  'speed',
  'cod',
  'agility',
  'endurance',
  'strength',
  'power',
  'mobility',
  'balance',
  'functional',
  'questionnaire',
];

/** The group report for one date (the club workbook's «Informe grupal», computed). */
async function groupReport_(ctx: RequestContext, id: string, query: unknown) {
  const { date } = parse(groupReportQuerySchema, query);
  const g = await getGroup_(ctx, id);
  const list = await ctx.db
    .select({
      id: assessments.id,
      clientId: assessments.clientId,
      plannedTestIds: assessments.plannedTestIds,
      status: assessments.status,
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.groupId, id),
        eq(assessments.assessedOn, date),
        sql`${assessments.status} <> 'cancelled'`,
      ),
    );
  const byClient = new Map(list.map((a) => [a.clientId, a]));
  const members = g.members
    .filter((m) => byClient.has(m.clientId))
    .map((m) => ({ ...m, assessmentId: byClient.get(m.clientId)!.id }));
  const ids = members.map((m) => m.assessmentId);
  const testIds = [...new Set(list.flatMap((a) => a.plannedTestIds))];
  const [results, derived, tests, refs, formulas] = await Promise.all([
    ids.length
      ? ctx.db
          .select({
            assessmentId: assessmentResults.assessmentId,
            testId: assessmentResults.testId,
            side: assessmentResults.side,
            value: assessmentResults.value,
            valid: assessmentResults.valid,
            attempts: assessmentResults.attempts,
            id: assessmentResults.id,
          })
          .from(assessmentResults)
          .where(inArray(assessmentResults.assessmentId, ids))
      : Promise.resolve([]),
    ids.length
      ? ctx.db
          .select({
            assessmentId: derivedMetrics.assessmentId,
            metric: derivedMetrics.metric,
            value: derivedMetrics.value,
            unit: derivedMetrics.unit,
            formula: derivedMetrics.formula,
            isEstimate: derivedMetrics.isEstimate,
          })
          .from(derivedMetrics)
          .where(inArray(derivedMetrics.assessmentId, ids))
      : Promise.resolve([]),
    testIds.length
      ? ctx.db.select().from(assessmentTests).where(inArray(assessmentTests.id, testIds))
      : Promise.resolve([]),
    referenceRows(ctx.db, testIds),
    formulasInForce(ctx.db, ctx.actor.organizationId),
  ]);
  const col = (pick: (assessmentId: string) => number | null) =>
    members.map((m) => pick(m.assessmentId));
  const build = (
    base: Omit<
      GroupReportRow,
      'n' | 'mean' | 'sd' | 'max' | 'min' | 'best' | 'worst' | 'z' | 'bands' | 'flags'
    >,
    limits?: { min: number | null; max: number | null },
  ): GroupReportRow => {
    const s = groupStats(base.values);
    const bw = bestAndWorst(base.values, base.direction);
    const z = zAgainstGroup(base.values, base.direction);
    return {
      ...base,
      ...s,
      best: bw?.best ?? null,
      worst: bw?.worst ?? null,
      z,
      bands: z.map((x) => bandOf(x)),
      flags: measurementFlags(base.values, limits),
    };
  };
  const refText = (testId: string) =>
    refs
      .filter((r) => r.v.testId === testId)
      .map((r) => {
        const v = r.v.values as Record<string, number>;
        const stat =
          v.mean != null
            ? `${v.mean}${v.sd != null ? ` ± ${v.sd}` : ''}`
            : v.median != null
              ? `mediana ${v.median}`
              : Object.entries(v)
                  .map(([k, x]) => `${k} ${x}`)
                  .join(', ');
        const who = [
          r.population,
          r.v.sex === 'male' ? 'hombres' : r.v.sex === 'female' ? 'mujeres' : null,
          r.v.level,
          r.v.sport,
        ]
          .filter(Boolean)
          .join(', ');
        return `${stat} ${r.v.unit} (${who}; ${citation(r.source)}${r.source.doi ? `, doi:${r.source.doi}` : ''})${r.v.condition ? `. Condición: ${r.v.condition}` : ''}${r.v.limitations ? `. Limitaciones: ${r.v.limitations}` : ''}`;
      });
  const rows: GroupReportRow[] = [];
  const sortedTests = [...tests].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      testIds.indexOf(a.id) - testIds.indexOf(b.id),
  );
  const num = (v: string | null) => (v == null ? null : Number(v));
  /** A formula sits with the tests it starts from (Σ pliegues → % graso → body composition). */
  const categoryOf = (slug: string, seen = new Set<string>()): string | null => {
    const t = tests.find((x) => x.slug === slug);
    if (t) return t.category;
    const f = formulas.find((x) => x.slug === slug);
    if (!f || seen.has(slug)) return null;
    seen.add(slug);
    for (const i of f.inputs) {
      const c = categoryOf(i.split('.')[0]!, seen);
      if (c) return c;
    }
    return null;
  };
  const formulaRows = (category: string) => {
    for (const f of formulas) {
      if (categoryOf(f.slug) !== category) continue;
      for (const side of ['', ':left', ':right']) {
        const metric = `${f.slug}${side}`;
        const values = col((aid) =>
          num(derived.find((d) => d.assessmentId === aid && d.metric === metric)?.value ?? null),
        );
        if (values.every((v) => v == null)) continue;
        rows.push(
          build({
            key: metric,
            kind: 'formula',
            name: `${f.name}${side === ':left' ? ' · izquierdo' : side === ':right' ? ' · derecho' : ''}`,
            unit: f.unit,
            category,
            direction: f.better,
            isEstimate: f.isEstimate,
            testId: null,
            side: side ? (side.slice(1) as 'left' | 'right') : 'both',
            values,
            references: [],
            definition: derived.find((d) => d.metric === metric)?.formula ?? f.definition,
          }),
        );
      }
    }
  };
  let lastCategory: string | null = null;
  for (const t of sortedTests) {
    if (lastCategory && lastCategory !== t.category) formulaRows(lastCategory);
    lastCategory = t.category;
    const limits = { min: num(t.plausibleMin), max: num(t.plausibleMax) };
    for (const side of t.sided ? (['right', 'left'] as const) : (['both'] as const)) {
      const values = col((aid) => {
        const r = results.find(
          (x) => x.assessmentId === aid && x.testId === t.id && x.side === side && x.valid,
        );
        return num(r?.value ?? null);
      });
      rows.push(
        build(
          {
            key: `${t.slug}:${side}`,
            kind: 'test',
            name: `${t.name}${side === 'left' ? ' · izquierda' : side === 'right' ? ' · derecha' : ''}`,
            unit: t.unit,
            category: t.category,
            direction: t.betterDirection,
            isEstimate: t.isEstimate,
            testId: t.id,
            side,
            values,
            references: refText(t.id),
            definition: null,
          },
          limits,
        ),
      );
    }
    if (t.sided) {
      const metric = `asymmetry:${t.slug}`;
      const values = col((aid) =>
        num(derived.find((d) => d.assessmentId === aid && d.metric === metric)?.value ?? null),
      );
      if (values.some((v) => v != null))
        rows.push(
          build({
            key: metric,
            kind: 'asymmetry',
            name: `Asimetría · ${t.name}`,
            unit: '%',
            category: t.category,
            direction: 'lower',
            isEstimate: false,
            testId: null,
            side: 'both',
            values,
            references: [],
            definition:
              '(lado mejor − lado peor) / lado mejor × 100. Descriptiva: no predice lesiones. Semáforo orientativo: < 10 % verde · 10–15 % naranja · ≥ 15 % rojo.',
          }),
        );
    }
  }
  if (lastCategory) formulaRows(lastCategory);
  return {
    group: { id: g.id, name: g.name },
    date,
    sessions: g.sessions,
    members: members.map((m) => ({
      clientId: m.clientId,
      name: m.name,
      assessmentId: m.assessmentId,
    })),
    /** Members without an assessment that day (joined later, or skipped). */
    missing: g.members.filter((m) => !byClient.has(m.clientId)).map((m) => m.name),
    smallGroup: members.length < MIN_GROUP_FOR_Z,
    tests: sortedTests.map((t) => ({
      id: t.id,
      name: t.name,
      unit: t.unit,
      sided: t.sided,
      defaultAttempts: t.defaultAttempts,
      aggregation: t.aggregation,
      betterDirection: t.betterDirection,
    })),
    /** Raw attempts for the sheet: assessmentId → testId:side → { id, attempts, valid }. */
    attempts: Object.fromEntries(
      ids.map((aid) => [
        aid,
        Object.fromEntries(
          results
            .filter((r) => r.assessmentId === aid)
            .map((r) => [
              `${r.testId}:${r.side}`,
              { id: r.id, attempts: r.attempts as number[], valid: r.valid },
            ]),
        ),
      ]),
    ),
    rows,
  };
}
export type GroupReport = Awaited<ReturnType<typeof groupReport_>>;

/** Groups a client belongs to (for their page). */
async function clientGroups_(ctx: RequestContext, clientId: string) {
  staffOnly(ctx);
  await authorizeClient(ctx, 'clients:read', clientId);
  return ctx.db
    .select({ id: clientGroups.id, name: clientGroups.name })
    .from(clientGroupMembers)
    .innerJoin(clientGroups, eq(clientGroups.id, clientGroupMembers.groupId))
    .where(eq(clientGroupMembers.clientId, clientId))
    .orderBy(asc(clientGroups.name));
}

export const listGroups = secured(listGroups_);
export const getGroup = secured(getGroup_);
export const createGroup = secured(createGroup_);
export const updateGroup = secured(updateGroup_);
export const setGroupMembers = secured(setGroupMembers_);
export const createGroupAssessment = secured(createGroupAssessment_);
export const groupReport = secured(groupReport_);
export const listClientGroups = secured(clientGroups_);
