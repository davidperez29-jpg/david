/**
 * Programming engine use cases (Phase 11, MASTER_SPECIFICATION §12.2).
 *
 * - Plan proposals: a template adapted to the latest decision run, stored as a `PROPOSAL` plan the
 *   trainer edits and then accepts (→ CLIENT_PLAN draft) or discards.
 * - Adjustments: week-to-week load, deload/volume and substitution proposals computed from the
 *   client's response after each event (system code after commit) and on demand. They are
 *   recommendations: **no automatic process changes an active plan**. Only the trainer's
 *   acceptance applies them, to future sessions without logs, with a plan revision and audit.
 *   The per-client option "apply routine load progressions without confirmation" (off by
 *   default) is the only exception; those changes are audited and can be undone.
 */
import {
  acceptPlanProposalSchema,
  autoApplySchema,
  bulkAdjustmentsSchema,
  decideAdjustmentSchema,
  discardPlanProposalSchema,
  planProposalSchema,
  revertAdjustmentSchema,
} from '@tp/contracts';
import { schema, type Database } from '@tp/db';
import {
  adaptTemplate,
  changesFor,
  DomainError,
  hasActiveConsent,
  isStandardLoadStep,
  RESCHEDULE_HORIZON_DAYS,
  localDate,
  proposeAdjustments,
  addDays,
  type AdjustmentCandidate,
  type AdjustmentKind,
  type AdjustmentParams,
  type ConsentPurpose,
  type DecisionResult,
  type ExerciseChange,
  type ExerciseHistory,
  type Explanation,
  type PlannedTarget,
  type PlanSessionSlot,
  type Replacement,
  type TemplateDefinition,
} from '@tp/domain';
import { and, asc, desc, eq, gte, inArray, isNull, lte, notExists, or, sql } from 'drizzle-orm';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import { onClientActivity } from './client-events';
import type { RequestContext } from './context';
import { runDecision } from './decision';
import { organizationRules } from './monitoring';
import {
  loadPlan,
  materialize,
  replaceFutureSessions,
  resolveExercises,
  writeRevision,
} from './planning';
import { secured } from './rls';
import { parse } from './validation';

const {
  clientAvailability,
  alerts,
  attendance,
  clientGoals,
  clients,
  consents,
  decisionRuns,
  equipment,
  exerciseLoadIncrements,
  exerciseEquipment,
  exerciseFeedback,
  exerciseTolerances,
  exercises,
  manualOverrides,
  mesocycles,
  microcycles,
  movementPatterns,
  phases,
  planTemplates,
  recommendations,
  sessionBlocks,
  sessionExercises,
  sessions,
  setLogs,
  trainingPlans,
} = schema;

type App = { db: Database; now: () => Date };
const ADJUSTMENT_TYPES = ['progression', 'deload', 'substitution', 'schedule'] as const;
const TYPE_OF: Record<AdjustmentKind, (typeof ADJUSTMENT_TYPES)[number]> = {
  load_progression: 'progression',
  deload_week: 'deload',
  volume_reduction: 'deload',
  substitution: 'substitution',
  reschedule: 'schedule',
};
const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));

interface AdjustmentPayload {
  kind: AdjustmentKind;
  title: string;
  params: AdjustmentParams;
  targets: PlannedTarget[];
  options?: { id: string; name: string }[];
}

// ── Plan proposals ────────────────────────────────────────────────────────────

async function latestRun(ctx: RequestContext, clientId: string) {
  const [run] = await ctx.db
    .select()
    .from(decisionRuns)
    .where(eq(decisionRuns.clientId, clientId))
    .orderBy(desc(decisionRuns.createdAt))
    .limit(1);
  return run ?? null;
}

