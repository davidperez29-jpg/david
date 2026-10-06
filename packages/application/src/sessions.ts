/**
 * Session execution (Fase 7, MASTER_SPECIFICATION §9 and §4.5).
 *
 * - The trainer publishes sessions of an active plan; the client only ever sees published ones.
 * - Logging is idempotent by `client_mutation_id` (offline queue replays never duplicate).
 * - Offline logs are never dropped: conflicts with later edits are stored and flagged for review.
 * - Live substitutions: pre-approved alternatives apply at once; anything else waits for the
 *   trainer, who is notified. Pain always shows the referral message; nothing is diagnosed.
 * - Pain is health data (art. 9 RGPD): stored only with the client's health-data consent.
 */
import {
  completeSessionSchema,
  decideSubstitutionSchema,
  exerciseFeedbackSchema,
  publishSchema,
  readinessSchema,
  resolveLogSchema,
  setLogSchema,
  substitutionRequestSchema,
  syncItemSchemas,
  syncSchema,
  agendaQuerySchema,
} from '@tp/contracts';
import { schema, type Database } from '@tp/db';
import {
  addDays,
  DomainError,
  hasActiveConsent,
  autoAttendance,
  localDate,
  SESSION_TRACKING_LABELS,
  trackingState,
  parseVideoUrl,
  PAIN_ALERT_THRESHOLD,
  PAIN_MESSAGE,
  pickToday,
  preloadSet,
  prescriptionForClient,
  prescriptionShort,
  resolveSubstitution,
  sessionCompletion,
  syncConflict,
  validateSetLog,
  type ConsentPurpose,
  type Prescription,
} from '@tp/domain';
import type { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { applyExerciseFeedback, scheduleMonitoring } from './monitoring';
import { secured, withSavepoint } from './rls';
import { loadPlan } from './planning';
import { parse } from './validation';

const {
  trainingPlans,
  phases,
  mesocycles,
  microcycles,
  sessions,
  sessionBlocks,
  sessionExercises,
  exercises,
  exerciseInstructions,
  exerciseMedia,
  setLogs,
  attendance,
  feedback,
  painLogs,
  readiness,
  exerciseSubstitutions,
  exerciseFeedback,
  exerciseMuscles,
  muscles,
  consents,
  clients,
  assessments,
} = schema;

type SessionPermission = 'sessions:read' | 'sessions:log' | 'sessions:review' | 'sessions:publish';

const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));
const s = (v: number | null | undefined) => (v == null ? null : String(v));
const isStaff = (ctx: RequestContext) =>
  ctx.actor.roles.includes('ADMIN') || ctx.actor.roles.includes('TRAINER');
/** True when the actor is the client the data belongs to (not staff logging in room mode). */
const isOwn = (ctx: RequestContext, clientId: string) =>
  !isStaff(ctx) && ctx.actor.clientId === clientId;

const SUBSTITUTION_LABELS: Record<string, string> = {
  pain: 'dolor o molestias',
  missing_equipment: 'falta material',
  too_difficult: 'demasiado difícil',
  space: 'falta espacio',
  preference: 'preferencia',
  fatigue: 'fatiga',
};

export function prescriptionOf(r: typeof sessionExercises.$inferSelect): Prescription {
  return {
    sets: r.sets,
    repsMin: r.repsMin,
    repsMax: r.repsMax,
    repsPerCluster: r.repsPerCluster,
    intraClusterRestS: r.intraClusterRestS,
    durationS: r.durationS,
    distanceM: n(r.distanceM),
    contacts: r.contacts,
    loadKg: n(r.loadKg),
    loadPct1rm: n(r.loadPct1rm),
    rirMin: r.rirMin,
    rirMax: r.rirMax,
    rpeTarget: n(r.rpeTarget),
    effortCharacter: r.effortCharacter,
    velocityTargetMps: n(r.velocityTargetMps),
    velocityLossPct: r.velocityLossPct,
    tempo: r.tempo,
    restS: r.restS,
    rom: r.rom as Prescription['rom'],
    intensityNote: r.intensityNote,
    chainLoadKg: n(r.chainLoadKg),
  };
}

// ── Loading & authorization ───────────────────────────────────────────────────

/**
 * Loads a session with its plan and authorizes on the client. For the client itself an
 * unpublished session does not exist (404), except when logging: an offline log for a session
 * that was unpublished meanwhile is kept and flagged (`allowUnpublished`).
 */
async function loadSession(
  ctx: RequestContext,
  sessionId: string,
  permission: SessionPermission,
  opts: { allowUnpublished?: boolean } = {},
) {
  const notFound = () => new DomainError('not_found', 'Sesión no encontrada.');
  const [row] = await ctx.db
    .select({
      session: sessions,
      plan: {
        id: trainingPlans.id,
        name: trainingPlans.name,
        status: trainingPlans.status,
      },
    })
    .from(sessions)
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
    .where(eq(sessions.id, sessionId));
  if (!row || row.session.organizationId !== ctx.actor.organizationId || !row.session.clientId)
    throw notFound();
  const clientId = row.session.clientId;
  await authorizeClient(ctx, permission, clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') throw notFound();
    throw e;
  });
  const own = isOwn(ctx, clientId);
  if (own && !row.session.published && !opts.allowUnpublished) throw notFound();
  return { session: row.session, plan: row.plan, clientId, own };
}

async function visibleExercise(ctx: RequestContext, id: string) {
  const [e] = await ctx.db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(
      and(
        eq(exercises.id, id),
        or(
          isNull(exercises.organizationId),
          eq(exercises.organizationId, ctx.actor.organizationId),
        ),
      ),
    );
  if (!e)
    throw new DomainError('validation', 'Ejercicio desconocido.', { exerciseId: ['unknown'] });
  return e;
}

async function hasHealthConsent(ctx: RequestContext, clientId: string) {
  const cs = await ctx.db.select().from(consents).where(eq(consents.clientId, clientId));
  return hasActiveConsent(
    cs.map((r) => ({
      purpose: r.purpose as ConsentPurpose,
      textVersion: r.textVersion,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
    })),
    'health_data',
  );
}

/** In-app notification to the client's active trainers (SECURITY DEFINER, see rls generate). */
async function notifyTrainers(
  ctx: RequestContext,
  clientId: string,
  type: string,
  title: string,
  body: string,
  link: string,
) {
  await ctx.db.execute(
    sql`select notify_client_trainers(${clientId}::uuid, ${type}, ${title}, ${body}, ${link})`,
  );
}

// ── Publishing ────────────────────────────────────────────────────────────────

