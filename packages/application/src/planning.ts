import {
  blockSchema,
  createPlanSchema,
  duplicatePlanSchema,
  duplicateSessionSchema,
  duplicateWeekSchema,
  moveSchema,
  planFromTemplateSchema,
  planStatusSchema,
  revisionSchema,
  saveTemplateSchema,
  sessionExerciseSchema,
  updateBlockSchema,
  updateMicrocycleSchema,
  updatePlanSchema,
  updateSessionExerciseSchema,
  updateSessionSchema,
} from '@tp/contracts';
import { schema, type Executor } from '@tp/db';
import {
  addDays,
  defaultWeekTypes,
  diffFields,
  DomainError,
  expandTemplate,
  hasActiveConsent,
  loadFromPct,
  prescriptionForClient,
  prescriptionShort,
  slugify,
  validateDefinition,
  validatePrescription,
  weekDates,
  weekIndicators,
  weeksFor,
  type ConsentPurpose,
  type IndicatorSession,
  type Prescription,
  type TemplateDefinition,
  type TemplateSession,
  type WeekType,
} from '@tp/domain';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { secured } from './rls';
import { parse } from './validation';

const {
  trainingPlans,
  planRevisions,
  phases,
  mesocycles,
  microcycles,
  sessions,
  sessionBlocks,
  sessionExercises,
  planTemplates,
  exercises,
  exerciseMuscles,
  exerciseEquipment,
  muscles,
  movementPatterns,
  prescriptionProfiles,
  methods,
  clients,
  clientEquipment,
  clientTrainingProfiles,
  consents,
  exerciseTolerances,
  assessmentResults,
  assessmentTests,
  assessments,
} = schema;

const visible = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const s = (v: number | null | undefined) => (v == null ? null : String(v));

/** Numeric prescription columns come back as strings: normalize to the domain shape. */
function toPrescription(r: Record<string, unknown>): Prescription {
  return {
    sets: r.sets as number | null,
    repsMin: r.repsMin as number | null,
    repsMax: r.repsMax as number | null,
    repsPerCluster: r.repsPerCluster as number | null,
    intraClusterRestS: r.intraClusterRestS as number | null,
    durationS: r.durationS as number | null,
    distanceM: n(r.distanceM as string | null),
    contacts: r.contacts as number | null,
    loadKg: n(r.loadKg as string | null),
    loadPct1rm: n(r.loadPct1rm as string | null),
    rirMin: r.rirMin as number | null,
    rirMax: r.rirMax as number | null,
    rpeTarget: n(r.rpeTarget as string | null),
    effortCharacter: r.effortCharacter as string | null,
    velocityTargetMps: n(r.velocityTargetMps as string | null),
    velocityLossPct: r.velocityLossPct as number | null,
    tempo: r.tempo as string | null,
    restS: r.restS as number | null,
    rom: r.rom as Prescription['rom'],
    intensityNote: r.intensityNote as string | null,
    chainLoadKg: n(r.chainLoadKg as string | null),
  };
}
/** Domain prescription → DB columns. */
function toColumns(p: Prescription) {
  return {
    sets: p.sets ?? null,
    repsMin: p.repsMin ?? null,
    repsMax: p.repsMax ?? null,
    repsPerCluster: p.repsPerCluster ?? null,
    intraClusterRestS: p.intraClusterRestS ?? null,
    durationS: p.durationS ?? null,
    distanceM: s(p.distanceM),
    contacts: p.contacts ?? null,
    loadKg: s(p.loadKg),
    loadPct1rm: s(p.loadPct1rm),
    rirMin: p.rirMin ?? null,
    rirMax: p.rirMax ?? null,
    rpeTarget: s(p.rpeTarget),
    effortCharacter: p.effortCharacter ?? null,
    velocityTargetMps: s(p.velocityTargetMps),
    velocityLossPct: p.velocityLossPct ?? null,
    tempo: p.tempo ?? null,
    restS: p.restS ?? null,
    rom: p.rom ?? null,
    intensityNote: p.intensityNote ?? null,
    chainLoadKg: s(p.chainLoadKg),
  };
}

// ── Loading helpers ───────────────────────────────────────────────────────────

async function loadPlan(ctx: RequestContext, id: string, permission: 'plans:read' | 'plans:write') {
  const [p] = await ctx.db.select().from(trainingPlans).where(eq(trainingPlans.id, id));
  if (!p || p.organizationId !== ctx.actor.organizationId || !p.clientId)
    throw new DomainError('not_found', 'Plan no encontrado.');
  try {
    await authorizeClient(ctx, permission, p.clientId);
  } catch (e) {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Plan no encontrado.');
    throw e;
  }
  return p;
}

/** Resolves the plan of any node (session, block, exercise, microcycle) and authorizes on it. */
async function planOfSession(
  ctx: RequestContext,
  sessionId: string,
  permission: 'plans:read' | 'plans:write',
) {
  const [row] = await ctx.db
    .select({ session: sessions, planId: phases.planId })
    .from(sessions)
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .where(eq(sessions.id, sessionId));
  if (!row) throw new DomainError('not_found', 'Sesión no encontrada.');
  const plan = await loadPlan(ctx, row.planId, permission).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Sesión no encontrada.');
    throw e;
  });
  return { session: row.session, plan };
}
async function planOfMicrocycle(
  ctx: RequestContext,
  microcycleId: string,
  permission: 'plans:read' | 'plans:write',
) {
  const [row] = await ctx.db
    .select({ micro: microcycles, planId: phases.planId })
    .from(microcycles)
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .where(eq(microcycles.id, microcycleId));
  if (!row) throw new DomainError('not_found', 'Semana no encontrada.');
  const plan = await loadPlan(ctx, row.planId, permission);
  return { micro: row.micro, plan };
}
async function sessionOfBlock(ctx: RequestContext, blockId: string, permission: 'plans:write') {
  const [b] = await ctx.db.select().from(sessionBlocks).where(eq(sessionBlocks.id, blockId));
  if (!b) throw new DomainError('not_found', 'Bloque no encontrado.');
  return { block: b, ...(await planOfSession(ctx, b.sessionId, permission)) };
}
async function blockOfExercise(ctx: RequestContext, id: string, permission: 'plans:write') {
  const [e] = await ctx.db.select().from(sessionExercises).where(eq(sessionExercises.id, id));
  if (!e) throw new DomainError('not_found', 'Ejercicio no encontrado.');
  return { exercise: e, ...(await sessionOfBlock(ctx, e.blockId, permission)) };
}

async function clientExperience(db: Executor, clientId: string) {
  const [p] = await db
    .select({ e: clientTrainingProfiles.experienceLevel })
    .from(clientTrainingProfiles)
    .where(eq(clientTrainingProfiles.clientId, clientId));
  return p?.e ?? null;
}

/** Latest valid assessment value of a test (e.g. one_rm_back_squat) for %1RM → kg. */
async function latestTestValue(
  db: Executor,
  clientId: string,
  testSlug: string,
): Promise<{ value: number; on: string } | null> {
  const [r] = await db
    .select({ value: assessmentResults.value, on: assessments.assessedOn })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
    .where(
      and(
        eq(assessmentResults.clientId, clientId),
        eq(assessmentTests.slug, testSlug),
        eq(assessmentResults.valid, true),
        eq(assessmentResults.side, 'both'),
        sql`${assessments.status} <> 'cancelled'`,
      ),
    )
    .orderBy(desc(assessments.assessedOn))
    .limit(1);
  return r?.value != null ? { value: Number(r.value), on: r.on } : null;
}

// ── Templates ─────────────────────────────────────────────────────────────────