async function generatePlanProposal_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(planProposalSchema, input);
  await authorizeClient(ctx, 'plans:write', clientId);
  requirePermission(ctx, 'decision:run');
  let run = await latestRun(ctx, clientId);
  if (!run) {
    await runDecision(ctx, clientId);
    run = await latestRun(ctx, clientId);
  }
  const result = run!.result as DecisionResult;
  if (result.screening.status === 'refer')
    throw new DomainError(
      'conflict',
      'Cribado positivo: requiere valoración por profesional sanitario antes de proponer un plan completo.',
    );
  const [t] = await ctx.db
    .select()
    .from(planTemplates)
    .where(
      and(
        d.templateId
          ? eq(planTemplates.id, d.templateId)
          : eq(planTemplates.slug, result.planSkeleton?.templateSlug ?? '__none__'),
        or(
          isNull(planTemplates.organizationId),
          eq(planTemplates.organizationId, ctx.actor.organizationId),
        ),
      ),
    )
    .limit(1);
  if (!t)
    throw new DomainError(
      'validation',
      'El motor no encontró una plantilla para el objetivo y la frecuencia: elige una.',
      { templateId: ['required'] },
    );
  const def = t.definition as TemplateDefinition;
  if (d.weekdays.length !== def.sessionsPerWeek)
    throw new DomainError(
      'validation',
      `La plantilla tiene ${def.sessionsPerWeek} sesiones por semana: elige ${def.sessionsPerWeek} días.`,
      { weekdays: ['count'] },
    );

  // Exercises the decision engine excluded for this client (tolerances, material) are replaced by
  // the best candidate of the same movement pattern.
  const refs = [
    ...new Set(
      [...def.sessions, ...(def.weeks ?? []).flatMap((w) => w.sessions)].flatMap((s) =>
        s.blocks.flatMap((b) => b.exercises.map((e) => e.exercise)),
      ),
    ),
  ];
  const resolved = await resolveExercises(ctx, refs);
  const patternIds = [
    ...new Set([...resolved.values()].map((x) => x.patternId).filter((x): x is string => !!x)),
  ];
  const patternSlug = new Map(
    patternIds.length
      ? (
          await ctx.db
            .select({ id: movementPatterns.id, slug: movementPatterns.slug })
            .from(movementPatterns)
            .where(inArray(movementPatterns.id, patternIds))
        ).map((p) => [p.id, p.slug])
      : [],
  );
  const excluded = new Map(
    result.exercises.flatMap((x) => x.excluded.map((e) => [e.exerciseId, e.reason] as const)),
  );
  const replacements: Replacement[] = [];
  for (const ref of refs) {
    const ex = resolved.get(ref);
    if (!ex || !excluded.has(ex.id)) continue;
    const slot = ex.patternId ? patternSlug.get(ex.patternId) : null;
    const cand = result.exercises
      .filter((x) => x.slot === slot)
      .flatMap((x) => x.candidates)
      .find((c) => c.exerciseId !== ex.id && !excluded.has(c.exerciseId));
    if (cand)
      replacements.push({
        from: ref,
        fromName: ex.name,
        to: cand.exerciseId,
        toName: cand.name,
        reason: excluded.get(ex.id)!,
      });
  }
  const adapted = adaptTemplate(def, {
    introLevel: result.introPhase.level,
    replacements,
    templateName: t.name,
  });

  const [goal] = await ctx.db
    .select({ id: clientGoals.goalId })
    .from(clientGoals)
    .where(
      and(
        eq(clientGoals.clientId, clientId),
        eq(clientGoals.isPrimary, true),
        eq(clientGoals.status, 'active'),
      ),
    );
  const [active] = await ctx.db
    .select({ id: trainingPlans.id })
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.clientId, clientId),
        eq(trainingPlans.kind, 'CLIENT_PLAN'),
        eq(trainingPlans.status, 'active'),
      ),
    );
  const [rec] = await ctx.db
    .select({ id: recommendations.id })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.clientId, clientId),
        eq(recommendations.type, 'plan_proposal'),
        inArray(recommendations.status, ['proposed', 'postponed']),
        sql`${recommendations.inputsSnapshot}->>'runId' = ${run!.id}`,
      ),
    );
  return ctx.db.transaction(async (tx) => {
    const [p] = await tx
      .insert(trainingPlans)
      .values({
        organizationId: ctx.actor.organizationId,
        clientId,
        kind: 'PROPOSAL',
        name: `Propuesta · ${t.name}`,
        description: t.description,
        primaryGoalId: goal?.id ?? null,
        startDate: d.startDate,
        durationMonths: t.durationMonths,
        sessionsPerWeek: def.sessionsPerWeek,
        periodizationModel: 'flexible',
        status: 'proposed',
        basedOnTemplateId: t.id,
        proposalOfPlanId: active?.id ?? null,
        recommendationId: rec?.id ?? null,
        generationNotes: adapted.notes,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: trainingPlans.id });
    const r = await materialize(
      ctx,
      tx as never,
      { id: p!.id, organizationId: ctx.actor.organizationId, clientId },
      adapted.definition,
      { startDate: d.startDate, weekdays: d.weekdays },
    );
    await tx
      .update(trainingPlans)
      .set({ endDate: addDays(d.startDate, 7 * r.weeks - 1) })
      .where(eq(trainingPlans.id, p!.id));
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'training_plan',
      entityId: p!.id,
      clientId,
      changes: {
        kind: 'PROPOSAL',
        template: t.slug,
        decisionRun: run!.id,
        replacements: replacements.length,
      },
    });
    return { id: p!.id, notes: adapted.notes, conflicts: r.conflicts, weeks: r.weeks };
  });
}

async function listPlanProposals_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'plans:read', clientId);
  requirePermission(ctx, 'decision:read');
  return ctx.db
    .select({
      id: trainingPlans.id,
      name: trainingPlans.name,
      status: trainingPlans.status,
      startDate: trainingPlans.startDate,
      endDate: trainingPlans.endDate,
      sessionsPerWeek: trainingPlans.sessionsPerWeek,
      notes: trainingPlans.generationNotes,
      createdAt: trainingPlans.createdAt,
    })
    .from(trainingPlans)
    .where(and(eq(trainingPlans.clientId, clientId), eq(trainingPlans.kind, 'PROPOSAL')))
    .orderBy(desc(trainingPlans.createdAt));
}

async function proposalPlan(ctx: RequestContext, planId: string) {
  const p = await loadPlan(ctx, planId, 'plans:write');
  if (p.kind !== 'PROPOSAL' || p.status !== 'proposed')
    throw new DomainError('conflict', 'Esta propuesta ya se aceptó o se descartó.');
  return p;
}

async function decideLinkedRecommendation(
  ctx: RequestContext,
  id: string | null,
  status: 'accepted' | 'rejected',
  reason: string | null,
) {
  if (!id) return;
  await ctx.db
    .update(recommendations)
    .set({ status, decidedBy: ctx.actor.userId, decidedAt: ctx.now(), decisionReason: reason })
    .where(
      and(eq(recommendations.id, id), inArray(recommendations.status, ['proposed', 'postponed'])),
    );
}

async function applyProposalAsRevision(
  ctx: RequestContext,
  p: Awaited<ReturnType<typeof proposalPlan>>,
  reason: string | null,
) {
  if (!p.proposalOfPlanId)
    throw new DomainError(
      'conflict',
      'Esta propuesta no se generó sobre un plan activo: acéptala como plan en borrador.',
      { mode: ['no_active_plan'] },
    );
  // The active plan must still be active and editable (loadPlan refuses completed or archived).
  const active = await loadPlan(ctx, p.proposalOfPlanId, 'plans:write');
  if (active.status !== 'active')
    throw new DomainError(
      'conflict',
      'El plan para el que se propuso ya no está activo: acéptala como plan en borrador.',
      { mode: ['no_active_plan'] },
    );
  const from = localDate(ctx.now());
  const result = await ctx.db.transaction(async (tx) => {
    const r = await replaceFutureSessions(ctx, tx, active, p.id, from);
    if (!r.copied)
      throw new DomainError(
        'validation',
        'La propuesta no tiene sesiones dentro de las semanas que le quedan al plan activo.',
        { mode: ['nothing_to_apply'] },
      );
    const revision = await writeRevision(
      ctx,
      tx,
      active,
      reason ? `Propuesta del motor aplicada: ${reason}` : 'Propuesta del motor aplicada',
    );
    await tx
      .update(trainingPlans)
      .set({ status: 'archived', version: p.version + 1, updatedBy: ctx.actor.userId })
      .where(eq(trainingPlans.id, p.id));
    await tx
      .update(trainingPlans)
      .set({ version: active.version + 1, updatedBy: ctx.actor.userId })
      .where(eq(trainingPlans.id, active.id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'training_plan',
      entityId: active.id,
      clientId: active.clientId,
      changes: { appliedProposal: p.id, from, revision, ...r },
      reason: reason ?? 'Propuesta del motor aplicada como revisión',
    });
    return { id: active.id, revision, ...r };
  });
  await decideLinkedRecommendation(ctx, p.recommendationId, 'accepted', reason);
  return result;
}