async function publishSessions_(ctx: RequestContext, input: unknown): Promise<{ count: number }> {
  const d = parse(publishSchema, input);
  const base = ctx.db
    .select({ id: sessions.id, planId: phases.planId, published: sessions.published })
    .from(sessions)
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId));
  const rows = await base.where(
    d.scope === 'session'
      ? eq(sessions.id, d.id)
      : d.scope === 'week'
        ? eq(sessions.microcycleId, d.id)
        : eq(phases.planId, d.id),
  );
  let planId = rows[0]?.planId;
  if (!planId && d.scope === 'plan') planId = d.id;
  if (!planId && d.scope === 'week') {
    const [m] = await ctx.db
      .select({ planId: phases.planId })
      .from(microcycles)
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(microcycles.id, d.id));
    planId = m?.planId;
  }
  const notFound = new DomainError('not_found', 'No encontrado.');
  if (!planId) throw notFound;
  const [plan] = await ctx.db.select().from(trainingPlans).where(eq(trainingPlans.id, planId));
  if (!plan || plan.organizationId !== ctx.actor.organizationId || !plan.clientId) throw notFound;
  await authorizeClient(ctx, 'sessions:publish', plan.clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found') throw notFound;
    throw e;
  });
  if (d.published && plan.status !== 'active')
    throw new DomainError('conflict', 'Activa el plan antes de publicar sesiones al cliente.');
  const ids = rows.filter((r) => r.published !== d.published).map((r) => r.id);
  if (!ids.length) return { count: 0 };
  await ctx.db
    .update(sessions)
    .set({
      published: d.published,
      publishedAt: d.published ? ctx.now() : null,
      updatedBy: ctx.actor.userId,
    })
    .where(inArray(sessions.id, ids));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: d.scope === 'session' ? 'session' : d.scope === 'week' ? 'microcycle' : 'plan',
    entityId: d.id,
    clientId: plan.clientId,
    changes: [{ field: 'published', before: !d.published, after: d.published }],
    reason: `${d.published ? 'Publicadas' : 'Retiradas'} ${ids.length} sesiones`,
  });
  return { count: ids.length };
}

// ── Agenda: today and calendar ────────────────────────────────────────────────

async function clientAgenda_(ctx: RequestContext, clientId: string, query: unknown = {}) {
  const q = parse(agendaQuerySchema, query);
  await authorizeClient(ctx, 'sessions:read', clientId);
  const own = isOwn(ctx, clientId);
  const today = localDate(ctx.now());
  const from = q.from ?? addDays(today, -42);
  const to = q.to ?? addDays(today, 56);
  const rows = await ctx.db
    .select({
      id: sessions.id,
      date: sessions.scheduledDate,
      time: sessions.scheduledTime,
      title: sessions.title,
      dayLabel: sessions.dayLabel,
      objective: sessions.objective,
      estimatedDurationMin: sessions.estimatedDurationMin,
      published: sessions.published,
      planId: trainingPlans.id,
      planName: trainingPlans.name,
      weekIndex: microcycles.weekIndex,
      weekType: microcycles.weekType,
      attendance: attendance.status,
    })
    .from(sessions)
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
    .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.clientId, clientId),
        inArray(trainingPlans.status, ['active', 'completed']),
        own ? eq(sessions.published, true) : undefined,
        isNotNull(sessions.scheduledDate),
        gte(sessions.scheduledDate, from),
        lte(sessions.scheduledDate, to),
      ),
    )
    .orderBy(asc(sessions.scheduledDate), asc(sessions.position));
  const pick = pickToday(
    rows
      .filter((r) => r.published)
      .map((r) => ({ id: r.id, date: r.date, attended: r.attendance != null })),
    today,
  );
  // Planned and done assessments of the period (the client sees their own evaluation days).
  const evals = await ctx.db
    .select({ id: assessments.id, date: assessments.assessedOn, status: assessments.status })
    .from(assessments)
    .where(
      and(
        eq(assessments.clientId, clientId),
        ne(assessments.status, 'cancelled'),
        gte(assessments.assessedOn, from),
        lte(assessments.assessedOn, to),
      ),
    )
    .orderBy(asc(assessments.assessedOn));
  return {
    today,
    from,
    to,
    assessments: evals,
    next: pick.session
      ? { ...rows.find((r) => r.id === pick.session!.id)!, isToday: pick.isToday }
      : null,
    sessions: rows,
  };
}
export type ClientAgenda = Awaited<ReturnType<typeof clientAgenda_>>;

// ── Player ────────────────────────────────────────────────────────────────────