async function listPlanTemplates_(ctx: RequestContext) {
  requirePermission(ctx, 'plans:templates');
  const rows = await ctx.db
    .select({
      id: planTemplates.id,
      slug: planTemplates.slug,
      name: planTemplates.name,
      description: planTemplates.description,
      goalSlug: planTemplates.goalSlug,
      level: planTemplates.level,
      sessionsPerWeek: planTemplates.sessionsPerWeek,
      durationMonths: planTemplates.durationMonths,
      methodSlugs: planTemplates.methodSlugs,
      organizationId: planTemplates.organizationId,
    })
    .from(planTemplates)
    .where(and(visible(ctx, planTemplates.organizationId), eq(planTemplates.status, 'published')))
    .orderBy(
      asc(planTemplates.goalSlug),
      asc(planTemplates.sessionsPerWeek),
      asc(planTemplates.name),
    );
  return rows.map(({ organizationId, ...r }) => ({ ...r, isGlobal: organizationId === null }));
}
export type PlanTemplateSummary = Awaited<ReturnType<typeof listPlanTemplates_>>[number];

async function resolveExercises(ctx: RequestContext, refs: string[]) {
  const ids = refs.filter((r) => UUID_RE.test(r));
  const slugs = refs.filter((r) => !UUID_RE.test(r));
  const conds = [];
  if (ids.length) conds.push(inArray(exercises.id, ids));
  if (slugs.length)
    conds.push(and(isNull(exercises.organizationId), inArray(exercises.slug, slugs)));
  if (!conds.length)
    return new Map<
      string,
      { id: string; name: string; supportsVbt: boolean; patternId: string | null }
    >();
  const rows = await ctx.db
    .select({
      id: exercises.id,
      slug: exercises.slug,
      name: exercises.name,
      supportsVbt: exercises.supportsVbt,
      patternId: exercises.movementPatternId,
      org: exercises.organizationId,
    })
    .from(exercises)
    .where(and(visible(ctx, exercises.organizationId), or(...conds)));
  const m = new Map<
    string,
    { id: string; name: string; supportsVbt: boolean; patternId: string | null }
  >();
  for (const r of rows) {
    const v = { id: r.id, name: r.name, supportsVbt: r.supportsVbt, patternId: r.patternId };
    m.set(r.id, v);
    if (r.org === null) m.set(r.slug, v);
  }
  return m;
}

async function getPlanTemplate_(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'plans:templates');
  const [t] = await ctx.db
    .select()
    .from(planTemplates)
    .where(and(eq(planTemplates.id, id), visible(ctx, planTemplates.organizationId)));
  if (!t) throw new DomainError('not_found', 'Plantilla no encontrada.');
  const def = t.definition as TemplateDefinition;
  const refs = [
    ...new Set(
      [...def.sessions, ...(def.weeks ?? []).flatMap((w) => w.sessions)].flatMap((x) =>
        x.blocks.flatMap((b) => b.exercises.map((e) => e.exercise)),
      ),
    ),
  ];
  const ex = await resolveExercises(ctx, refs);
  const ms = t.methodSlugs.length
    ? await ctx.db
        .select({ id: methods.id, slug: methods.slug, name: methods.name })
        .from(methods)
        .where(and(isNull(methods.organizationId), inArray(methods.slug, t.methodSlugs)))
    : [];
  const expanded = expandTemplate(def);
  return {
    ...t,
    isGlobal: t.organizationId === null,
    totalWeeks: expanded.totalWeeks,
    methods: ms,
    phases: expanded.phases.map((p) => ({
      name: p.name,
      objective: p.objective ?? null,
      startWeek: p.startWeek,
      endWeek: p.endWeek,
      mesocycles: p.mesocycles.map((m) => ({
        name: m.name,
        weeks: m.weeks,
        focus: m.focus ?? null,
        weekTypes: m.microcycles.map((w) => w.weekType),
      })),
    })),
    sessions: def.sessions.map((x) => ({
      dayLabel: x.dayLabel,
      title: x.title,
      objective: x.objective ?? null,
      blocks: x.blocks.map((b) => ({
        type: b.type,
        label: b.label ?? null,
        exercises: b.exercises.map((e) => ({
          name: ex.get(e.exercise)?.name ?? e.exercise,
          short: prescriptionShort(e.prescription),
          progression: e.progression?.kind ?? 'none',
        })),
      })),
    })),
  };
}
export type PlanTemplateDetail = Awaited<ReturnType<typeof getPlanTemplate_>>;

// ── Materialization (template definition → plan rows) ─────────────────────────

interface Conflict {
  week: number;
  session: string;
  exercise: string;
  message: string;
}