/**
 * Accepting a proposal, always by the trainer:
 * - draft (default): it becomes a CLIENT_PLAN draft; the active plan is not touched;
 * - revision (phase 13): its sessions from today replace the unrecorded future sessions of the
 *   active plan it was proposed for, as a new revision of that plan; the proposal is archived.
 */
async function acceptPlanProposal_(ctx: RequestContext, planId: string, input: unknown = {}) {
  const d = parse(acceptPlanProposalSchema, input);
  const p = await proposalPlan(ctx, planId);
  if (d.mode === 'revision') return applyProposalAsRevision(ctx, p, d.reason ?? null);
  const name = d.name ?? p.name.replace(/^Propuesta · /, '');
  await ctx.db
    .update(trainingPlans)
    .set({
      kind: 'CLIENT_PLAN',
      status: 'draft',
      name,
      version: p.version + 1,
      updatedBy: ctx.actor.userId,
    })
    .where(eq(trainingPlans.id, planId));
  await decideLinkedRecommendation(ctx, p.recommendationId, 'accepted', d.reason ?? null);
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'training_plan',
    entityId: planId,
    clientId: p.clientId,
    changes: [
      { field: 'kind', before: 'PROPOSAL', after: 'CLIENT_PLAN' },
      { field: 'status', before: 'proposed', after: 'draft' },
    ],
    reason: d.reason ?? 'Propuesta de plan aceptada',
  });
  return { id: planId };
}

async function discardPlanProposal_(ctx: RequestContext, planId: string, input: unknown = {}) {
  const d = parse(discardPlanProposalSchema, input);
  const p = await proposalPlan(ctx, planId);
  await ctx.db
    .update(trainingPlans)
    .set({ status: 'archived', version: p.version + 1, updatedBy: ctx.actor.userId })
    .where(eq(trainingPlans.id, planId));
  await decideLinkedRecommendation(ctx, p.recommendationId, 'rejected', d.reason ?? null);
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'training_plan',
    entityId: planId,
    clientId: p.clientId,
    changes: [{ field: 'status', before: 'proposed', after: 'archived' }],
    reason: d.reason ?? 'Propuesta de plan descartada',
  });
}

// ── Adjustments: input from the database ──────────────────────────────────────

async function activePlan(db: Database, clientId: string) {
  const [p] = await db
    .select()
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.clientId, clientId),
        eq(trainingPlans.kind, 'CLIENT_PLAN'),
        eq(trainingPlans.status, 'active'),
      ),
    );
  return p ?? null;
}

/** Planned exercises of the plan in sessions that are not performed (no logs, no attendance). */
async function plannedExercises(db: Database, planId: string, from: string | null) {
  const rows = await db
    .select({
      se: sessionExercises,
      sessionId: sessions.id,
      date: sessions.scheduledDate,
      weekIndex: microcycles.weekIndex,
      name: exercises.name,
    })
    .from(sessionExercises)
    .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
    .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(
      and(
        eq(phases.planId, planId),
        from ? gte(sessions.scheduledDate, from) : undefined,
        notExists(
          db
            .select({ x: sql`1` })
            .from(setLogs)
            .where(eq(setLogs.sessionId, sessions.id)),
        ),
        notExists(
          db
            .select({ x: sql`1` })
            .from(attendance)
            .where(eq(attendance.sessionId, sessions.id)),
        ),
      ),
    )
    .orderBy(
      asc(sessions.scheduledDate),
      asc(sessionBlocks.position),
      asc(sessionExercises.position),
    );
  return rows
    .filter((r) => r.date)
    .map((r): PlannedTarget => ({
      sessionExerciseId: r.se.id,
      sessionId: r.sessionId,
      date: r.date!,
      weekIndex: r.weekIndex,
      exerciseId: r.se.exerciseId,
      exerciseName: r.name,
      sets: r.se.sets,
      repsMin: r.se.repsMin,
      repsMax: r.se.repsMax,
      rirMin: r.se.rirMin,
      rirMax: r.se.rirMax,
      loadKg: num(r.se.loadKg),
    }));
}