async function getPlayerSession_(ctx: RequestContext, sessionId: string) {
  const { session, plan, clientId, own } = await loadSession(ctx, sessionId, 'sessions:read');
  const blocks = await ctx.db
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, sessionId))
    .orderBy(asc(sessionBlocks.position));
  const rows = blocks.length
    ? await ctx.db
        .select({
          se: sessionExercises,
          name: exercises.name,
          description: exercises.clientDescription,
        })
        .from(sessionExercises)
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .where(
          inArray(
            sessionExercises.blockId,
            blocks.map((b) => b.id),
          ),
        )
        .orderBy(asc(sessionExercises.position))
    : [];
  const exIds = [
    ...new Set(rows.flatMap((r) => [r.se.exerciseId, ...r.se.alternativeExerciseIds])),
  ];
  const [names, cues, media, logs, history, subs, [att], [fb], worked, exFb] = await Promise.all([
    exIds.length
      ? ctx.db
          .select({ id: exercises.id, name: exercises.name })
          .from(exercises)
          .where(inArray(exercises.id, exIds))
      : [],
    exIds.length
      ? ctx.db
          .select()
          .from(exerciseInstructions)
          .where(
            and(
              inArray(exerciseInstructions.exerciseId, exIds),
              inArray(
                exerciseInstructions.audience,
                own ? ['client', 'both'] : ['client', 'both', 'trainer'],
              ),
              inArray(exerciseInstructions.kind, ['cue', 'setup', 'precaution']),
            ),
          )
          .orderBy(asc(exerciseInstructions.kind), asc(exerciseInstructions.position))
      : [],
    exIds.length
      ? ctx.db
          .select()
          .from(exerciseMedia)
          .where(
            and(inArray(exerciseMedia.exerciseId, exIds), eq(exerciseMedia.status, 'verified')),
          )
          .orderBy(desc(exerciseMedia.isPrimary))
      : [],
    ctx.db
      .select()
      .from(setLogs)
      .where(eq(setLogs.sessionId, sessionId))
      .orderBy(asc(setLogs.setIndex), asc(setLogs.loggedAt)),
    exIds.length
      ? ctx.db
          .select({
            exerciseId: setLogs.exerciseIdPerformed,
            sessionId: setLogs.sessionId,
            loggedAt: setLogs.loggedAt,
            setIndex: setLogs.setIndex,
            loadKg: setLogs.loadKg,
            reps: setLogs.reps,
            rir: setLogs.rir,
            durationS: setLogs.durationS,
          })
          .from(setLogs)
          .where(
            and(
              eq(setLogs.clientId, clientId),
              inArray(setLogs.exerciseIdPerformed, exIds),
              ne(setLogs.sessionId, sessionId),
              eq(setLogs.completed, true),
            ),
          )
          .orderBy(desc(setLogs.loggedAt))
          .limit(400)
      : [],
    ctx.db
      .select()
      .from(exerciseSubstitutions)
      .where(eq(exerciseSubstitutions.sessionId, sessionId))
      .orderBy(asc(exerciseSubstitutions.createdAt)),
    ctx.db.select().from(attendance).where(eq(attendance.sessionId, sessionId)),
    ctx.db.select().from(feedback).where(eq(feedback.sessionId, sessionId)),
    // Muscles worked, for the silhouette on each exercise card (phase 8; works offline).
    exIds.length
      ? ctx.db
          .select({
            exerciseId: exerciseMuscles.exerciseId,
            name: muscles.name,
            groupSlug: muscles.groupSlug,
            role: exerciseMuscles.role,
          })
          .from(exerciseMuscles)
          .innerJoin(muscles, eq(muscles.id, exerciseMuscles.muscleId))
          .where(inArray(exerciseMuscles.exerciseId, exIds))
      : [],
    ctx.db.select().from(exerciseFeedback).where(eq(exerciseFeedback.sessionId, sessionId)),
  ]);
  const nameOf = new Map(names.map((x) => [x.id, x.name]));
  const extra = [
    ...new Set(
      subs.flatMap((x) =>
        x.chosenExerciseId && !nameOf.has(x.chosenExerciseId) ? [x.chosenExerciseId] : [],
      ),
    ),
  ];
  if (extra.length)
    for (const x of await ctx.db
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(inArray(exercises.id, extra)))
      nameOf.set(x.id, x.name);
  /** Last time each exercise was done: all sets of that most recent session. */
  const last = new Map<
    string,
    {
      date: string;
      sets: {
        loadKg: number | null;
        reps: number | null;
        rir: number | null;
        durationS: number | null;
      }[];
    }
  >();
  for (const h of history) {
    const cur = last.get(h.exerciseId);
    if (!cur) {
      last.set(h.exerciseId, {
        date: h.loggedAt.toISOString().slice(0, 10),
        sets: [],
      });
    }
  }
  const lastSession = new Map<string, string>();
  for (const h of history)
    if (!lastSession.has(h.exerciseId)) lastSession.set(h.exerciseId, h.sessionId);
  for (const h of [...history].reverse())
    if (lastSession.get(h.exerciseId) === h.sessionId)
      last
        .get(h.exerciseId)!
        .sets.push({ loadKg: n(h.loadKg), reps: h.reps, rir: h.rir, durationS: h.durationS });

  let prescribedSets = 0;
  const done = new Set<string>();
  for (const l of logs)
    if (l.completed && l.sessionExerciseId)
      done.add(`${l.sessionExerciseId}:${l.setIndex}:${l.side ?? ''}`);
  const out = {
    id: session.id,
    clientId,
    title: session.title,
    dayLabel: session.dayLabel,
    objective: session.objective,
    scheduledDate: session.scheduledDate,
    estimatedDurationMin: session.estimatedDurationMin,
    notesForClient: session.notesForClient,
    notesForTrainer: own ? null : session.notesForTrainer,
    published: session.published,
    plan,
    /** Sent back with offline logs: later edits flag them for review (§4.5). */
    downloadedAt: ctx.now().toISOString(),
    blocks: blocks.map((b) => ({
      id: b.id,
      label: b.label,
      type: b.type,
      organization: b.organization,
      rounds: b.rounds,
      restBetweenRoundsS: b.restBetweenRoundsS,
      notes: b.notes,
      exercises: rows
        .filter((r) => r.se.blockId === b.id)
        .map((r) => {
          const p = prescriptionOf(r.se);
          const sets = Math.max(1, p.sets ?? 1) * (r.se.side === 'each' ? 2 : 1);
          prescribedSets += sets;
          const lastPerf = last.get(r.se.exerciseId) ?? null;
          const m = media.find((x) => x.exerciseId === r.se.exerciseId);
          const exSubs = subs.filter((x) => x.sessionExerciseId === r.se.id);
          const approved = [...exSubs].reverse().find((x) => x.decidedAt && x.chosenExerciseId);
          return {
            id: r.se.id,
            exerciseId: r.se.exerciseId,
            name: r.name,
            description: r.description,
            pairingLabel: r.se.pairingLabel,
            side: r.se.side,
            sets: Math.max(1, p.sets ?? 1),
            restS: p.restS,
            prescription: p,
            clientText: prescriptionForClient(p),
            short: prescriptionShort(p),
            notesForClient: r.se.notesForClient,
            coachNotes: own ? null : r.se.coachNotes,
            muscles: worked
              .filter((w) => w.exerciseId === (approved?.chosenExerciseId ?? r.se.exerciseId))
              .map((w) => ({ name: w.name, groupSlug: w.groupSlug, role: w.role })),
            feedback: (() => {
              const f = exFb.find((x) => x.sessionExerciseId === r.se.id);
              return f ? { feel: f.feel, discomfort: f.discomfort } : null;
            })(),
            cues: cues
              .filter((c) => c.exerciseId === r.se.exerciseId)
              .map((c) => ({ kind: c.kind, text: c.text })),
            /** Only verified videos, embedded with privacy-friendly players (§28). */
            video:
              m && m.type === 'video'
                ? { embedUrl: parseVideoUrl(m.urlOrKey)?.embedUrl ?? null, title: m.title }
                : null,
            alternatives: r.se.alternativeExerciseIds.map((id) => ({
              id,
              name: nameOf.get(id) ?? '—',
              last: last.get(id) ?? null,
            })),
            last: lastPerf,
            preload: preloadSet(
              {
                sets: p.sets ?? null,
                repsMin: p.repsMin ?? null,
                repsMax: p.repsMax ?? null,
                loadKg: p.loadKg ?? null,
                rirMin: p.rirMin ?? null,
                durationS: p.durationS ?? null,
                distanceM: p.distanceM ?? null,
              },
              lastPerf?.sets.at(-1) ?? null,
            ),
            /** Exercise currently performed (approved substitution, if any). */
            performedExerciseId: approved?.chosenExerciseId ?? r.se.exerciseId,
            performedName: approved?.chosenExerciseId
              ? (nameOf.get(approved.chosenExerciseId) ?? null)
              : r.name,
            substitutions: exSubs.map((x) => ({
              id: x.id,
              reason: x.reason,
              status: x.decidedAt ? (x.chosenExerciseId ? 'approved' : 'rejected') : 'pending',
              chosenExerciseId: x.chosenExerciseId,
              chosenName: x.chosenExerciseId ? (nameOf.get(x.chosenExerciseId) ?? null) : null,
              comment: x.comment,
            })),
            logs: logs
              .filter((l) => l.sessionExerciseId === r.se.id)
              .map((l) => ({
                id: l.id,
                clientMutationId: l.clientMutationId,
                exerciseId: l.exerciseIdPerformed,
                setIndex: l.setIndex,
                side: l.side,
                loadKg: n(l.loadKg),
                reps: l.reps,
                rir: l.rir,
                rpe: n(l.rpe),
                durationS: l.durationS,
                distanceM: n(l.distanceM),
                completed: l.completed,
                loggedByRole: l.loggedByRole,
                needsReview: l.needsReview,
                reviewReason: l.reviewReason,
              })),
          };
        }),
    })),
    /** Logs whose planned exercise no longer exists (kept, flagged). */
    orphanLogs: logs
      .filter((l) => !l.sessionExerciseId)
      .map((l) => ({
        id: l.id,
        setIndex: l.setIndex,
        exerciseId: l.exerciseIdPerformed,
        loadKg: n(l.loadKg),
        reps: l.reps,
        needsReview: l.needsReview,
        reviewReason: l.reviewReason,
      })),
    /** Planificada · Iniciada · Completada · Incompleta · No realizada (fichaje, phase 8). */
    tracking: SESSION_TRACKING_LABELS[trackingState(att?.status)],
    attendance: att
      ? {
          status: att.status,
          automatic: att.automatic,
          performedDate: att.performedDate,
          durationMin: att.durationMin,
          reasonCode: att.reasonCode,
          reasonText: att.reasonText,
        }
      : null,
    feedback: fb
      ? {
          sessionRpe: n(fb.sessionRpe),
          feeling: fb.feeling,
          feel: fb.feel,
          fatigue: fb.fatigue,
          motivation: fb.motivation,
          pain: fb.pain,
          comment: fb.comment,
        }
      : null,
    completion: {
      percent: 0,
      status: 'partial' as 'partial' | 'completed',
      prescribedSets: 0,
      completedSets: done.size,
    },
  };
  out.completion = {
    ...sessionCompletion(prescribedSets, done.size),
    prescribedSets,
    completedSets: done.size,
  };
  return out;
}
export type PlayerSession = Awaited<ReturnType<typeof getPlayerSession_>>;