async function materialize(
  ctx: RequestContext,
  tx: Executor,
  plan: { id: string; organizationId: string; clientId: string },
  def: TemplateDefinition,
  opts: { startDate: string | null; weekdays: number[] },
): Promise<{ conflicts: Conflict[]; weeks: number }> {
  const expanded = expandTemplate(def, opts);
  const refs = [
    ...new Set(
      expanded.phases.flatMap((p) =>
        p.mesocycles.flatMap((m) =>
          m.microcycles.flatMap((w) =>
            w.sessions.flatMap((x) => x.blocks.flatMap((b) => b.exercises.map((e) => e.exercise))),
          ),
        ),
      ),
    ),
  ];
  const ex = await resolveExercises(ctx, refs);
  const missing = refs.filter((r) => !ex.has(r));
  if (missing.length)
    throw new DomainError('validation', `Ejercicios no disponibles: ${missing.join(', ')}.`, {
      exercises: missing,
    });

  // Context for conflicts: equipment the client has and tolerances (health data, only with consent).
  const ids = [...new Set([...ex.values()].map((x) => x.id))];
  const [eqClient, eqNeeded] = await Promise.all([
    tx
      .select({ id: clientEquipment.equipmentId })
      .from(clientEquipment)
      .where(eq(clientEquipment.clientId, plan.clientId)),
    ids.length
      ? tx
          .select({
            exerciseId: exerciseEquipment.exerciseId,
            equipmentId: exerciseEquipment.equipmentId,
          })
          .from(exerciseEquipment)
          .where(
            and(inArray(exerciseEquipment.exerciseId, ids), eq(exerciseEquipment.optional, false)),
          )
      : Promise.resolve([]),
  ]);
  const has = new Set(eqClient.map((r) => r.id));
  const cs = await tx.select().from(consents).where(eq(consents.clientId, plan.clientId));
  const healthOk = hasActiveConsent(
    cs.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
  const tol = healthOk
    ? await tx
        .select()
        .from(exerciseTolerances)
        .where(
          and(
            eq(exerciseTolerances.clientId, plan.clientId),
            inArray(exerciseTolerances.kind, ['not_tolerated', 'restricted']),
          ),
        )
    : [];
  const exerciseConflict = (exId: string, patternId: string | null): string | null => {
    const t = tol.find(
      (x) => x.exerciseId === exId || (patternId && x.movementPatternId === patternId),
    );
    if (t)
      return t.kind === 'not_tolerated'
        ? 'Ejercicio o patrón no tolerado por el cliente: sustituir.'
        : 'Ejercicio o patrón con restricción: revisar.';
    if (has.size) {
      const lacking = eqNeeded.filter((r) => r.exerciseId === exId && !has.has(r.equipmentId));
      if (lacking.length) return 'El cliente no tiene el material necesario: sustituir o adaptar.';
    }
    return null;
  };
  const baseCache = new Map<string, { value: number; on: string } | null>();
  const base = async (slug: string) => {
    if (!baseCache.has(slug)) baseCache.set(slug, await latestTestValue(tx, plan.clientId, slug));
    return baseCache.get(slug)!;
  };

  const conflicts: Conflict[] = [];
  const scope = { organizationId: plan.organizationId, clientId: plan.clientId };
  for (const [pi, ph] of expanded.phases.entries()) {
    const [phRow] = await tx
      .insert(phases)
      .values({
        ...scope,
        planId: plan.id,
        position: pi + 1,
        name: ph.name,
        objective: ph.objective ?? null,
        startWeek: ph.startWeek,
        endWeek: ph.endWeek,
        emphasis: ph.emphasis ?? null,
        sessionsPerWeek: ph.sessionsPerWeek ?? null,
      })
      .returning({ id: phases.id });
    for (const [mi, m] of ph.mesocycles.entries()) {
      const [meRow] = await tx
        .insert(mesocycles)
        .values({
          ...scope,
          phaseId: phRow!.id,
          position: mi + 1,
          name: m.name,
          weeks: m.weeks,
          focus: m.focus ?? null,
          assessmentPlanned: m.assessmentPlanned ?? false,
        })
        .returning({ id: mesocycles.id });
      for (const w of m.microcycles) {
        const [miRow] = await tx
          .insert(microcycles)
          .values({
            ...scope,
            mesocycleId: meRow!.id,
            weekIndex: w.weekIndex,
            weekType: w.weekType,
            startDate: w.startDate,
          })
          .returning({ id: microcycles.id });
        for (const [si, sess] of w.sessions.entries()) {
          const [seRow] = await tx
            .insert(sessions)
            .values({
              ...scope,
              microcycleId: miRow!.id,
              dayLabel: sess.dayLabel,
              position: si + 1,
              scheduledDate: sess.date,
              title: sess.title,
              objective: sess.objective ?? null,
              estimatedDurationMin: sess.durationMin ?? null,
              notesForClient: sess.notesForClient ?? null,
              createdBy: ctx.actor.userId,
            })
            .returning({ id: sessions.id });
          for (const [bi, b] of sess.blocks.entries()) {
            const [blRow] = await tx
              .insert(sessionBlocks)
              .values({
                ...scope,
                sessionId: seRow!.id,
                position: bi + 1,
                label: b.label ?? null,
                type: b.type as 'custom',
                organization: (b.organization ?? 'straight_sets') as 'straight_sets',
                rounds: b.rounds ?? null,
                restBetweenRoundsS: b.restBetweenRoundsS ?? null,
                notes: b.notes ?? null,
              })
              .returning({ id: sessionBlocks.id });
            const methodSlugs = [...new Set(b.exercises.flatMap((e) => e.methods ?? []))];
            const methodIds = methodSlugs.length
              ? new Map(
                  (
                    await tx
                      .select({ id: methods.id, slug: methods.slug })
                      .from(methods)
                      .where(
                        and(isNull(methods.organizationId), inArray(methods.slug, methodSlugs)),
                      )
                  ).map((r) => [r.slug, r.id]),
                )
              : new Map<string, string>();
            for (const [ei, e] of b.exercises.entries()) {
              const target = ex.get(e.exercise)!;
              const p: Prescription = { ...e.prescription };
              const notes: string[] = [];
              if (p.loadPct1rm != null && e.loadBasisMetric) {
                const b1 = await base(e.loadBasisMetric);
                if (b1) {
                  p.loadKg = loadFromPct(p.loadPct1rm, b1.value);
                  notes.push(
                    `Carga calculada: ${p.loadPct1rm} % de ${b1.value} kg (evaluación del ${b1.on}).`,
                  );
                } else notes.push('Sin 1RM registrado: prescribir por RIR hasta evaluar.');
              }
              const conflict = exerciseConflict(target.id, target.patternId);
              if (conflict) {
                notes.push(`⚠ ${conflict}`);
                if (w.weekIndex === 1)
                  conflicts.push({
                    week: w.weekIndex,
                    session: sess.title,
                    exercise: target.name,
                    message: conflict,
                  });
              }
              await tx.insert(sessionExercises).values({
                ...scope,
                blockId: blRow!.id,
                exerciseId: target.id,
                position: ei + 1,
                pairingLabel: e.pairingLabel ?? null,
                methodIds: (e.methods ?? [])
                  .map((m) => methodIds.get(m))
                  .filter((x): x is string => !!x),
                ...toColumns(p),
                loadBasisMetric: e.loadBasisMetric ?? null,
                side: e.side ?? 'both',
                notesForClient: e.notesForClient ?? null,
                coachNotes: notes.join(' ') || null,
                source: 'template',
                derived: w.weekIndex > 1 && (e.progression?.kind ?? 'none') !== 'none',
                createdBy: ctx.actor.userId,
              });
            }
          }
        }
      }
    }
  }
  return { conflicts, weeks: expanded.totalWeeks };
}

// ── Plans ─────────────────────────────────────────────────────────────────────

async function listClientPlans_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'plans:read', clientId);
  const rows = await ctx.db
    .select({
      p: trainingPlans,
      weeks: sql<number>`(SELECT count(*)::int FROM microcycles mi JOIN mesocycles me ON me.id = mi.mesocycle_id JOIN phases ph ON ph.id = me.phase_id WHERE ph.plan_id = ${trainingPlans.id})`,
      template: planTemplates.name,
    })
    .from(trainingPlans)
    .leftJoin(planTemplates, eq(planTemplates.id, trainingPlans.basedOnTemplateId))
    .where(and(eq(trainingPlans.clientId, clientId), eq(trainingPlans.kind, 'CLIENT_PLAN')))
    .orderBy(desc(trainingPlans.createdAt));
  return rows.map(({ p, weeks, template }) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    durationMonths: p.durationMonths,
    sessionsPerWeek: p.sessionsPerWeek,
    weeks,
    template,
    revision: p.currentRevision,
  }));
}

async function createPlan_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(createPlanSchema, input);
  await authorizeClient(ctx, 'plans:write', clientId);
  const totalWeeks = d.weeks ?? weeksFor(d.durationMonths);
  if (totalWeeks > weeksFor(d.durationMonths))
    throw new DomainError(
      'validation',
      `Un plan de ${d.durationMonths} meses tiene como máximo ${weeksFor(d.durationMonths)} semanas.`,
      { weeks: ['too_many'] },
    );
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const mesos: { name: string; weeks: number; weekTypes: WeekType[] }[] = [];
  for (let left = totalWeeks, i = 1; left > 0; i++) {
    const w = Math.min(d.mesocycleWeeks, left);
    mesos.push({ name: `Mesociclo ${i}`, weeks: w, weekTypes: defaultWeekTypes(w) });
    left -= w;
  }
  const def: TemplateDefinition = {
    durationMonths: d.durationMonths as 3,
    sessionsPerWeek: d.weekdays.length,
    phases: [{ name: 'Plan', mesocycles: mesos }],
    sessions: d.weekdays.map((_, i) => ({
      dayLabel: labels[i]!,
      title: `Sesión ${labels[i]}`,
      blocks: [],
    })),
  };
  return ctx.db.transaction(async (tx) => {
    const [p] = await tx
      .insert(trainingPlans)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        kind: 'CLIENT_PLAN',
        name: d.name,
        description: d.description ?? null,
        primaryGoalId: d.primaryGoalId ?? null,
        startDate: d.startDate ?? null,
        durationMonths: d.durationMonths,
        endDate: d.startDate ? addDays(d.startDate, 7 * totalWeeks - 1) : null,
        sessionsPerWeek: d.weekdays.length,
        periodizationModel: 'flexible',
        status: 'draft',
        createdBy: ctx.actor.userId,
      })
      .returning({
        id: trainingPlans.id,
        organizationId: trainingPlans.organizationId,
        clientId: trainingPlans.clientId,
      });
    await materialize(
      ctx,
      tx,
      { id: p!.id, organizationId: p!.organizationId, clientId: p!.clientId! },
      def,
      { startDate: d.startDate ?? null, weekdays: d.weekdays },
    );
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'training_plan',
      entityId: p!.id,
      clientId,
      changes: { name: d.name, weeks: totalWeeks, sessionsPerWeek: d.weekdays.length },
    });
    return { id: p!.id };
  });
}