export async function buildProgrammingInput(app: App, clientId: string, planId: string) {
  const db = app.db;
  const today = localDate(app.now());
  const [c] = await db.select().from(clients).where(eq(clients.id, clientId));
  const upcoming = await plannedExercises(db, planId, today);

  // History: performed sets of this plan in the last 28 days (RIR not reported excluded).
  const logs = await db
    .select({
      exerciseId: sessionExercises.exerciseId,
      name: exercises.name,
      date: sessions.scheduledDate,
      sessionId: sessions.id,
      setIndex: setLogs.setIndex,
      reps: setLogs.reps,
      loadKg: setLogs.loadKg,
      rir: setLogs.rir,
      rirAssumed: setLogs.rirAssumed,
      velocity: setLogs.meanVelocityMps,
      tRepsMin: sessionExercises.repsMin,
      tRepsMax: sessionExercises.repsMax,
      tRirMin: sessionExercises.rirMin,
      tRirMax: sessionExercises.rirMax,
      tLoad: sessionExercises.loadKg,
      tVelocity: sessionExercises.velocityTargetMps,
    })
    .from(setLogs)
    .innerJoin(sessionExercises, eq(sessionExercises.id, setLogs.sessionExerciseId))
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .innerJoin(sessions, eq(sessions.id, setLogs.sessionId))
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .where(
      and(
        eq(phases.planId, planId),
        eq(setLogs.completed, true),
        // Only logs of the planned exercise (a live substitution is another exercise).
        eq(setLogs.exerciseIdPerformed, sessionExercises.exerciseId),
        gte(sessions.scheduledDate, addDays(today, -28)),
      ),
    )
    .orderBy(asc(sessions.scheduledDate), asc(setLogs.setIndex));
  const exIds = [...new Set(logs.map((l) => l.exerciseId))];
  const eqRows = exIds.length
    ? await db
        .select({ exerciseId: exerciseEquipment.exerciseId, slug: equipment.slug })
        .from(exerciseEquipment)
        .innerJoin(equipment, eq(equipment.id, exerciseEquipment.equipmentId))
        .where(inArray(exerciseEquipment.exerciseId, exIds))
    : [];
  // The centre's own load increment per exercise (phase 13), else the default by equipment.
  const incRows = exIds.length
    ? await db
        .select({
          exerciseId: exerciseLoadIncrements.exerciseId,
          kg: exerciseLoadIncrements.incrementKg,
        })
        .from(exerciseLoadIncrements)
        .where(
          and(
            inArray(exerciseLoadIncrements.exerciseId, exIds),
            sql`${exerciseLoadIncrements.organizationId} = (SELECT organization_id FROM clients WHERE id = ${clientId})`,
          ),
        )
    : [];
  const history: ExerciseHistory[] = exIds.map((id) => {
    const mine = logs.filter((l) => l.exerciseId === id);
    const bySession = [...new Set(mine.map((l) => l.sessionId))];
    return {
      exerciseId: id,
      exerciseName: mine[0]!.name,
      equipment: eqRows.filter((r) => r.exerciseId === id).map((r) => r.slug),
      incrementKg: num(incRows.find((r) => r.exerciseId === id)?.kg),
      sessions: bySession.map((sid) => {
        const ls = mine.filter((l) => l.sessionId === sid);
        const f = ls[0]!;
        return {
          date: f.date!,
          target: {
            repsMin: f.tRepsMin,
            repsMax: f.tRepsMax,
            rirMin: f.tRirMin,
            rirMax: f.tRirMax,
            loadKg: num(f.tLoad),
            velocityTargetMps: num(f.tVelocity),
          },
          sets: ls.map((l) => ({
            reps: l.reps ?? 0,
            loadKg: num(l.loadKg),
            rir: l.rirAssumed ? null : l.rir,
            meanVelocityMps: num(l.velocity),
          })),
        };
      }),
    };
  });

  const open = await db
    .select({ type: alerts.type })
    .from(alerts)
    .where(and(eq(alerts.clientId, clientId), sql`${alerts.status} <> 'resolved'`));
  const has = (t: string) => open.some((a) => a.type === t);

  // Per-exercise pain only with the client's health-data consent (art. 9 RGPD).
  const cs = await db.select().from(consents).where(eq(consents.clientId, clientId));
  const healthOk = hasActiveConsent(
    cs.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
  const pains = healthOk
    ? (
        await db
          .select({
            exerciseId: sessionExercises.exerciseId,
            name: exercises.name,
            date: sessions.scheduledDate,
            pain: exerciseFeedback.pain,
          })
          .from(exerciseFeedback)
          .innerJoin(sessionExercises, eq(sessionExercises.id, exerciseFeedback.sessionExerciseId))
          .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
          .innerJoin(sessions, eq(sessions.id, exerciseFeedback.sessionId))
          .where(
            and(
              eq(exerciseFeedback.clientId, clientId),
              gte(sessions.scheduledDate, addDays(today, -14)),
            ),
          )
      )
        .filter((p) => p.pain != null && p.date)
        .map((p) => ({
          exerciseId: p.exerciseId,
          exerciseName: p.name,
          date: p.date!,
          intensity: p.pain!,
        }))
    : [];

  // Substitutes: the trainer's pre-approved alternatives first, then same-pattern exercises from
  // the library that the client tolerates.
  const substitutes: Record<string, { id: string; name: string }[]> = {};
  const painEx = [...new Set(pains.map((p) => p.exerciseId))].filter((id) =>
    upcoming.some((u) => u.exerciseId === id),
  );
  if (painEx.length) {
    const tol = await db
      .select({
        exerciseId: exerciseTolerances.exerciseId,
        patternId: exerciseTolerances.movementPatternId,
      })
      .from(exerciseTolerances)
      .where(
        and(
          eq(exerciseTolerances.clientId, clientId),
          eq(exerciseTolerances.kind, 'not_tolerated'),
        ),
      );
    const bad = new Set(tol.map((t) => t.exerciseId).filter(Boolean));
    for (const id of painEx) {
      const alt = await db
        .select({ ids: sessionExercises.alternativeExerciseIds })
        .from(sessionExercises)
        .where(
          inArray(
            sessionExercises.id,
            upcoming.filter((u) => u.exerciseId === id).map((u) => u.sessionExerciseId),
          ),
        );
      const altIds = [...new Set(alt.flatMap((a) => a.ids))];
      const [orig] = await db
        .select({ pattern: exercises.movementPatternId })
        .from(exercises)
        .where(eq(exercises.id, id));
      const options = [
        ...(altIds.length
          ? await db
              .select({ id: exercises.id, name: exercises.name })
              .from(exercises)
              .where(inArray(exercises.id, altIds))
          : []),
        ...(orig?.pattern
          ? await db
              .select({ id: exercises.id, name: exercises.name })
              .from(exercises)
              .where(
                and(
                  eq(exercises.movementPatternId, orig.pattern),
                  eq(exercises.status, 'published'),
                  or(
                    isNull(exercises.organizationId),
                    eq(exercises.organizationId, c!.organizationId),
                  ),
                ),
              )
              .orderBy(asc(exercises.name))
              .limit(6)
          : []),
      ];
      const seen = new Set<string>();
      substitutes[id] = options
        .filter((o) => o.id !== id && !bad.has(o.id) && !seen.has(o.id) && seen.add(o.id))
        .slice(0, 4);
    }
  }
  // Availability moves (restructure phase 15): the stated weekdays and the plan's sessions ahead.
  const [availRows, sessionRows] = await Promise.all([
    db
      .selectDistinct({ weekday: clientAvailability.weekday })
      .from(clientAvailability)
      .where(eq(clientAvailability.clientId, clientId)),
    db
      .select({
        sessionId: sessions.id,
        date: sessions.scheduledDate,
        name: sessions.title,
        weekIndex: microcycles.weekIndex,
        weekStart: microcycles.startDate,
        recorded: sql<boolean>`(exists (select 1 from ${setLogs} where ${setLogs.sessionId} = ${sessions.id})
          or exists (select 1 from ${attendance} where ${attendance.sessionId} = ${sessions.id}))`,
      })
      .from(sessions)
      .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(
        and(
          eq(phases.planId, planId),
          gte(sessions.scheduledDate, today),
          // The moves horizon plus the rest of its last week: later sessions never matter.
          lte(sessions.scheduledDate, addDays(today, RESCHEDULE_HORIZON_DAYS + 6)),
        ),
      )
      .orderBy(asc(sessions.scheduledDate)),
  ]);
  const cfg = await organizationRules(db, c!.organizationId);
  const painRule = cfg.rules.find((r) => r.key === 'pain');
  return {
    today,
    upcoming,
    history,
    signals: {
      srpeHigh: has('srpe_high'),
      wellnessLow: has('wellness_low'),
      adherenceLow: has('adherence_low'),
      partialSessions: has('partial_sessions'),
    },
    pains,
    painThreshold: painRule?.parameters.yellowFrom ?? 4,
    substitutes,
    availableWeekdays: availRows.map((r) => r.weekday),
    sessions: sessionRows
      .filter((r) => r.date && r.weekStart)
      .map((r): PlanSessionSlot => ({
        sessionId: r.sessionId,
        date: r.date!,
        weekIndex: r.weekIndex,
        weekStart: r.weekStart!,
        name: r.name,
        recorded: Boolean(r.recorded),
      })),
  };
}

// ── Applying changes (only future, not-yet-performed sessions; stale values are skipped) ──

/** Audit field of a change: the session for a move, the planned exercise otherwise. */
const changeField = (a: ExerciseChange) =>
  a.field === 'scheduledDate'
    ? `${a.sessionId}.scheduledDate`
    : `${a.sessionExerciseId}.${a.field}`;

const COLUMN = {
  loadKg: 'loadKg',
  sets: 'sets',
  rirMin: 'rirMin',
  rirMax: 'rirMax',
  exerciseId: 'exerciseId',
} as const;

async function applyChanges(
  db: Database,
  today: string,
  changes: ExerciseChange[],
  recommendationId: string,
  invert = false,
  /** Who applies it (null = the system's auto-apply), stamped on moved sessions. */
  userId: string | null = null,
) {
  const dates = await applySessionDates(
    db,
    today,
    changes.filter((c) => c.field === 'scheduledDate'),
    invert,
    userId,
  );
  changes = changes.filter((c) => c.field !== 'scheduledDate');
  const ids = [...new Set(changes.map((c) => c.sessionExerciseId))];
  if (!ids.length) return dates;
  const rows = await db
    .select({ se: sessionExercises, date: sessions.scheduledDate, sessionId: sessions.id })
    .from(sessionExercises)
    .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
    .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
    .where(
      and(
        inArray(sessionExercises.id, ids),
        notExists(
          db
            .select({ x: sql`1` })
            .from(setLogs)
            .where(eq(setLogs.sessionId, sessions.id)),
        ),
        notExists(
          db
            .select({ x: sql`1` })
            .from(attendance)
            .where(eq(attendance.sessionId, sessions.id)),
        ),
      ),
    );
  const byId = new Map(rows.filter((r) => r.date && r.date >= today).map((r) => [r.se.id, r.se]));
  const applied: ExerciseChange[] = [...dates.applied];
  let skipped = dates.skipped;
  // One update per exercise, so related fields (RIR min/max) never cross in between.
  for (const id of ids) {
    const row = byId.get(id);
    const set: Record<string, unknown> = {};
    for (const ch of changes.filter((x) => x.sessionExerciseId === id)) {
      const c = invert ? { ...ch, from: ch.to, to: ch.from } : ch;
      const field = c.field as keyof typeof COLUMN;
      const current = row
        ? c.field === 'loadKg'
          ? num(row.loadKg)
          : (row[COLUMN[field]] as number | string | null)
        : undefined;
      // Never overwrite something the trainer changed since the proposal (or a performed session).
      if (row === undefined || current !== c.from) {
        skipped++;
        continue;
      }
      set[COLUMN[field]] = c.field === 'loadKg' ? (c.to == null ? null : String(c.to)) : c.to;
      applied.push(c);
    }
    if (!row || !Object.keys(set).length) continue;
    await db
      .update(sessionExercises)
      .set({
        ...set,
        source: invert ? row.source : 'progression_rule',
        derived: false,
        recommendationId: invert ? row.recommendationId : recommendationId,
        version: row.version + 1,
      })
      .where(eq(sessionExercises.id, row.id));
  }
  return { applied, skipped };
}

/**
 * Session moves (availability, restructure phase 15), with the same rules as rescheduling by hand
 * (A51): only sessions without a record, from today on, inside their own plan week, and never onto
 * a day another session of the plan already has. A session moved since the proposal is skipped.
 */
async function applySessionDates(
  db: Database,
  today: string,
  changes: ExerciseChange[],
  invert: boolean,
  userId: string | null,
) {
  const applied: ExerciseChange[] = [];
  let skipped = 0;
  for (const ch of changes) {
    const c = invert ? { ...ch, from: ch.to, to: ch.from } : ch;
    const [row] = await db
      .select({
        s: sessions,
        weekStart: microcycles.startDate,
        planId: phases.planId,
        // Any record (a logged set or attendance) keeps the session where it is.
        recorded: sql<boolean>`(exists (select 1 from ${setLogs} where ${setLogs.sessionId} = ${sessions.id})
          or exists (select 1 from ${attendance} where ${attendance.sessionId} = ${sessions.id}))`,
      })
      .from(sessions)
      .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(sessions.id, c.sessionId ?? ''));
    const to = String(c.to);
    const ok =
      row?.s.scheduledDate != null &&
      row.s.scheduledDate === c.from &&
      row.s.scheduledDate >= today &&
      to >= today &&
      row.weekStart != null &&
      row.weekStart <= to &&
      to <= addDays(row.weekStart, 6);
    const recorded = ok && row.recorded;
    const taken =
      ok &&
      !recorded &&
      (
        await db
          .select({ x: sql`1` })
          .from(sessions)
          .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
          .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
          .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
          .where(
            and(
              eq(phases.planId, row.planId),
              eq(sessions.scheduledDate, to),
              sql`${sessions.id} <> ${row.s.id}`,
            ),
          )
          .limit(1)
      ).length > 0;
    if (!ok || recorded || taken) {
      skipped++;
      continue;
    }
    await db
      .update(sessions)
      .set({ scheduledDate: to, version: row.s.version + 1, updatedBy: userId })
      .where(eq(sessions.id, row.s.id));
    applied.push(c);
  }
  return { applied, skipped };
}