// ── Logging (idempotent) ──────────────────────────────────────────────────────

export type MutationStatus = 'applied' | 'duplicate' | 'flagged';

async function applySetLog(
  ctx: RequestContext,
  d: z.infer<typeof setLogSchema>,
): Promise<{ id: string; status: MutationStatus; reviewReason: string | null }> {
  const [dup] = await ctx.db
    .select({ id: setLogs.id, reviewReason: setLogs.reviewReason })
    .from(setLogs)
    .where(eq(setLogs.clientMutationId, d.clientMutationId));
  if (dup) return { id: dup.id, status: 'duplicate', reviewReason: dup.reviewReason };
  const errors = validateSetLog(d);
  if (Object.keys(errors).length)
    throw new DomainError('validation', 'Registro no válido.', errors);
  const { session, clientId, own } = await loadSession(ctx, d.sessionId, 'sessions:log', {
    allowUnpublished: true,
  });
  await visibleExercise(ctx, d.exerciseId);
  const [se] = d.sessionExerciseId
    ? await ctx.db
        .select({ se: sessionExercises })
        .from(sessionExercises)
        .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
        .where(
          and(
            eq(sessionExercises.id, d.sessionExerciseId),
            eq(sessionBlocks.sessionId, session.id),
          ),
        )
        .then((r) => r.map((x) => x.se))
    : [];
  let approvedSub = false;
  if (se && se.exerciseId !== d.exerciseId && !se.alternativeExerciseIds.includes(d.exerciseId)) {
    const [sub] = await ctx.db
      .select({ id: exerciseSubstitutions.id })
      .from(exerciseSubstitutions)
      .where(
        and(
          eq(exerciseSubstitutions.sessionExerciseId, se.id),
          eq(exerciseSubstitutions.chosenExerciseId, d.exerciseId),
          isNotNull(exerciseSubstitutions.decidedAt),
        ),
      );
    approvedSub = !!sub;
  }
  const downloadedAt = d.downloadedAt ? new Date(d.downloadedAt) : null;
  const conflict = syncConflict({
    sessionExerciseExists: !d.sessionExerciseId || !!se,
    sessionPublished: session.published || !own,
    sessionEditedAfter:
      !!downloadedAt && (session.updatedAt > downloadedAt || (!!se && se.updatedAt > downloadedAt)),
    performedMatches:
      !se ||
      se.exerciseId === d.exerciseId ||
      se.alternativeExerciseIds.includes(d.exerciseId) ||
      approvedSub,
  });
  const now = ctx.now();
  let loggedAt = d.loggedAt ? new Date(d.loggedAt) : now;
  if (loggedAt.getTime() > now.getTime() + 5 * 60_000) loggedAt = now;
  const values = {
    loadKg: s(d.loadKg),
    reps: d.reps ?? null,
    rir: d.rir ?? null,
    rpe: s(d.rpe),
    durationS: d.durationS ?? null,
    distanceM: s(d.distanceM),
    completed: d.completed,
    loggedByRole: own ? ('client' as const) : ('trainer' as const),
    loggedBy: ctx.actor.userId,
    loggedAt,
    needsReview: !!conflict,
    reviewReason: conflict,
  };
  // Correcting a set already logged (same set, same exercise) updates it instead of adding one.
  if (se) {
    const [prev] = await ctx.db
      .select({ id: setLogs.id })
      .from(setLogs)
      .where(
        and(
          eq(setLogs.sessionExerciseId, se.id),
          eq(setLogs.setIndex, d.setIndex),
          eq(setLogs.exerciseIdPerformed, d.exerciseId),
          d.side ? eq(setLogs.side, d.side) : isNull(setLogs.side),
        ),
      );
    if (prev) {
      await ctx.db.update(setLogs).set(values).where(eq(setLogs.id, prev.id));
      return { id: prev.id, status: conflict ? 'flagged' : 'applied', reviewReason: conflict };
    }
  }
  const [row] = await ctx.db
    .insert(setLogs)
    .values({
      organizationId: session.organizationId,
      clientId,
      sessionId: session.id,
      sessionExerciseId: se?.id ?? null,
      exerciseIdPerformed: d.exerciseId,
      setIndex: d.setIndex,
      side: d.side ?? null,
      clientMutationId: d.clientMutationId,
      source: 'manual',
      ...values,
    })
    .onConflictDoNothing({ target: setLogs.clientMutationId })
    .returning({ id: setLogs.id });
  if (!row) return { id: '', status: 'duplicate', reviewReason: null };
  if (d.completed) await markStarted(ctx, session.organizationId, clientId, session.id);
  return { id: row.id, status: conflict ? 'flagged' : 'applied', reviewReason: conflict };
}