async function createPlanFromTemplate_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ id: string; conflicts: Conflict[]; weeks: number }> {
  const d = parse(planFromTemplateSchema, input);
  await authorizeClient(ctx, 'plans:write', clientId);
  requirePermission(ctx, 'plans:templates');
  const [t] = await ctx.db
    .select()
    .from(planTemplates)
    .where(and(eq(planTemplates.id, d.templateId), visible(ctx, planTemplates.organizationId)));
  if (!t)
    throw new DomainError('validation', 'Plantilla desconocida.', { templateId: ['unknown'] });
  const def = t.definition as TemplateDefinition;
  if (d.weekdays.length !== def.sessionsPerWeek) {
    throw new DomainError(
      'validation',
      `La plantilla tiene ${def.sessionsPerWeek} sesiones por semana: elige ${def.sessionsPerWeek} días.`,
      { weekdays: ['count'] },
    );
  }
  return ctx.db.transaction(async (tx) => {
    const totalWeeks = expandTemplate(def).totalWeeks;
    const [p] = await tx
      .insert(trainingPlans)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        kind: 'CLIENT_PLAN',
        name: d.name ?? t.name,
        description: t.description,
        primaryGoalId: d.primaryGoalId ?? null,
        startDate: d.startDate,
        durationMonths: t.durationMonths,
        endDate: addDays(d.startDate, 7 * totalWeeks - 1),
        sessionsPerWeek: def.sessionsPerWeek,
        periodizationModel: 'flexible',
        status: 'draft',
        basedOnTemplateId: t.id,
        createdBy: ctx.actor.userId,
      })
      .returning({
        id: trainingPlans.id,
        organizationId: trainingPlans.organizationId,
        clientId: trainingPlans.clientId,
      });
    const r = await materialize(
      ctx,
      tx,
      { id: p!.id, organizationId: p!.organizationId, clientId: p!.clientId! },
      def,
      { startDate: d.startDate, weekdays: d.weekdays },
    );
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'training_plan',
      entityId: p!.id,
      clientId,
      changes: {
        template: t.slug,
        startDate: d.startDate,
        weekdays: d.weekdays,
        conflicts: r.conflicts.length,
      },
    });
    return { id: p!.id, ...r };
  });
}

/** Full tree for the plan view and calendar, with descriptive weekly indicators (§12.8). */
async function getPlan_(ctx: RequestContext, id: string) {
  const p = await loadPlan(ctx, id, 'plans:read');
  const [phs, mes, mis, ses] = await Promise.all([
    ctx.db.select().from(phases).where(eq(phases.planId, id)).orderBy(asc(phases.position)),
    ctx.db
      .select({ m: mesocycles })
      .from(mesocycles)
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(phases.planId, id))
      .orderBy(asc(mesocycles.position)),
    ctx.db
      .select({ w: microcycles })
      .from(microcycles)
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(phases.planId, id))
      .orderBy(asc(microcycles.weekIndex)),
    ctx.db
      .select({ s: sessions })
      .from(sessions)
      .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(phases.planId, id))
      .orderBy(asc(microcycles.weekIndex), asc(sessions.position)),
  ]);
  const sessionIds = ses.map((x) => x.s.id);
  const exRows = sessionIds.length
    ? await ctx.db
        .select({
          sessionId: sessionBlocks.sessionId,
          se: sessionExercises,
          name: exercises.name,
          pattern: movementPatterns.slug,
          profile: prescriptionProfiles.slug,
          contactsPerRep: exercises.contactsPerRep,
        })
        .from(sessionExercises)
        .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .leftJoin(movementPatterns, eq(movementPatterns.id, exercises.movementPatternId))
        .leftJoin(
          prescriptionProfiles,
          eq(prescriptionProfiles.id, exercises.prescriptionProfileId),
        )
        .where(inArray(sessionBlocks.sessionId, sessionIds))
    : [];
  const exIds = [...new Set(exRows.map((r) => r.se.exerciseId))];
  const musRows = exIds.length
    ? await ctx.db
        .select({
          exerciseId: exerciseMuscles.exerciseId,
          group: muscles.groupSlug,
          role: exerciseMuscles.role,
        })
        .from(exerciseMuscles)
        .innerJoin(muscles, eq(muscles.id, exerciseMuscles.muscleId))
        .where(inArray(exerciseMuscles.exerciseId, exIds))
    : [];
  const indicatorSession = (sid: string): IndicatorSession => ({
    id: sid,
    exercises: exRows
      .filter((r) => r.sessionId === sid)
      .map((r) => ({
        sets: r.se.sets,
        repsMin: r.se.repsMin,
        repsMax: r.se.repsMax,
        durationS: r.se.durationS,
        distanceM: n(r.se.distanceM),
        contacts: r.se.contacts,
        restS: r.se.restS,
        patternSlug: r.pattern,
        profileSlug: r.profile,
        contactsPerRep: r.contactsPerRep,
        muscles: musRows
          .filter((m) => m.exerciseId === r.se.exerciseId)
          .map((m) => ({ group: m.group, role: m.role })),
      })),
  });
  const weeks = mis.map(({ w }) => {
    const wsessions = ses.filter((x) => x.s.microcycleId === w.id).map((x) => x.s);
    const ind = weekIndicators(wsessions.map((x) => indicatorSession(x.id)));
    return {
      ...w,
      indicators: ind,
      sessions: wsessions.map((x) => ({
        id: x.id,
        dayLabel: x.dayLabel,
        title: x.title,
        scheduledDate: x.scheduledDate,
        exercises: exRows.filter((r) => r.sessionId === x.id).length,
        estimatedMinutes: x.estimatedDurationMin ?? ind.sessionMinutes[x.id] ?? null,
        published: x.published,
      })),
    };
  });
  return {
    ...p,
    phases: phs.map((ph) => ({
      ...ph,
      mesocycles: mes
        .filter((m) => m.m.phaseId === ph.id)
        .map(({ m }) => ({ ...m, weeks: weeks.filter((w) => w.mesocycleId === m.id) })),
    })),
  };
}
export type PlanDetail = Awaited<ReturnType<typeof getPlan_>>;

async function updatePlan_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { expectedVersion, ...d } = parse(updatePlanSchema, input);
  const p = await loadPlan(ctx, id, 'plans:write');
  if (p.version !== expectedVersion)
    throw new DomainError('conflict', 'El plan ha cambiado. Recarga los datos.');
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) values[k] = v;
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(trainingPlans)
      .set({ ...values, version: p.version + 1, updatedBy: ctx.actor.userId })
      .where(eq(trainingPlans.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'training_plan',
      entityId: id,
      clientId: p.clientId,
      changes: diffFields(
        p as unknown as Record<string, unknown>,
        { ...p, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    });
  });
}

// ── Revisions ─────────────────────────────────────────────────────────────────