// ── Adjustments: evaluation (system) ──────────────────────────────────────────

/**
 * Recomputes the adjustment proposals of a client: new situations become recommendations, pending
 * ones whose situation is gone expire. Runs as system code after commit (client activity) and on
 * demand. It never changes the plan, except load progressions when the client's auto-apply option
 * is on (audited, reversible).
 */
export async function evaluateAdjustments(app: App, clientId: string) {
  const db = app.db;
  const plan = await activePlan(db, clientId);
  // Only what the comparison needs: payloads and explanations of the history are not loaded.
  const pendingOf = await db
    .select({
      id: recommendations.id,
      key: recommendations.key,
      status: recommendations.status,
      planId: recommendations.planId,
    })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.clientId, clientId),
        inArray(recommendations.type, [...ADJUSTMENT_TYPES]),
        sql`${recommendations.key} IS NOT NULL`,
      ),
    );
  const pending = pendingOf.filter((r) => r.status === 'proposed' || r.status === 'postponed');
  const now = app.now();
  if (!plan) {
    if (pending.length)
      await db
        .update(recommendations)
        .set({ status: 'expired' })
        .where(
          inArray(
            recommendations.id,
            pending.map((r) => r.id),
          ),
        );
    return { created: 0, expired: pending.length, autoApplied: 0 };
  }
  const input = await buildProgrammingInput(app, clientId, plan.id);
  const candidates = proposeAdjustments(input);
  const keys = new Set(candidates.map((c) => c.key));
  const known = new Set(pendingOf.map((r) => r.key));
  // Situations that are gone (or targets already performed) expire; a pending load proposal for
  // an exercise that now has a newer one (new logged session) is superseded by it.
  const exerciseOf = (key: string) => (key.startsWith('load:') ? key.split(':')[1] : null);
  const newerLoad = new Set(candidates.map((x) => exerciseOf(x.key)).filter(Boolean));
  const gone = pending.filter((r) => !keys.has(r.key!) || r.planId !== plan.id);
  for (const status of ['superseded', 'expired'] as const) {
    const ids = gone
      .filter((r) => (status === 'superseded') === newerLoad.has(exerciseOf(r.key!)))
      .map((r) => r.id);
    if (ids.length)
      await db.update(recommendations).set({ status }).where(inArray(recommendations.id, ids));
  }

  const [c] = await db
    .select({
      organizationId: clients.organizationId,
      autoApplyLoadProgressions: clients.autoApplyLoadProgressions,
    })
    .from(clients)
    .where(eq(clients.id, clientId));
  let created = 0;
  let autoApplied = 0;
  for (const cand of candidates) {
    if (known.has(cand.key)) continue;
    const payload: AdjustmentPayload = {
      kind: cand.kind,
      title: cand.title,
      params: cand.params,
      targets: cand.targets,
      ...(cand.options ? { options: cand.options } : {}),
    };
    const [rec] = await db
      .insert(recommendations)
      .values({
        organizationId: c!.organizationId,
        clientId,
        planId: plan.id,
        key: cand.key,
        type: TYPE_OF[cand.kind],
        payload,
        explanation: cand.explanation,
        inputsSnapshot: { key: cand.key, today: input.today },
        ruleSetVersion: 0,
        ruleKeys: cand.explanation.rules.map((r) => r.key),
        confidence:
          cand.explanation.confidence === 'very_low' ? 'low' : cand.explanation.confidence,
      })
      .returning();
    created++;
    if (
      cand.kind === 'load_progression' &&
      c!.autoApplyLoadProgressions &&
      withinStandardStep(cand, input.history)
    ) {
      const { applied } = await applyChanges(
        db,
        input.today,
        changesFor(cand.kind, cand.params, cand.targets),
        rec!.id,
      );
      if (!applied.length) continue;
      await db
        .update(recommendations)
        .set({
          status: 'accepted',
          decidedAt: now,
          decisionReason: 'Aplicada automáticamente (opción activada para este cliente).',
          applied,
        })
        .where(eq(recommendations.id, rec!.id));
      await writeAudit(
        db,
        { ...app, requestId: null, ipHash: null } as never,
        {
          action: 'update',
          entityType: 'recommendation',
          entityId: rec!.id,
          clientId,
          changes: applied.map((a) => ({
            field: changeField(a),
            before: a.from,
            after: a.to,
          })),
          reason: 'Progresión de carga aplicada automáticamente (opción del cliente).',
        },
        { userId: null, organizationId: c!.organizationId, roles: ['SYSTEM'] },
      );
      autoApplied++;
    }
  }
  return { created, expired: gone.length, autoApplied };
}