/**
 * Fichaje automático (restructure phase 8, §41): the first logged set marks the session
 * «iniciada». A closing record (completed, incomplete, not done) is never overwritten.
 */
async function markStarted(
  ctx: RequestContext,
  organizationId: string,
  clientId: string,
  sessionId: string,
) {
  await ctx.db
    .insert(attendance)
    .values({
      organizationId,
      clientId,
      sessionId,
      status: 'started',
      performedDate: localDate(ctx.now()),
      recordedBy: ctx.actor.userId,
    })
    .onConflictDoNothing({ target: attendance.sessionId });
}

async function logSet_(ctx: RequestContext, input: unknown) {
  return applySetLog(ctx, parse(setLogSchema, input));
}

async function deleteSetLog_(ctx: RequestContext, id: string): Promise<void> {
  const [l] = await ctx.db.select().from(setLogs).where(eq(setLogs.id, id));
  if (!l) throw new DomainError('not_found', 'Registro no encontrado.');
  const { own } = await loadSession(ctx, l.sessionId, 'sessions:log', { allowUnpublished: true });
  const [att] = await ctx.db
    .select({ id: attendance.id })
    .from(attendance)
    .where(eq(attendance.sessionId, l.sessionId));
  if (own && att)
    throw new DomainError(
      'conflict',
      'La sesión ya está cerrada. Pide a tu entrenador/a que lo corrija.',
    );
  await ctx.db.delete(setLogs).where(eq(setLogs.id, id));
  if (!own)
    await writeAudit(ctx.db, ctx, {
      action: 'delete',
      entityType: 'set_log',
      entityId: id,
      clientId: l.clientId,
      changes: { setIndex: l.setIndex, loadKg: l.loadKg, reps: l.reps },
    });
}

// ── Live substitution ─────────────────────────────────────────────────────────

async function applySubstitution(
  ctx: RequestContext,
  d: z.infer<typeof substitutionRequestSchema>,
): Promise<{
  id: string;
  status: 'approved' | 'pending' | 'duplicate';
  chosenExerciseId: string | null;
  message: string | null;
}> {
  const [dup] = await ctx.db
    .select()
    .from(exerciseSubstitutions)
    .where(eq(exerciseSubstitutions.clientMutationId, d.clientMutationId));
  if (dup)
    return {
      id: dup.id,
      status: 'duplicate',
      chosenExerciseId: dup.chosenExerciseId,
      message: dup.reason === 'pain' ? PAIN_MESSAGE : null,
    };
  const [row] = await ctx.db
    .select({ se: sessionExercises, sessionId: sessionBlocks.sessionId, name: exercises.name })
    .from(sessionExercises)
    .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(eq(sessionExercises.id, d.sessionExerciseId));
  if (!row) throw new DomainError('not_found', 'Ejercicio no encontrado en la sesión.');
  const { session, clientId, own } = await loadSession(ctx, row.sessionId, 'sessions:log', {
    allowUnpublished: true,
  });
  const chosen = d.chosenExerciseId ?? null;
  if (chosen) await visibleExercise(ctx, chosen);
  // Staff in room mode decide on the spot; a client only gets the pre-approved alternatives.
  const res = resolveSubstitution(
    d.reason,
    chosen,
    own ? row.se.alternativeExerciseIds : chosen ? [chosen] : [],
  );
  const approved = res.status === 'approved';
  const [sub] = await ctx.db
    .insert(exerciseSubstitutions)
    .values({
      organizationId: session.organizationId,
      clientId,
      sessionId: session.id,
      sessionExerciseId: row.se.id,
      originalExerciseId: row.se.exerciseId,
      reason: d.reason,
      suggestions: { alternatives: row.se.alternativeExerciseIds, requested: chosen },
      chosenExerciseId: chosen,
      decidedBy: approved && !own ? ctx.actor.userId : null,
      decidedAt: approved ? ctx.now() : null,
      comment:
        [approved && own ? 'Alternativa pre-aprobada por el entrenador.' : null, d.comment]
          .filter(Boolean)
          .join(' ') || null,
      clientMutationId: d.clientMutationId,
    })
    .onConflictDoNothing({ target: exerciseSubstitutions.clientMutationId })
    .returning({ id: exerciseSubstitutions.id });
  if (!sub) return { id: '', status: 'duplicate', chosenExerciseId: chosen, message: null };
  if (own && res.notifyTrainer)
    await notifyTrainers(
      ctx,
      clientId,
      d.reason === 'pain' ? 'session_pain' : 'substitution_request',
      d.reason === 'pain' ? 'Molestias durante la sesión' : 'Solicitud de cambio de ejercicio',
      `${row.name}: ${SUBSTITUTION_LABELS[d.reason]}${approved ? ' (alternativa pre-aprobada aplicada)' : ' · pendiente de tu decisión'}.`,
      `/app/clients/${clientId}/sessions/${session.id}`,
    );
  if (!own)
    await writeAudit(ctx.db, ctx, {
      action: 'create',
      entityType: 'exercise_substitution',
      entityId: sub.id,
      clientId,
      changes: { from: row.se.exerciseId, to: chosen, reason: d.reason },
    });
  return {
    id: sub.id,
    status: res.status,
    chosenExerciseId: approved ? chosen : null,
    message: res.message,
  };
}

async function requestSubstitution_(ctx: RequestContext, input: unknown) {
  return applySubstitution(ctx, parse(substitutionRequestSchema, input));
}

// ── Completion & feedback ─────────────────────────────────────────────────────