async function snapshot(ctx: RequestContext, planId: string) {
  const tree = await getPlan_(ctx, planId);
  const ids = tree.phases.flatMap((p) =>
    p.mesocycles.flatMap((m) => m.weeks.flatMap((w) => w.sessions.map((x) => x.id))),
  );
  const exRows = ids.length
    ? await ctx.db
        .select({ se: sessionExercises, sessionId: sessionBlocks.sessionId, name: exercises.name })
        .from(sessionExercises)
        .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .where(inArray(sessionBlocks.sessionId, ids))
    : [];
  return {
    name: tree.name,
    weeks: tree.phases.flatMap((p) =>
      p.mesocycles.flatMap((m) =>
        m.weeks.map((w) => ({
          weekIndex: w.weekIndex,
          weekType: w.weekType,
          sessions: w.sessions.map((x) => ({
            id: x.id,
            title: x.title,
            date: x.scheduledDate,
            exercises: exRows
              .filter((r) => r.sessionId === x.id)
              .map((r) => ({
                id: r.se.id,
                name: r.name,
                p: prescriptionShort(toPrescription(r.se)),
              })),
          })),
        })),
      ),
    ),
  };
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;

function diffSnapshots(a: Snapshot | null, b: Snapshot) {
  if (!a) return { added: 0, removed: 0, changed: 0 };
  const flat = (x: Snapshot) =>
    new Map(
      x.weeks.flatMap((w) =>
        w.sessions.flatMap((s2) => s2.exercises.map((e) => [e.id, `${e.name}|${e.p}`] as const)),
      ),
    );
  const fa = flat(a);
  const fb = flat(b);
  let changed = 0;
  for (const [k, v] of fb) if (fa.has(k) && fa.get(k) !== v) changed++;
  return {
    added: [...fb.keys()].filter((k) => !fa.has(k)).length,
    removed: [...fa.keys()].filter((k) => !fb.has(k)).length,
    changed,
  };
}

async function writeRevision(
  ctx: RequestContext,
  tx: Executor,
  plan: { id: string; organizationId: string; clientId: string | null; currentRevision: number },
  reason: string,
) {
  const [prev] = await tx
    .select()
    .from(planRevisions)
    .where(eq(planRevisions.planId, plan.id))
    .orderBy(desc(planRevisions.revision))
    .limit(1);
  const snap = await snapshot({ ...ctx, db: tx as never }, plan.id);
  const revision = prev ? prev.revision + 1 : 1;
  await tx.insert(planRevisions).values({
    organizationId: plan.organizationId,
    clientId: plan.clientId,
    planId: plan.id,
    revision,
    snapshot: snap,
    diff: diffSnapshots((prev?.snapshot as Snapshot) ?? null, snap),
    reason,
    createdBy: ctx.actor.userId,
  });
  await tx
    .update(trainingPlans)
    .set({ currentRevision: revision })
    .where(eq(trainingPlans.id, plan.id));
  return revision;
}

async function createPlanRevision_(
  ctx: RequestContext,
  planId: string,
  input: unknown,
): Promise<{ revision: number }> {
  const { reason } = parse(revisionSchema, input);
  const p = await loadPlan(ctx, planId, 'plans:write');
  return ctx.db.transaction(async (tx) => {
    const revision = await writeRevision(ctx, tx, p, reason);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'training_plan',
      entityId: planId,
      clientId: p.clientId,
      changes: [{ field: 'revision', before: p.currentRevision, after: revision }],
      reason,
    });
    return { revision };
  });
}

async function listPlanRevisions_(ctx: RequestContext, planId: string) {
  await loadPlan(ctx, planId, 'plans:read');
  const rows = await ctx.db
    .select({
      id: planRevisions.id,
      revision: planRevisions.revision,
      reason: planRevisions.reason,
      diff: planRevisions.diff,
      createdAt: planRevisions.createdAt,
    })
    .from(planRevisions)
    .where(eq(planRevisions.planId, planId))
    .orderBy(desc(planRevisions.revision));
  return rows;
}

/** Activating snapshots revision 1; only one active plan per client. */
async function setPlanStatus_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { status, reason } = parse(planStatusSchema, input);
  const p = await loadPlan(ctx, id, 'plans:write');
  if (status === p.status) return;
  if (status === 'active') {
    const [other] = await ctx.db
      .select({ id: trainingPlans.id, name: trainingPlans.name })
      .from(trainingPlans)
      .where(
        and(
          eq(trainingPlans.clientId, p.clientId!),
          eq(trainingPlans.status, 'active'),
          eq(trainingPlans.kind, 'CLIENT_PLAN'),
        ),
      );
    if (other)
      throw new DomainError(
        'conflict',
        `El cliente ya tiene un plan activo («${other.name}»). Complétalo o archívalo antes.`,
      );
    if (!p.startDate)
      throw new DomainError('validation', 'Indica la fecha de inicio antes de activar el plan.', {
        startDate: ['required'],
      });
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(trainingPlans)
      .set({ status, version: p.version + 1, updatedBy: ctx.actor.userId })
      .where(eq(trainingPlans.id, id));
    if (status === 'active') await writeRevision(ctx, tx, p, reason ?? 'Activación del plan');
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'training_plan',
      entityId: id,
      clientId: p.clientId,
      changes: [{ field: 'status', before: p.status, after: status }],
      reason: reason ?? null,
    });
  });
}

// ── Sessions and the session editor ───────────────────────────────────────────

async function getSession_(ctx: RequestContext, id: string) {
  const { session, plan } = await planOfSession(ctx, id, 'plans:read');
  const [micro] = await ctx.db
    .select()
    .from(microcycles)
    .where(eq(microcycles.id, session.microcycleId));
  const blocks = await ctx.db
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, id))
    .orderBy(asc(sessionBlocks.position));
  const rows = blocks.length
    ? await ctx.db
        .select({
          se: sessionExercises,
          ex: {
            id: exercises.id,
            name: exercises.name,
            supportsVbt: exercises.supportsVbt,
            clientDescription: exercises.clientDescription,
          },
          profile: prescriptionProfiles.slug,
          profileVars: prescriptionProfiles.variableKeys,
        })
        .from(sessionExercises)
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .leftJoin(
          prescriptionProfiles,
          eq(prescriptionProfiles.id, exercises.prescriptionProfileId),
        )
        .where(
          inArray(
            sessionExercises.blockId,
            blocks.map((b) => b.id),
          ),
        )
        .orderBy(asc(sessionExercises.position))
    : [];
  const methodIds = [...new Set(rows.flatMap((r) => r.se.methodIds))];
  const ms = methodIds.length
    ? await ctx.db
        .select({ id: methods.id, name: methods.name })
        .from(methods)
        .where(inArray(methods.id, methodIds))
    : [];
  const experience = await clientExperience(ctx.db, plan.clientId!);
  const siblings = await ctx.db
    .select({ id: microcycles.id, weekIndex: microcycles.weekIndex })
    .from(microcycles)
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .where(eq(phases.planId, plan.id))
    .orderBy(asc(microcycles.weekIndex));
  return {
    ...session,
    plan: { id: plan.id, name: plan.name, status: plan.status, clientId: plan.clientId },
    week: { id: micro!.id, weekIndex: micro!.weekIndex, weekType: micro!.weekType },
    weeks: siblings,
    blocks: blocks.map((b) => ({
      ...b,
      exercises: rows
        .filter((r) => r.se.blockId === b.id)
        .map((r) => {
          const p = toPrescription(r.se);
          return {
            ...r.se,
            prescription: p,
            exercise: r.ex,
            profile: r.profile,
            visibleVariables: r.profileVars ?? [],
            short: prescriptionShort(p),
            clientText: prescriptionForClient(p),
            issues: validatePrescription(p, {
              supportsVbt: r.ex.supportsVbt,
              clientExperience: experience,
            }),
            methods: ms.filter((m) => r.se.methodIds.includes(m.id)),
          };
        }),
    })),
  };
}
export type SessionDetail = Awaited<ReturnType<typeof getSession_>>;

async function updateSession_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const { expectedVersion, ...d } = parse(updateSessionSchema, input);
  const { session, plan } = await planOfSession(ctx, id, 'plans:write');
  if (session.version !== expectedVersion)
    throw new DomainError('conflict', 'La sesión ha cambiado. Recarga los datos.');
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) values[k] = v;
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(sessions)
      .set({ ...values, version: session.version + 1, updatedBy: ctx.actor.userId })
      .where(eq(sessions.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'session',
      entityId: id,
      clientId: plan.clientId,
      changes: diffFields(
        session as unknown as Record<string, unknown>,
        { ...session, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    });
  });
}

async function addBlock_(
  ctx: RequestContext,
  sessionId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(blockSchema, input);
  const { session, plan } = await planOfSession(ctx, sessionId, 'plans:write');
  return ctx.db.transaction(async (tx) => {
    const [{ max } = { max: 0 }] = await tx
      .select({ max: sql<number>`coalesce(max(${sessionBlocks.position}), 0)::int` })
      .from(sessionBlocks)
      .where(eq(sessionBlocks.sessionId, sessionId));
    const [b] = await tx
      .insert(sessionBlocks)
      .values({
        organizationId: session.organizationId,
        clientId: session.clientId,
        sessionId,
        position: max + 1,
        type: d.type,
        organization: d.organization,
        label: d.label ?? null,
        rounds: d.rounds ?? null,
        restBetweenRoundsS: d.restBetweenRoundsS ?? null,
        notes: d.notes ?? null,
      })
      .returning({ id: sessionBlocks.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'session_block',
      entityId: b!.id,
      clientId: plan.clientId,
      changes: { sessionId, type: d.type },
    });
    return { id: b!.id };
  });
}