/** See `isStandardLoadStep`: one trainer's setting never changes other clients' plans alone. */
function withinStandardStep(cand: AdjustmentCandidate, history: ExerciseHistory[]) {
  const { fromKg, toKg } = cand.params;
  const h = history.find((x) => x.exerciseId === cand.targets[0]?.exerciseId);
  return fromKg != null && toKg != null && !!h && isStandardLoadStep(fromKg, toKg, h.equipment);
}

/** Daily job: every client with an active plan. */
export async function evaluateAllAdjustments(app: App) {
  const ids = await app.db
    .selectDistinct({ id: trainingPlans.clientId })
    .from(trainingPlans)
    .where(and(eq(trainingPlans.status, 'active'), eq(trainingPlans.kind, 'CLIENT_PLAN')));
  let created = 0;
  for (const { id } of ids) if (id) created += (await evaluateAdjustments(app, id)).created;
  return { clients: ids.length, created };
}

// Registered after monitoring (imported above), so alerts are up to date when this runs.
onClientActivity((root, clientId) => evaluateAdjustments(root, clientId));

// ── Adjustments: use cases ────────────────────────────────────────────────────

async function adjustmentOf(ctx: RequestContext, id: string) {
  const [rec] = await ctx.db.select().from(recommendations).where(eq(recommendations.id, id));
  if (!rec || !rec.key || !(ADJUSTMENT_TYPES as readonly string[]).includes(rec.type))
    throw new DomainError('not_found', 'Propuesta de ajuste no encontrada.');
  try {
    await authorizeClient(ctx, 'plans:write', rec.clientId);
  } catch (e) {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Propuesta de ajuste no encontrada.');
    throw e;
  }
  requirePermission(ctx, 'decision:decide');
  return rec;
}