async function applyComplete(
  ctx: RequestContext,
  sessionId: string,
  d: z.infer<typeof completeSessionSchema>,
) {
  const { session, clientId, own } = await loadSession(ctx, sessionId, 'sessions:log', {
    allowUnpublished: true,
  });
  const ses = await ctx.db
    .select({ sets: sessionExercises.sets, side: sessionExercises.side })
    .from(sessionExercises)
    .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
    .where(eq(sessionBlocks.sessionId, sessionId));
  const prescribed = ses.reduce(
    (a, x) => a + Math.max(1, x.sets ?? 1) * (x.side === 'each' ? 2 : 1),
    0,
  );
  const [{ done } = { done: 0 }] = await ctx.db
    .select({
      done: sql<number>`count(distinct (${setLogs.sessionExerciseId}, ${setLogs.setIndex}, coalesce(${setLogs.side}, '')))::int`,
    })
    .from(setLogs)
    .where(
      and(
        eq(setLogs.sessionId, sessionId),
        eq(setLogs.completed, true),
        isNotNull(setLogs.sessionExerciseId),
      ),
    );
  const computed = sessionCompletion(prescribed, done);
  const status = d.status ?? (done === 0 ? 'missed' : computed.status);
  if (status !== 'completed' && !d.reasonCode && !d.reasonText)
    throw new DomainError('validation', 'Indica el motivo de la sesión incompleta.', {
      reasonCode: ['required'],
    });
  const consented = d.pain || own ? await hasHealthConsent(ctx, clientId) : false;
  const performedDate = d.performedDate ?? localDate(ctx.now());
  const attValues = {
    status,
    performedDate: status === 'missed' ? null : performedDate,
    durationMin: d.durationMin ?? null,
    reasonCode: status === 'completed' ? null : (d.reasonCode ?? null),
    reasonText: status === 'completed' ? null : (d.reasonText ?? null),
    recordedBy: ctx.actor.userId,
    automatic: false,
  };
  await ctx.db
    .insert(attendance)
    .values({ organizationId: session.organizationId, clientId, sessionId, ...attValues })
    .onConflictDoUpdate({ target: attendance.sessionId, set: attValues });
  const fbValues = {
    sessionRpe: s(d.sessionRpe),
    feeling: d.feeling ?? null,
    feel: d.feel ?? null,
    fatigue: d.fatigue ?? null,
    motivation: d.motivation ?? null,
    comment: d.comment ?? null,
    pain: d.pain && consented ? d.pain.intensity : null,
  };
  if (Object.values(fbValues).some((v) => v != null))
    await ctx.db
      .insert(feedback)
      .values({ organizationId: session.organizationId, clientId, sessionId, ...fbValues })
      .onConflictDoUpdate({ target: feedback.sessionId, set: fbValues });
  let painStored = false;
  if (d.pain && consented) {
    const [exists] = await ctx.db
      .select({ id: painLogs.id })
      .from(painLogs)
      .where(
        and(
          eq(painLogs.sessionId, sessionId),
          eq(painLogs.bodyRegion, d.pain.bodyRegion),
          eq(painLogs.context, d.pain.context),
        ),
      );
    if (exists)
      await ctx.db
        .update(painLogs)
        .set({ intensity: d.pain.intensity })
        .where(eq(painLogs.id, exists.id));
    else
      await ctx.db.insert(painLogs).values({
        organizationId: session.organizationId,
        clientId,
        sessionId,
        occurredOn: performedDate,
        bodyRegion: d.pain.bodyRegion,
        intensity: d.pain.intensity,
        context: d.pain.context,
      });
    painStored = true;
    if (own && d.pain.intensity >= PAIN_ALERT_THRESHOLD)
      await notifyTrainers(
        ctx,
        clientId,
        'session_pain',
        'Dolor declarado al terminar la sesión',
        `Intensidad ${d.pain.intensity}/10 (${d.pain.bodyRegion}). Revisa la sesión y contacta con el cliente.`,
        `/app/clients/${clientId}/sessions/${sessionId}`,
      );
  }
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'session',
    entityId: sessionId,
    clientId,
    changes: [{ field: 'attendance', before: null, after: status }],
    reason: own ? 'Registrada por el cliente' : 'Registrada por el entrenador (modo sala)',
  });
  scheduleMonitoring(ctx, clientId);
  return {
    status,
    completion: { ...computed, prescribedSets: prescribed, completedSets: done },
    painStored,
    message: d.pain && d.pain.intensity > 0 ? PAIN_MESSAGE : null,
  };
}

async function completeSession_(ctx: RequestContext, sessionId: string, input: unknown) {
  return applyComplete(ctx, sessionId, parse(completeSessionSchema, input));
}

// ── Offline sync ──────────────────────────────────────────────────────────────

export interface SyncResult {
  clientMutationId: string;
  type: 'set' | 'substitution' | 'complete' | 'exercise_feedback';
  status: MutationStatus | 'approved' | 'pending' | 'rejected';
  id?: string;
  message?: string | null;
  fields?: Record<string, string[]>;
}

/**
 * Replays the device queue in order. Each mutation runs in its own savepoint: one invalid
 * mutation is rejected (and reported) without losing the others. Replaying the same queue
 * twice is a no-op (`duplicate`).
 */
async function syncMutations_(
  ctx: RequestContext,
  input: unknown,
): Promise<{ results: SyncResult[] }> {
  const d = parse(syncSchema, input);
  const results: SyncResult[] = [];
  for (const m of d.mutations) {
    try {
      const r = await withSavepoint(ctx, async (c) => {
        if (m.type === 'set') {
          const o = await applySetLog(c, parse(syncItemSchemas.set, m));
          return { status: o.status, id: o.id, message: o.reviewReason };
        }
        if (m.type === 'substitution') {
          const o = await applySubstitution(c, parse(syncItemSchemas.substitution, m));
          return { status: o.status, id: o.id, message: o.message };
        }
        if (m.type === 'exercise_feedback') {
          const o = await applyExerciseFeedback(
            c,
            parse(syncItemSchemas.exercise_feedback, m),
            sessionExerciseFor,
          );
          return { status: 'applied' as const, id: m.clientMutationId, message: null, ...o };
        }
        const { sessionId, ...x } = parse(syncItemSchemas.complete, m);
        const o = await applyComplete(c, sessionId, x);
        return { status: 'applied' as const, id: sessionId, message: o.message };
      });
      results.push({ clientMutationId: m.clientMutationId, type: m.type, ...r });
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
      results.push({
        clientMutationId: m.clientMutationId,
        type: m.type,
        status: 'rejected',
        message: e.message,
        fields: e.details as Record<string, string[]> | undefined,
      });
    }
  }
  return { results };
}

// ── Readiness ─────────────────────────────────────────────────────────────────