async function updateBlock_(ctx: RequestContext, blockId: string, input: unknown): Promise<void> {
  const d = parse(updateBlockSchema, input);
  const { block, plan } = await sessionOfBlock(ctx, blockId, 'plans:write');
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) values[k] = v;
  await ctx.db.transaction(async (tx) => {
    await tx.update(sessionBlocks).set(values).where(eq(sessionBlocks.id, blockId));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'session_block',
      entityId: blockId,
      clientId: plan.clientId,
      changes: diffFields(
        block as unknown as Record<string, unknown>,
        { ...block, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    });
  });
}

async function deleteBlock_(ctx: RequestContext, blockId: string): Promise<void> {
  const { block, plan } = await sessionOfBlock(ctx, blockId, 'plans:write');
  await ctx.db.transaction(async (tx) => {
    await tx.delete(sessionBlocks).where(eq(sessionBlocks.id, blockId));
    await renumber(tx, sessionBlocks, sessionBlocks.sessionId, block.sessionId);
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'session_block',
      entityId: blockId,
      clientId: plan.clientId,
    });
  });
}

/** Positions are unique per parent: renumber in two steps to avoid transient duplicates. */
async function renumber(
  tx: Executor,
  table: typeof sessionBlocks | typeof sessionExercises,
  parentCol: AnyPgColumn,
  parentId: string,
) {
  const t = table as typeof sessionBlocks;
  const rows = await tx
    .select({ id: t.id })
    .from(t)
    .where(eq(parentCol, parentId))
    .orderBy(asc(t.position));
  for (const [i, r] of rows.entries())
    await tx
      .update(t)
      .set({ position: 1000 + i })
      .where(eq(t.id, r.id));
  for (const [i, r] of rows.entries())
    await tx
      .update(t)
      .set({ position: i + 1 })
      .where(eq(t.id, r.id));
}

async function swapPositions(
  tx: Executor,
  table: typeof sessionBlocks | typeof sessionExercises,
  parentCol: AnyPgColumn,
  parentId: string,
  id: string,
  direction: 'up' | 'down',
) {
  const t = table as typeof sessionBlocks;
  const rows = await tx
    .select({ id: t.id, position: t.position })
    .from(t)
    .where(eq(parentCol, parentId))
    .orderBy(asc(t.position));
  const i = rows.findIndex((r) => r.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return false;
  await tx.update(t).set({ position: 999 }).where(eq(t.id, rows[i]!.id));
  await tx.update(t).set({ position: rows[i]!.position }).where(eq(t.id, rows[j]!.id));
  await tx.update(t).set({ position: rows[j]!.position }).where(eq(t.id, rows[i]!.id));
  return true;
}

async function moveBlock_(ctx: RequestContext, blockId: string, input: unknown): Promise<void> {
  const { direction } = parse(moveSchema, input);
  const { block } = await sessionOfBlock(ctx, blockId, 'plans:write');
  await ctx.db.transaction(async (tx) => {
    await swapPositions(
      tx,
      sessionBlocks,
      sessionBlocks.sessionId,
      block.sessionId,
      blockId,
      direction,
    );
  });
}

async function checkExercise(ctx: RequestContext, exerciseId: string) {
  const [e] = await ctx.db
    .select({ id: exercises.id, supportsVbt: exercises.supportsVbt, status: exercises.status })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), visible(ctx, exercises.organizationId)));
  if (!e)
    throw new DomainError('validation', 'Ejercicio desconocido.', { exerciseId: ['unknown'] });
  return e;
}

async function checkMethods(ctx: RequestContext, ids: string[]) {
  if (!ids.length) return;
  const ok = await ctx.db
    .select({ id: methods.id })
    .from(methods)
    .where(and(inArray(methods.id, ids), visible(ctx, methods.organizationId)));
  if (ok.length !== new Set(ids).size)
    throw new DomainError('validation', 'Método desconocido.', { methodIds: ['unknown'] });
}

function assertValid(
  p: Prescription,
  supportsVbt: boolean,
  experience: Parameters<typeof validatePrescription>[1]['clientExperience'],
) {
  const issues = validatePrescription(p, { supportsVbt, clientExperience: experience });
  if (Object.keys(issues).length)
    throw new DomainError('validation', 'La prescripción no es válida.', issues);
}

async function addSessionExercise_(
  ctx: RequestContext,
  blockId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(sessionExerciseSchema, input);
  const { block, plan } = await sessionOfBlock(ctx, blockId, 'plans:write');
  const ex = await checkExercise(ctx, d.exerciseId);
  await checkMethods(ctx, d.methodIds);
  assertValid(d.prescription, ex.supportsVbt, await clientExperience(ctx.db, plan.clientId!));
  return ctx.db.transaction(async (tx) => {
    const [{ max } = { max: 0 }] = await tx
      .select({ max: sql<number>`coalesce(max(${sessionExercises.position}), 0)::int` })
      .from(sessionExercises)
      .where(eq(sessionExercises.blockId, blockId));
    const [r] = await tx
      .insert(sessionExercises)
      .values({
        organizationId: block.organizationId,
        clientId: block.clientId,
        blockId,
        exerciseId: d.exerciseId,
        position: max + 1,
        pairingLabel: d.pairingLabel ?? null,
        methodIds: d.methodIds,
        ...toColumns(d.prescription),
        loadBasisMetric: d.loadBasisMetric ?? null,
        side: d.side,
        notesForClient: d.notesForClient ?? null,
        coachNotes: d.coachNotes ?? null,
        source: 'manual',
        createdBy: ctx.actor.userId,
      })
      .returning({ id: sessionExercises.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'session_exercise',
      entityId: r!.id,
      clientId: plan.clientId,
      changes: { exerciseId: d.exerciseId, prescription: prescriptionShort(d.prescription) },
    });
    return { id: r!.id };
  });
}

/**
 * Editing a prescription generated by a template or progression rule is an override (§12.7):
 * it is marked as manual and audited with before/after values and the reason.
 */
async function updateSessionExercise_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { expectedVersion, overrideReason, prescription, ...d } = parse(
    updateSessionExerciseSchema,
    input,
  );
  const { exercise: row, plan } = await blockOfExercise(ctx, id, 'plans:write');
  if (row.version !== expectedVersion)
    throw new DomainError('conflict', 'El ejercicio ha cambiado. Recarga los datos.');
  const exId = d.exerciseId ?? row.exerciseId;
  const ex = await checkExercise(ctx, exId);
  if (d.methodIds) await checkMethods(ctx, d.methodIds);
  const before = toPrescription(row);
  const after = prescription ? { ...before, ...prescription } : before;
  assertValid(after, ex.supportsVbt, await clientExperience(ctx.db, plan.clientId!));
  const isOverride = (row.source !== 'manual' || row.derived) && !!prescription;
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) values[k] = v;
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(sessionExercises)
      .set({
        ...values,
        ...(prescription ? toColumns(after) : {}),
        ...(isOverride ? { source: 'manual' as const, derived: false } : {}),
        version: row.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(sessionExercises.id, id));
    const changes = [
      ...(prescription
        ? [
            {
              field: 'prescription',
              before: prescriptionShort(before),
              after: prescriptionShort(after),
            },
          ]
        : []),
      ...diffFields(
        row as unknown as Record<string, unknown>,
        { ...row, ...values } as Record<string, unknown>,
        Object.keys(values),
      ),
    ];
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'session_exercise',
      entityId: id,
      clientId: plan.clientId,
      changes,
      reason: isOverride
        ? `Override${overrideReason ? `: ${overrideReason}` : ''}`
        : (overrideReason ?? null),
    });
  });
}