async function listAdjustments_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'plans:read', clientId);
  requirePermission(ctx, 'decision:read');
  const rows = await ctx.db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.clientId, clientId),
        inArray(recommendations.type, [...ADJUSTMENT_TYPES]),
        sql`${recommendations.key} IS NOT NULL`,
        inArray(recommendations.status, [
          'proposed',
          'postponed',
          'accepted',
          'accepted_with_changes',
          'rejected',
          'reverted',
        ]),
      ),
    )
    .orderBy(desc(recommendations.createdAt))
    .limit(60);
  const [c] = await ctx.db
    .select({ auto: clients.autoApplyLoadProgressions })
    .from(clients)
    .where(eq(clients.id, clientId));
  return {
    autoApplyLoadProgressions: c?.auto ?? false,
    items: rows.map(adjustmentView),
  };
}

function adjustmentView(r: typeof recommendations.$inferSelect) {
  const p = r.payload as AdjustmentPayload;
  return {
    id: r.id,
    type: r.type,
    kind: p.kind,
    title: p.title,
    status: r.status,
    params: p.params,
    options: p.options ?? [],
    targets: p.targets,
    preview: changesFor(p.kind, p.params, p.targets),
    applied: (r.applied as ExerciseChange[] | null) ?? null,
    explanation: r.explanation as Explanation,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
    decidedBy: r.decidedBy,
    decisionReason: r.decisionReason,
  };
}
export type AdjustmentView = ReturnType<typeof adjustmentView>;

/**
 * Pending adjustments (proposed or postponed) of every client the actor follows, for the Alertas
 * page (restructure phase 12): the trainer decides them where the alerts that raised them are,
 * without opening each client. RLS keeps a trainer to the clients assigned to them.
 */
async function listPendingAdjustments_(ctx: RequestContext) {
  requirePermission(ctx, 'decision:read');
  const rows = await ctx.db
    .select({ r: recommendations, firstName: clients.firstName, lastName: clients.lastName })
    .from(recommendations)
    .innerJoin(clients, eq(clients.id, recommendations.clientId))
    .where(
      and(
        inArray(recommendations.type, [...ADJUSTMENT_TYPES]),
        sql`${recommendations.key} IS NOT NULL`,
        inArray(recommendations.status, ['proposed', 'postponed']),
        isNull(clients.anonymizedAt),
      ),
    )
    .orderBy(asc(clients.lastName), asc(clients.firstName), desc(recommendations.createdAt))
    .limit(200);
  return rows.map(({ r, firstName, lastName }) => ({
    ...adjustmentView(r),
    clientId: r.clientId,
    firstName,
    lastName,
  }));
}
export type PendingAdjustment = Awaited<ReturnType<typeof listPendingAdjustments_>>[number];

async function refreshAdjustments_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'plans:write', clientId);
  return evaluateAdjustments(ctx, clientId);
}