async function saveReadiness_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<void> {
  const d = parse(readinessSchema, input);
  await authorizeClient(ctx, 'sessions:log', clientId);
  const values = {
    sleepQuality: d.sleepQuality ?? null,
    sleepHours: s(d.sleepHours),
    energy: d.energy ?? null,
    fatigue: d.fatigue ?? null,
    stress: d.stress ?? null,
    soreness: d.soreness ?? null,
    motivation: d.motivation ?? null,
    comment: d.comment ?? null,
  };
  await ctx.db
    .insert(readiness)
    .values({
      organizationId: ctx.actor.organizationId,
      clientId,
      recordedOn: d.recordedOn,
      ...values,
    })
    .onConflictDoUpdate({ target: [readiness.clientId, readiness.recordedOn], set: values });
  scheduleMonitoring(ctx, clientId);
}

/** Session exercise → its session, authorized for logging (unpublished allowed: offline). */
async function sessionExerciseFor(ctx: RequestContext, sessionExerciseId: string) {
  const [row] = await ctx.db
    .select({ sessionId: sessionBlocks.sessionId })
    .from(sessionExercises)
    .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
    .where(eq(sessionExercises.id, sessionExerciseId));
  if (!row) throw new DomainError('not_found', 'Ejercicio no encontrado en la sesión.');
  const { session, clientId, own } = await loadSession(ctx, row.sessionId, 'sessions:log', {
    allowUnpublished: true,
  });
  return { sessionId: session.id, organizationId: session.organizationId, clientId, own };
}

async function saveExerciseFeedback_(ctx: RequestContext, input: unknown) {
  return applyExerciseFeedback(ctx, parse(exerciseFeedbackSchema, input), sessionExerciseFor);
}

async function getReadiness_(ctx: RequestContext, clientId: string, on: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on))
    throw new DomainError('validation', 'Fecha no válida.', { on: ['invalid_date'] });
  await authorizeClient(ctx, 'sessions:read', clientId);
  const [r] = await ctx.db
    .select()
    .from(readiness)
    .where(and(eq(readiness.clientId, clientId), eq(readiness.recordedOn, on)));
  return r ? { ...r, sleepHours: n(r.sleepHours) } : null;
}

// ── Trainer review ────────────────────────────────────────────────────────────

async function clientSessionReview_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'sessions:review', clientId);
  const today = localDate(ctx.now());
  const [done, flagged, pending] = await Promise.all([
    ctx.db
      .select({
        id: sessions.id,
        date: sessions.scheduledDate,
        title: sessions.title,
        dayLabel: sessions.dayLabel,
        published: sessions.published,
        planName: trainingPlans.name,
        status: attendance.status,
        performedDate: attendance.performedDate,
        reasonCode: attendance.reasonCode,
        sessionRpe: feedback.sessionRpe,
        fatigue: feedback.fatigue,
        pain: feedback.pain,
        comment: feedback.comment,
      })
      .from(sessions)
      .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
      .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
      .leftJoin(feedback, eq(feedback.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.clientId, clientId),
          or(
            isNotNull(attendance.id),
            and(eq(sessions.published, true), lte(sessions.scheduledDate, today)),
            sql`EXISTS (SELECT 1 FROM set_logs l WHERE l.session_id = ${sessions.id})`,
          ),
        ),
      )
      .orderBy(desc(sessions.scheduledDate))
      .limit(40),
    ctx.db
      .select({ sessionId: setLogs.sessionId, count: sql<number>`count(*)::int` })
      .from(setLogs)
      .where(and(eq(setLogs.clientId, clientId), eq(setLogs.needsReview, true)))
      .groupBy(setLogs.sessionId),
    ctx.db
      .select({ sessionId: exerciseSubstitutions.sessionId, count: sql<number>`count(*)::int` })
      .from(exerciseSubstitutions)
      .where(
        and(eq(exerciseSubstitutions.clientId, clientId), isNull(exerciseSubstitutions.decidedAt)),
      )
      .groupBy(exerciseSubstitutions.sessionId),
  ]);
  return done.map((r) => ({
    ...r,
    sessionRpe: n(r.sessionRpe),
    flaggedLogs: flagged.find((f) => f.sessionId === r.id)?.count ?? 0,
    pendingSubstitutions: pending.find((p) => p.sessionId === r.id)?.count ?? 0,
  }));
}

/** Pending items across the trainer's clients (RLS keeps it to assigned clients). */
async function reviewInbox_(ctx: RequestContext) {
  requirePermission(ctx, 'sessions:review');
  const today = localDate(ctx.now());
  const [subs, logs, todays] = await Promise.all([
    ctx.db
      .select({
        id: exerciseSubstitutions.id,
        clientId: exerciseSubstitutions.clientId,
        sessionId: exerciseSubstitutions.sessionId,
        reason: exerciseSubstitutions.reason,
        createdAt: exerciseSubstitutions.createdAt,
        exercise: exercises.name,
        firstName: clients.firstName,
        lastName: clients.lastName,
      })
      .from(exerciseSubstitutions)
      .innerJoin(exercises, eq(exercises.id, exerciseSubstitutions.originalExerciseId))
      .innerJoin(clients, eq(clients.id, exerciseSubstitutions.clientId))
      .where(isNull(exerciseSubstitutions.decidedAt))
      .orderBy(desc(exerciseSubstitutions.createdAt))
      .limit(50),
    ctx.db
      .select({
        sessionId: setLogs.sessionId,
        clientId: setLogs.clientId,
        count: sql<number>`count(*)::int`,
        reason: sql<string>`min(${setLogs.reviewReason})`,
        firstName: clients.firstName,
        lastName: clients.lastName,
      })
      .from(setLogs)
      .innerJoin(clients, eq(clients.id, setLogs.clientId))
      .where(eq(setLogs.needsReview, true))
      .groupBy(setLogs.sessionId, setLogs.clientId, clients.firstName, clients.lastName)
      .limit(50),
    ctx.db
      .select({
        id: sessions.id,
        clientId: sessions.clientId,
        title: sessions.title,
        dayLabel: sessions.dayLabel,
        time: sessions.scheduledTime,
        published: sessions.published,
        attendance: attendance.status,
        firstName: clients.firstName,
        lastName: clients.lastName,
      })
      .from(sessions)
      .innerJoin(clients, eq(clients.id, sessions.clientId))
      .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
      .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
      .where(and(eq(sessions.scheduledDate, today), eq(trainingPlans.status, 'active')))
      .orderBy(asc(sessions.scheduledTime), asc(clients.lastName))
      .limit(100),
  ]);
  return { today, substitutions: subs, flaggedLogs: logs, sessionsToday: todays };
}