async function deleteSessionExercise_(ctx: RequestContext, id: string): Promise<void> {
  const { exercise: row, plan } = await blockOfExercise(ctx, id, 'plans:write');
  await ctx.db.transaction(async (tx) => {
    await tx.delete(sessionExercises).where(eq(sessionExercises.id, id));
    await renumber(tx, sessionExercises, sessionExercises.blockId, row.blockId);
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'session_exercise',
      entityId: id,
      clientId: plan.clientId,
      changes: { exerciseId: row.exerciseId },
    });
  });
}

async function moveSessionExercise_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<void> {
  const { direction } = parse(moveSchema, input);
  const { exercise: row } = await blockOfExercise(ctx, id, 'plans:write');
  await ctx.db.transaction(async (tx) => {
    await swapPositions(tx, sessionExercises, sessionExercises.blockId, row.blockId, id, direction);
  });
}

async function updateMicrocycle_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const d = parse(updateMicrocycleSchema, input);
  const { micro, plan } = await planOfMicrocycle(ctx, id, 'plans:write');
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(microcycles)
      .set({ weekType: d.weekType, notes: d.notes ?? micro.notes })
      .where(eq(microcycles.id, id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'microcycle',
      entityId: id,
      clientId: plan.clientId,
      changes: [{ field: 'weekType', before: micro.weekType, after: d.weekType }],
    });
  });
}

// ── Duplication (deep copies, §12.2) ──────────────────────────────────────────

async function copySessionInto(
  ctx: RequestContext,
  tx: Executor,
  sourceId: string,
  target: {
    microcycleId: string;
    organizationId: string;
    clientId: string | null;
    scheduledDate: string | null;
    position?: number;
  },
) {
  const [src] = await tx.select().from(sessions).where(eq(sessions.id, sourceId));
  const [{ max } = { max: 0 }] = await tx
    .select({ max: sql<number>`coalesce(max(${sessions.position}), 0)::int` })
    .from(sessions)
    .where(eq(sessions.microcycleId, target.microcycleId));
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    version: _v,
    published: _p,
    publishedAt: _pa,
    ...rest
  } = src!;
  void _id;
  void _c;
  void _u;
  void _v;
  void _p;
  void _pa;
  const [copy] = await tx
    .insert(sessions)
    .values({
      ...rest,
      organizationId: target.organizationId,
      clientId: target.clientId,
      microcycleId: target.microcycleId,
      position: target.position ?? max + 1,
      scheduledDate: target.scheduledDate,
      createdBy: ctx.actor.userId,
      updatedBy: null,
    })
    .returning({ id: sessions.id });
  const blocks = await tx
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, sourceId))
    .orderBy(asc(sessionBlocks.position));
  for (const b of blocks) {
    const { id: bid, ...brest } = b;
    const [nb] = await tx
      .insert(sessionBlocks)
      .values({
        ...brest,
        organizationId: target.organizationId,
        clientId: target.clientId,
        sessionId: copy!.id,
      })
      .returning({ id: sessionBlocks.id });
    const exs = await tx
      .select()
      .from(sessionExercises)
      .where(eq(sessionExercises.blockId, bid))
      .orderBy(asc(sessionExercises.position));
    if (exs.length) {
      await tx.insert(sessionExercises).values(
        exs.map(({ id: _e, createdAt: _ca, updatedAt: _ua, version: _ve, ...erest }) => {
          void _e;
          void _ca;
          void _ua;
          void _ve;
          return {
            ...erest,
            organizationId: target.organizationId,
            clientId: target.clientId,
            blockId: nb!.id,
            createdBy: ctx.actor.userId,
            updatedBy: null,
          };
        }),
      );
    }
  }
  return copy!.id;
}

async function duplicateSession_(
  ctx: RequestContext,
  sessionId: string,
  input: unknown,
): Promise<{ id: string }> {
  const { targetMicrocycleId } = parse(duplicateSessionSchema, input);
  const { session, plan } = await planOfSession(ctx, sessionId, 'plans:write');
  const { micro: target, plan: targetPlan } = await planOfMicrocycle(
    ctx,
    targetMicrocycleId,
    'plans:write',
  );
  if (targetPlan.id !== plan.id)
    throw new DomainError('validation', 'Solo se puede duplicar dentro del mismo plan.', {
      targetMicrocycleId: ['other_plan'],
    });
  const [srcMicro] = await ctx.db
    .select()
    .from(microcycles)
    .where(eq(microcycles.id, session.microcycleId));
  const shift = (target.weekIndex - srcMicro!.weekIndex) * 7;
  return ctx.db.transaction(async (tx) => {
    const id = await copySessionInto(ctx, tx, sessionId, {
      microcycleId: target.id,
      organizationId: plan.organizationId,
      clientId: plan.clientId,
      scheduledDate: session.scheduledDate ? addDays(session.scheduledDate, shift) : null,
    });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'session',
      entityId: id,
      clientId: plan.clientId,
      changes: { duplicatedFrom: sessionId, week: target.weekIndex },
    });
    return { id };
  });
}

/** Copies every session of a week into another week of the same plan (replacing its sessions). */
async function duplicateWeek_(
  ctx: RequestContext,
  microcycleId: string,
  input: unknown,
): Promise<{ sessions: number }> {
  const { targetMicrocycleId } = parse(duplicateWeekSchema, input);
  if (targetMicrocycleId === microcycleId)
    throw new DomainError('validation', 'Elige otra semana.', { targetMicrocycleId: ['same'] });
  const { micro: src, plan } = await planOfMicrocycle(ctx, microcycleId, 'plans:write');
  const { micro: target, plan: tp } = await planOfMicrocycle(
    ctx,
    targetMicrocycleId,
    'plans:write',
  );
  if (tp.id !== plan.id)
    throw new DomainError('validation', 'Solo se puede duplicar dentro del mismo plan.', {
      targetMicrocycleId: ['other_plan'],
    });
  const shift = (target.weekIndex - src.weekIndex) * 7;
  return ctx.db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.microcycleId, target.id));
    const srcSessions = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.microcycleId, src.id))
      .orderBy(asc(sessions.position));
    for (const [i, x] of srcSessions.entries()) {
      await copySessionInto(ctx, tx, x.id, {
        microcycleId: target.id,
        organizationId: plan.organizationId,
        clientId: plan.clientId,
        scheduledDate: x.scheduledDate ? addDays(x.scheduledDate, shift) : null,
        position: i + 1,
      });
    }
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'microcycle',
      entityId: target.id,
      clientId: plan.clientId,
      changes: { copiedFromWeek: src.weekIndex, sessions: srcSessions.length },
    });
    return { sessions: srcSessions.length };
  });
}