async function decideOne(
  ctx: RequestContext,
  rec: typeof recommendations.$inferSelect,
  action: 'accept' | 'accept_with_changes' | 'reject' | 'postpone',
  edits: AdjustmentParams | undefined,
  reason: string | null,
) {
  if (rec.status !== 'proposed' && rec.status !== 'postponed')
    throw new DomainError(
      'conflict',
      'La propuesta ya está decidida, caducada o sustituida por otra más reciente.',
    );
  const p = rec.payload as AdjustmentPayload;
  if (action === 'reject' || action === 'postpone') {
    await ctx.db
      .update(recommendations)
      .set({
        status: action === 'reject' ? 'rejected' : 'postponed',
        decidedBy: ctx.actor.userId,
        decidedAt: ctx.now(),
        decisionReason: reason,
      })
      .where(eq(recommendations.id, rec.id));
    await writeAudit(ctx.db, ctx, {
      action: 'update',
      entityType: 'recommendation',
      entityId: rec.id,
      clientId: rec.clientId,
      changes: [
        {
          field: 'status',
          before: rec.status,
          after: action === 'reject' ? 'rejected' : 'postponed',
        },
      ],
      reason,
    });
    return { applied: 0, skipped: 0 };
  }
  const edited = Object.entries(edits ?? {}).filter(
    ([k, v]) => v !== undefined && v !== (p.params as Record<string, unknown>)[k],
  );
  // Session moves are applied as proposed: no edited values, whatever the action says.
  if (p.kind === 'reschedule' && (action === 'accept_with_changes' || edited.length))
    throw new DomainError(
      'validation',
      'Esta propuesta no se edita: acéptala, recházala o mueve las sesiones en el Calendario.',
      { params: ['not_editable'] },
    );
  if (action === 'accept_with_changes' && !edited.length)
    throw new DomainError('validation', 'Indica qué cambias.', { params: ['required'] });
  if (edits?.toExerciseId && !(p.options ?? []).some((o) => o.id === edits.toExerciseId))
    throw new DomainError('validation', 'Elige una de las alternativas propuestas.', {
      toExerciseId: ['unknown'],
    });
  const params = { ...p.params, ...Object.fromEntries(edited) };
  const plan = await loadPlan(ctx, rec.planId!, 'plans:write');
  const today = localDate(ctx.now());
  const { applied, skipped } = await applyChanges(
    ctx.db,
    today,
    changesFor(p.kind, params, p.targets),
    rec.id,
    false,
    ctx.actor.userId,
  );
  if (!applied.length)
    throw new DomainError(
      'conflict',
      'Las sesiones afectadas ya se han realizado o se han cambiado a mano desde la propuesta: recalcula los ajustes.',
    );
  const status = edited.length ? 'accepted_with_changes' : 'accepted';
  await ctx.db
    .update(recommendations)
    .set({
      status,
      decidedBy: ctx.actor.userId,
      decidedAt: ctx.now(),
      decisionReason: reason,
      applied,
    })
    .where(eq(recommendations.id, rec.id));
  if (edited.length)
    await ctx.db.insert(manualOverrides).values(
      edited.map(([field, value]) => ({
        organizationId: rec.organizationId,
        clientId: rec.clientId,
        entityType: 'recommendation',
        entityId: rec.id,
        field,
        proposedValue: ((p.params as Record<string, unknown>)[field] ?? null) as object,
        finalValue: value as object,
        recommendationId: rec.id,
        reason,
        userId: ctx.actor.userId,
      })),
    );
  await writeRevision(ctx, ctx.db as never, plan, `Ajuste aceptado: ${p.title}`);
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'recommendation',
    entityId: rec.id,
    clientId: rec.clientId,
    changes: [
      { field: 'status', before: rec.status, after: status },
      ...applied.map((a) => ({
        field: changeField(a),
        before: a.from,
        after: a.to,
      })),
    ],
    reason,
  });
  return { applied: applied.length, skipped };
}

async function decideAdjustment_(ctx: RequestContext, id: string, input: unknown) {
  const d = parse(decideAdjustmentSchema, input);
  const rec = await adjustmentOf(ctx, id);
  return decideOne(ctx, rec, d.action, d.params, d.reason ?? null);
}

/** "Aceptar en bloque": each proposal is applied (and audited) individually. */
async function acceptAdjustments_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(bulkAdjustmentsSchema, input);
  await authorizeClient(ctx, 'plans:write', clientId);
  let applied = 0;
  const failed: { id: string; message: string }[] = [];
  for (const id of d.ids) {
    const rec = await adjustmentOf(ctx, id);
    if (rec.clientId !== clientId)
      throw new DomainError('not_found', 'Propuesta de ajuste no encontrada.');
    try {
      applied += (await decideOne(ctx, rec, 'accept', undefined, d.reason ?? null)).applied;
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
      failed.push({ id, message: e.message });
    }
  }
  return { applied, failed };
}

/** Undo an applied adjustment: values go back where nobody changed them since. */
async function revertAdjustment_(ctx: RequestContext, id: string, input: unknown = {}) {
  const d = parse(revertAdjustmentSchema, input);
  const rec = await adjustmentOf(ctx, id);
  if (rec.status !== 'accepted' && rec.status !== 'accepted_with_changes')
    throw new DomainError('conflict', 'Solo se pueden deshacer ajustes aplicados.');
  const plan = await loadPlan(ctx, rec.planId!, 'plans:write');
  const applied = (rec.applied as ExerciseChange[] | null) ?? [];
  const r = await applyChanges(
    ctx.db,
    localDate(ctx.now()),
    applied,
    rec.id,
    true,
    ctx.actor.userId,
  );
  await ctx.db
    .update(recommendations)
    .set({
      status: 'reverted',
      decidedBy: ctx.actor.userId,
      decidedAt: ctx.now(),
      decisionReason: d.reason ?? 'Deshecho',
    })
    .where(eq(recommendations.id, rec.id));
  await writeRevision(
    ctx,
    ctx.db as never,
    plan,
    `Ajuste deshecho: ${(rec.payload as AdjustmentPayload).title}`,
  );
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'recommendation',
    entityId: rec.id,
    clientId: rec.clientId,
    changes: [
      { field: 'status', before: rec.status, after: 'reverted' },
      ...r.applied.map((a) => ({
        field: changeField(a),
        before: a.from,
        after: a.to,
      })),
    ],
    reason: d.reason ?? null,
  });
  return { reverted: r.applied.length, skipped: r.skipped };
}

async function setAutoApply_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(autoApplySchema, input);
  await authorizeClient(ctx, 'plans:write', clientId);
  requirePermission(ctx, 'decision:decide');
  const [c] = await ctx.db
    .select({ v: clients.autoApplyLoadProgressions })
    .from(clients)
    .where(eq(clients.id, clientId));
  if (c?.v === d.enabled) return;
  await ctx.db
    .update(clients)
    .set({ autoApplyLoadProgressions: d.enabled })
    .where(eq(clients.id, clientId));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'client',
    entityId: clientId,
    clientId,
    changes: [{ field: 'autoApplyLoadProgressions', before: c?.v ?? false, after: d.enabled }],
  });
}

// Use cases run under Row Level Security (see rls.ts).
export const generatePlanProposal = secured(generatePlanProposal_);
export const listPlanProposals = secured(listPlanProposals_);
export const acceptPlanProposal = secured(acceptPlanProposal_);
export const discardPlanProposal = secured(discardPlanProposal_);
export const listAdjustments = secured(listAdjustments_);
export const listPendingAdjustments = secured(listPendingAdjustments_);
export const refreshAdjustments = secured(refreshAdjustments_);
export const decideAdjustment = secured(decideAdjustment_);
export const acceptAdjustments = secured(acceptAdjustments_);
export const revertAdjustment = secured(revertAdjustment_);
export const setAutoApply = secured(setAutoApply_);
export type { AdjustmentCandidate };