async function decideSubstitution_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const d = parse(decideSubstitutionSchema, input);
  const [sub] = await ctx.db
    .select()
    .from(exerciseSubstitutions)
    .where(eq(exerciseSubstitutions.id, id));
  if (!sub) throw new DomainError('not_found', 'Sustitución no encontrada.');
  await authorizeClient(ctx, 'sessions:review', sub.clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Sustitución no encontrada.');
    throw e;
  });
  const chosen = d.approve ? (d.chosenExerciseId ?? sub.chosenExerciseId) : null;
  if (d.approve && !chosen)
    throw new DomainError('validation', 'Elige el ejercicio que la sustituye.', {
      chosenExerciseId: ['required'],
    });
  if (chosen) await visibleExercise(ctx, chosen);
  // Adding the alternative changes the plan: not allowed on a completed or archived plan
  // (restructure phase 10); checked before anything is written.
  if (d.approve && d.addAsAlternative && chosen && sub.sessionExerciseId) {
    const [owner] = await ctx.db
      .select({ planId: phases.planId })
      .from(sessionExercises)
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
      .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
      .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(sessionExercises.id, sub.sessionExerciseId));
    if (owner) await loadPlan(ctx, owner.planId, 'plans:write');
  }
  await ctx.db
    .update(exerciseSubstitutions)
    .set({
      chosenExerciseId: chosen,
      decidedBy: ctx.actor.userId,
      decidedAt: ctx.now(),
      comment: [sub.comment, d.comment].filter(Boolean).join(' · ') || null,
    })
    .where(eq(exerciseSubstitutions.id, id));
  if (d.approve && d.addAsAlternative && chosen && sub.sessionExerciseId) {
    await authorizeClient(ctx, 'plans:write', sub.clientId);
    await ctx.db
      .update(sessionExercises)
      .set({
        alternativeExerciseIds: sql`(SELECT array_agg(DISTINCT x) FROM unnest(array_append(${sessionExercises.alternativeExerciseIds}, ${chosen}::uuid)) x)`,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(sessionExercises.id, sub.sessionExerciseId));
  }
  // Logs of the chosen exercise that were flagged only for not matching the plan are now fine.
  if (chosen && sub.sessionExerciseId)
    await ctx.db
      .update(setLogs)
      .set({ needsReview: false, reviewReason: null })
      .where(
        and(
          eq(setLogs.sessionExerciseId, sub.sessionExerciseId),
          eq(setLogs.exerciseIdPerformed, chosen),
          sql`${setLogs.reviewReason} LIKE 'Ejercicio realizado distinto%'`,
        ),
      );
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'exercise_substitution',
    entityId: id,
    clientId: sub.clientId,
    changes: [
      {
        field: 'decision',
        before: 'pending',
        after: d.approve ? `approved:${chosen}` : 'rejected',
      },
    ],
    reason: d.comment ?? null,
  });
}

async function resolveSetLogReview_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<void> {
  const d = parse(resolveLogSchema, input);
  const [l] = await ctx.db.select().from(setLogs).where(eq(setLogs.id, id));
  if (!l) throw new DomainError('not_found', 'Registro no encontrado.');
  await authorizeClient(ctx, 'sessions:review', l.clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Registro no encontrado.');
    throw e;
  });
  await ctx.db.update(setLogs).set({ needsReview: false }).where(eq(setLogs.id, id));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'set_log',
    entityId: id,
    clientId: l.clientId,
    changes: [{ field: 'needsReview', before: true, after: false }],
    reason: [l.reviewReason, d.note].filter(Boolean).join(' · ') || null,
  });
}

// Use cases run under Row Level Security (see rls.ts).
// ── Fichaje automático (daily job) ────────────────────────────────────────────

/** How far back the daily job looks: older sessions keep whatever was (not) recorded. */
export const AUTO_ATTENDANCE_WINDOW_DAYS = 30;

/**
 * Restructure phase 8 (§41), run once a day as the system: a published session whose day has
 * passed becomes «no realizada» when nothing was recorded, and «incompleta» when it was started
 * and never closed. Marked `automatic`; the client or the trainer can still close it themselves
 * (their record replaces it).
 */
export async function autoCloseSessions(app: { db: Database; now: () => Date }) {
  const today = localDate(app.now());
  const from = addDays(today, -AUTO_ATTENDANCE_WINDOW_DAYS);
  const rows = await app.db
    .select({
      id: sessions.id,
      organizationId: sessions.organizationId,
      clientId: sessions.clientId,
      date: sessions.scheduledDate,
      published: sessions.published,
      status: attendance.status,
      performedDate: attendance.performedDate,
    })
    .from(sessions)
    .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.published, true),
        isNotNull(sessions.clientId),
        or(
          and(
            isNull(attendance.id),
            gte(sessions.scheduledDate, from),
            sql`${sessions.scheduledDate} < ${today}`,
          ),
          eq(attendance.status, 'started'),
        ),
      ),
    );
  let missed = 0;
  let partial = 0;
  for (const r of rows) {
    // A started session is judged by the day it was started (the client may train another day).
    const decision = autoAttendance({
      date: r.status === 'started' ? (r.performedDate ?? r.date) : r.date,
      published: r.published,
      status: r.status,
      today,
    });
    if (decision === 'missed') {
      const [ins] = await app.db
        .insert(attendance)
        .values({
          organizationId: r.organizationId,
          clientId: r.clientId!,
          sessionId: r.id,
          status: 'missed',
          automatic: true,
          recordedBy: null,
        })
        .onConflictDoNothing({ target: attendance.sessionId })
        .returning({ id: attendance.id });
      if (ins) missed++;
    } else if (decision === 'partial') {
      const upd = await app.db
        .update(attendance)
        .set({ status: 'partial', automatic: true, updatedAt: app.now() })
        .where(and(eq(attendance.sessionId, r.id), eq(attendance.status, 'started')))
        .returning({ id: attendance.id });
      partial += upd.length;
    }
  }
  return { missed, partial };
}

export const publishSessions = secured(publishSessions_);
export const clientAgenda = secured(clientAgenda_);
export const getPlayerSession = secured(getPlayerSession_);
export const logSet = secured(logSet_);
export const deleteSetLog = secured(deleteSetLog_);
export const requestSubstitution = secured(requestSubstitution_);
export const completeSession = secured(completeSession_);
export const syncMutations = secured(syncMutations_);
export const saveExerciseFeedback = secured(saveExerciseFeedback_);
export const saveReadiness = secured(saveReadiness_);
export const getReadiness = secured(getReadiness_);
export const clientSessionReview = secured(clientSessionReview_);
export const reviewInbox = secured(reviewInbox_);
export const decideSubstitution = secured(decideSubstitution_);
export const resolveSetLogReview = secured(resolveSetLogReview_);