/** Reads a plan back into a template definition with explicit weeks (exact copy of its content). */
async function planToDefinition(
  ctx: RequestContext,
  planId: string,
  opts: { anonymize: boolean },
): Promise<{ def: TemplateDefinition; plan: typeof trainingPlans.$inferSelect }> {
  const tree = await getPlan_(ctx, planId);
  const allSessionIds = tree.phases.flatMap((p) =>
    p.mesocycles.flatMap((m) => m.weeks.flatMap((w) => w.sessions.map((x) => x.id))),
  );
  const [ses, blocks, exs] = await Promise.all([
    allSessionIds.length
      ? ctx.db.select().from(sessions).where(inArray(sessions.id, allSessionIds))
      : Promise.resolve([]),
    allSessionIds.length
      ? ctx.db
          .select()
          .from(sessionBlocks)
          .where(inArray(sessionBlocks.sessionId, allSessionIds))
          .orderBy(asc(sessionBlocks.position))
      : Promise.resolve([]),
    allSessionIds.length
      ? ctx.db
          .select({ se: sessionExercises, sessionId: sessionBlocks.sessionId })
          .from(sessionExercises)
          .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
          .where(inArray(sessionBlocks.sessionId, allSessionIds))
          .orderBy(asc(sessionExercises.position))
      : Promise.resolve([]),
  ]);
  const toSession = (sid: string): TemplateSession => {
    const x = ses.find((y) => y.id === sid)!;
    return {
      dayLabel: x.dayLabel,
      title: x.title ?? x.dayLabel,
      objective: x.objective ?? undefined,
      durationMin: x.estimatedDurationMin ?? undefined,
      notesForClient: x.notesForClient ?? undefined,
      blocks: blocks
        .filter((b) => b.sessionId === sid)
        .map((b) => ({
          type: b.type,
          organization: b.organization,
          label: b.label ?? undefined,
          rounds: b.rounds ?? undefined,
          restBetweenRoundsS: b.restBetweenRoundsS ?? undefined,
          notes: b.notes ?? undefined,
          exercises: exs
            .filter((e) => e.se.blockId === b.id)
            .map(({ se }) => {
              const p = toPrescription(se);
              // Templates carry relative loads (%1RM/RIR), never a client's kilograms (§12.2.3).
              if (opts.anonymize && p.loadPct1rm != null) p.loadKg = null;
              if (opts.anonymize && p.loadPct1rm == null) p.loadKg = null;
              return {
                exercise: se.exerciseId,
                pairingLabel: se.pairingLabel ?? undefined,
                prescription: Object.fromEntries(
                  Object.entries(p).filter(([, v]) => v != null),
                ) as Prescription,
                loadBasisMetric: se.loadBasisMetric ?? undefined,
                side: se.side,
                notesForClient: se.notesForClient ?? undefined,
              };
            }),
        })),
    };
  };
  const weeks = tree.phases.flatMap((p) => p.mesocycles.flatMap((m) => m.weeks));
  const def: TemplateDefinition = {
    durationMonths: tree.durationMonths as 3,
    sessionsPerWeek: tree.sessionsPerWeek ?? weeks[0]?.sessions.length ?? 1,
    phases: tree.phases.map((p) => ({
      name: p.name,
      objective: p.objective ?? undefined,
      mesocycles: p.mesocycles.map((m) => ({
        name: m.name,
        weeks: m.weeks.length,
        focus: m.focus ?? undefined,
        weekTypes: m.weeks.map((w) => w.weekType),
        assessmentPlanned: m.assessmentPlanned,
      })),
    })),
    sessions: weeks[0] ? weeks[0].sessions.map((x) => toSession(x.id)) : [],
    weeks: weeks.map((w) => ({
      weekIndex: w.weekIndex,
      sessions: w.sessions.map((x) => toSession(x.id)),
    })),
  };
  const { phases: _ph, ...plan } = tree;
  void _ph;
  return { def, plan: plan as typeof trainingPlans.$inferSelect };
}

async function duplicatePlan_(
  ctx: RequestContext,
  planId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(duplicatePlanSchema, input);
  const src = await loadPlan(ctx, planId, 'plans:read');
  const clientId = d.clientId ?? src.clientId!;
  await authorizeClient(ctx, 'plans:write', clientId);
  const { def } = await planToDefinition(ctx, planId, { anonymize: clientId !== src.clientId });
  const weekdays = [
    ...new Set(
      (
        await ctx.db
          .select({ d: sessions.scheduledDate })
          .from(sessions)
          .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
          .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
          .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
          .where(and(eq(phases.planId, planId), eq(microcycles.weekIndex, 1)))
      )
        .map((r) => r.d)
        .filter((x): x is string => !!x)
        .map((x) => new Date(`${x}T00:00:00Z`).getUTCDay() || 7),
    ),
  ];
  return ctx.db.transaction(async (tx) => {
    const [p] = await tx
      .insert(trainingPlans)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        kind: 'CLIENT_PLAN',
        name: d.name,
        description: src.description,
        primaryGoalId: src.primaryGoalId,
        startDate: null,
        durationMonths: src.durationMonths,
        endDate: null,
        sessionsPerWeek: src.sessionsPerWeek,
        periodizationModel: src.periodizationModel,
        status: 'draft',
        basedOnTemplateId: src.basedOnTemplateId,
        createdBy: ctx.actor.userId,
      })
      .returning({
        id: trainingPlans.id,
        organizationId: trainingPlans.organizationId,
        clientId: trainingPlans.clientId,
      });
    await materialize(
      ctx,
      tx,
      { id: p!.id, organizationId: p!.organizationId, clientId: p!.clientId! },
      def,
      { startDate: null, weekdays: weekdays.length ? weekdays : [1] },
    );
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'training_plan',
      entityId: p!.id,
      clientId,
      changes: { duplicatedFrom: planId },
    });
    return { id: p!.id };
  });
}

/** "Guardar como plantilla": anonymized (no client, no dates, relative loads). */
async function saveAsTemplate_(
  ctx: RequestContext,
  planId: string,
  input: unknown,
): Promise<{ id: string }> {
  const d = parse(saveTemplateSchema, input);
  requirePermission(ctx, 'plans:templates');
  await loadPlan(ctx, planId, 'plans:read');
  const { def, plan } = await planToDefinition(ctx, planId, { anonymize: true });
  const issues = validateDefinition(def);
  if (issues.length)
    throw new DomainError('validation', 'El plan no puede guardarse como plantilla.', {
      definition: issues.map((i) => i.message),
    });
  return ctx.db.transaction(async (tx) => {
    const base = slugify(d.name);
    const taken = (
      await tx
        .select({ slug: planTemplates.slug })
        .from(planTemplates)
        .where(eq(planTemplates.organizationId, ctx.actor.organizationId))
    ).map((r) => r.slug);
    let slug = base;
    for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
    const [t] = await tx
      .insert(planTemplates)
      .values({
        organizationId: ctx.actor.organizationId,
        slug,
        name: d.name,
        description: d.description ?? null,
        sessionsPerWeek: def.sessionsPerWeek,
        durationMonths: def.durationMonths,
        definition: def,
        status: 'published',
        derivedFromPlanId: planId,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: planTemplates.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'plan_template',
      entityId: t!.id,
      changes: { fromPlan: planId, name: d.name, weeks: def.weeks?.length ?? 0 },
      clientId: plan.clientId,
    });
    return { id: t!.id };
  });
}

// Use cases run under Row Level Security (see rls.ts).
export const listPlanTemplates = secured(listPlanTemplates_);
export const getPlanTemplate = secured(getPlanTemplate_);
export const listClientPlans = secured(listClientPlans_);
export const createPlan = secured(createPlan_);
export const createPlanFromTemplate = secured(createPlanFromTemplate_);
export const getPlan = secured(getPlan_);
export const updatePlan = secured(updatePlan_);
export const setPlanStatus = secured(setPlanStatus_);
export const createPlanRevision = secured(createPlanRevision_);
export const listPlanRevisions = secured(listPlanRevisions_);
export const getSession = secured(getSession_);
export const updateSession = secured(updateSession_);
export const addBlock = secured(addBlock_);
export const updateBlock = secured(updateBlock_);
export const deleteBlock = secured(deleteBlock_);
export const moveBlock = secured(moveBlock_);
export const addSessionExercise = secured(addSessionExercise_);
export const updateSessionExercise = secured(updateSessionExercise_);
export const deleteSessionExercise = secured(deleteSessionExercise_);
export const moveSessionExercise = secured(moveSessionExercise_);
export const updateMicrocycle = secured(updateMicrocycle_);
export const duplicateSession = secured(duplicateSession_);
export const duplicateWeek = secured(duplicateWeek_);
export const duplicatePlan = secured(duplicatePlan_);
export const saveAsTemplate = secured(saveAsTemplate_);
void weekDates;
void clients;
