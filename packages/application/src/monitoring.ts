/**
 * Monitoring (Fase 8, MASTER_SPECIFICATION §13.7): adherence, internal load, wellness and alerts.
 *
 * Alerts are evaluated by system code (`monitorClient`) after each relevant event commits
 * (session closed, exercise feedback, readiness, assessment completed) and by a daily job.
 * The rules are pure (`@tp/domain` monitoring) and configurable per organization (ADMIN), and
 * each rule can be switched off for one client. Alerts describe; they never diagnose.
 */
import {
  alertStatusSchema,
  alertsQuerySchema,
  clientRuleOverrideSchema,
  exerciseFeedbackSchema,
  monitoringRulesSchema,
} from '@tp/contracts';
import { schema, type Database } from '@tp/db';
import {
  addDays,
  adherence,
  DomainError,
  evaluateAlerts,
  hasActiveConsent,
  isoWeekday,
  localDate,
  MONITORING_RULES,
  resolveRules,
  sessionLoad,
  validateRuleConfig,
  weeklyLoad,
  wellnessScore,
  type AlertCandidate,
  type ConsentPurpose,
  type MonitoringInput,
  type RuleConfig,
} from '@tp/domain';
import type { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { assessmentProgressUnsecured } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { afterCommit, secured } from './rls';
import { parse } from './validation';

const {
  alerts,
  assessments,
  attendance,
  clientRuleOverrides,
  clients,
  consents,
  exerciseFeedback,
  exercises,
  feedback,
  mesocycles,
  microcycles,
  notifications,
  painLogs,
  phases,
  readiness,
  ruleSets,
  rules,
  sessionExercises,
  sessions,
  setLogs,
  trainerClientAssignments,
  trainers,
  trainingPlans,
} = schema;

const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));
/** A resolved alert is not re-created for the same situation during this many days. */
const COOLDOWN_DAYS = 7;

// ── Rule configuration ────────────────────────────────────────────────────────

async function latestRuleSet(db: Database, organizationId: string) {
  const [rs] = await db
    .select()
    .from(ruleSets)
    .where(and(eq(ruleSets.organizationId, organizationId), eq(ruleSets.status, 'published')))
    .orderBy(desc(ruleSets.version))
    .limit(1);
  return rs ?? null;
}

async function organizationRules(db: Database, organizationId: string) {
  const rs = await latestRuleSet(db, organizationId);
  const rows = rs
    ? await db
        .select()
        .from(rules)
        .where(and(eq(rules.ruleSetId, rs.id), eq(rules.domain, 'monitoring_alert')))
    : [];
  return {
    version: rs?.version ?? null,
    publishedAt: rs?.publishedAt ?? null,
    rules: resolveRules(
      rows.map((r) => ({
        key: r.key,
        enabled: r.enabled,
        parameters: r.parameters as Record<string, number>,
      })),
    ),
  };
}

async function getMonitoringRules_(ctx: RequestContext) {
  requirePermission(ctx, 'monitoring:read');
  const cfg = await organizationRules(ctx.db, ctx.actor.organizationId);
  return {
    version: cfg.version,
    publishedAt: cfg.publishedAt,
    rules: MONITORING_RULES.map((def) => {
      const r = cfg.rules.find((x) => x.key === def.key)!;
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        enabled: r.enabled,
        evidenceLevel: 'F' as const,
        parameters: Object.entries(def.parameters).map(([k, [dflt, label, min, max]]) => ({
          key: k,
          label,
          value: r.parameters[k]!,
          default: dflt,
          min,
          max,
        })),
      };
    }),
  };
}

/** Saves a new version of the organization's rule set (previous one retired), audited. */
async function updateMonitoringRules_(ctx: RequestContext, input: unknown) {
  const d = parse(monitoringRulesSchema, input);
  requirePermission(ctx, 'monitoring:rules');
  const current = await organizationRules(ctx.db, ctx.actor.organizationId);
  const next: RuleConfig[] = current.rules.map((r) => {
    const o = d.rules.find((x) => x.key === r.key);
    return o
      ? { key: r.key, enabled: o.enabled, parameters: { ...r.parameters, ...o.parameters } }
      : r;
  });
  const errors = validateRuleConfig(next);
  if (Object.keys(errors).length)
    throw new DomainError('validation', 'Revisa los umbrales.', errors);
  const prev = await latestRuleSet(ctx.db, ctx.actor.organizationId);
  const [{ max } = { max: 0 }] = await ctx.db
    .select({ max: sql<number>`coalesce(max(${ruleSets.version}), 0)::int` })
    .from(ruleSets)
    .where(eq(ruleSets.organizationId, ctx.actor.organizationId));
  const [rs] = await ctx.db
    .insert(ruleSets)
    .values({
      organizationId: ctx.actor.organizationId,
      version: max + 1,
      status: 'published',
      notes: d.notes ?? null,
      publishedAt: ctx.now(),
      publishedBy: ctx.actor.userId,
    })
    .returning({ id: ruleSets.id, version: ruleSets.version });
  if (prev) {
    await ctx.db.update(ruleSets).set({ status: 'retired' }).where(eq(ruleSets.id, prev.id));
    // Rules of other domains (decision engine, later phases) carry over unchanged.
    const others = await ctx.db
      .select()
      .from(rules)
      .where(and(eq(rules.ruleSetId, prev.id), ne(rules.domain, 'monitoring_alert')));
    if (others.length)
      await ctx.db.insert(rules).values(
        others.map(({ id: _i, createdAt: _c, updatedAt: _u, ...r }) => {
          void _i;
          void _c;
          void _u;
          return { ...r, ruleSetId: rs!.id };
        }),
      );
  }
  await ctx.db.insert(rules).values(
    next.map((r) => {
      const def = MONITORING_RULES.find((x) => x.key === r.key)!;
      return {
        organizationId: ctx.actor.organizationId,
        ruleSetId: rs!.id,
        key: r.key,
        domain: 'monitoring_alert' as const,
        description: def.description,
        condition: { rule: r.key },
        action: { alert: true },
        parameters: r.parameters,
        evidenceLevel: 'F' as const,
        limitations: 'Umbral práctico configurable (nivel F).',
        enabled: r.enabled,
      };
    }),
  );
  const changes = next.flatMap((r) => {
    const before = current.rules.find((x) => x.key === r.key)!;
    return [
      ...(before.enabled !== r.enabled
        ? [{ field: `${r.key}.enabled`, before: before.enabled, after: r.enabled }]
        : []),
      ...Object.entries(r.parameters)
        .filter(([k, v]) => before.parameters[k] !== v)
        .map(([k, v]) => ({ field: `${r.key}.${k}`, before: before.parameters[k], after: v })),
    ];
  });
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'rule_set',
    entityId: rs!.id,
    changes,
    reason: d.notes ?? `Reglas de alerta, versión ${rs!.version}`,
  });
  return { version: rs!.version };
}

async function setClientRuleOverride_(ctx: RequestContext, clientId: string, input: unknown) {
  const d = parse(clientRuleOverrideSchema, input);
  await authorizeClient(ctx, 'alerts:manage', clientId);
  if (!MONITORING_RULES.some((r) => r.key === d.ruleKey))
    throw new DomainError('validation', 'Regla desconocida.', { ruleKey: ['unknown'] });
  if (d.enabled)
    await ctx.db
      .delete(clientRuleOverrides)
      .where(
        and(eq(clientRuleOverrides.clientId, clientId), eq(clientRuleOverrides.ruleKey, d.ruleKey)),
      );
  else
    await ctx.db
      .insert(clientRuleOverrides)
      .values({
        clientId,
        ruleKey: d.ruleKey,
        organizationId: ctx.actor.organizationId,
        enabled: false,
        reason: d.reason ?? null,
        createdBy: ctx.actor.userId,
      })
      .onConflictDoUpdate({
        target: [clientRuleOverrides.clientId, clientRuleOverrides.ruleKey],
        set: { enabled: false, reason: d.reason ?? null, createdBy: ctx.actor.userId },
      });
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'client_rule_override',
    entityId: clientId,
    clientId,
    changes: [{ field: d.ruleKey, before: !d.enabled, after: d.enabled }],
    reason: d.reason ?? null,
  });
  afterCommit(ctx, `monitor:${clientId}`, (root) => monitorClient(root, clientId));
}

// ── Building the monitoring input (system code, no RLS) ───────────────────────

async function healthConsent(db: Database, clientId: string) {
  const cs = await db.select().from(consents).where(eq(consents.clientId, clientId));
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

/** Sessions the client was expected to do: published (or attended) sessions of live plans. */
async function monitoredSessions(db: Database, clientId: string, from: string, to: string) {
  const rows = await db
    .select({
      id: sessions.id,
      date: sessions.scheduledDate,
      title: sessions.title,
      dayLabel: sessions.dayLabel,
      targetRpe: sessions.targetSessionRpe,
      status: attendance.status,
      reasonCode: attendance.reasonCode,
      durationMin: attendance.durationMin,
      estimatedMin: sessions.estimatedDurationMin,
      sessionRpe: feedback.sessionRpe,
      fatigue: feedback.fatigue,
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
        inArray(trainingPlans.status, ['active', 'completed']),
        or(eq(sessions.published, true), isNotNull(attendance.id)),
        isNotNull(sessions.scheduledDate),
        gte(sessions.scheduledDate, from),
        lte(sessions.scheduledDate, to),
      ),
    )
    .orderBy(asc(sessions.scheduledDate));
  return rows.map((r) => ({
    ...r,
    date: r.date!,
    title: r.title ?? `Sesión ${r.dayLabel}`,
    targetRpe: n(r.targetRpe),
    sessionRpe: n(r.sessionRpe),
  }));
}

export async function buildMonitoringInput(
  db: Database,
  organizationId: string,
  clientId: string,
  today: string,
  now: () => Date = () => new Date(),
): Promise<MonitoringInput> {
  const from = addDays(today, -120);
  const ses = await monitoredSessions(db, clientId, from, today);
  const sinceSets = addDays(today, -90);
  const [sets, readinessRows, consented] = await Promise.all([
    db
      .select({
        sessionId: setLogs.sessionId,
        date: sessions.scheduledDate,
        exerciseId: setLogs.exerciseIdPerformed,
        exerciseName: exercises.name,
        rir: setLogs.rir,
        rirMin: sessionExercises.rirMin,
        rirMax: sessionExercises.rirMax,
        prescribedExerciseId: sessionExercises.exerciseId,
      })
      .from(setLogs)
      .innerJoin(sessions, eq(sessions.id, setLogs.sessionId))
      .innerJoin(exercises, eq(exercises.id, setLogs.exerciseIdPerformed))
      .innerJoin(sessionExercises, eq(sessionExercises.id, setLogs.sessionExerciseId))
      .where(
        and(
          eq(setLogs.clientId, clientId),
          eq(setLogs.completed, true),
          gte(sessions.scheduledDate, sinceSets),
          lte(sessions.scheduledDate, today),
        ),
      ),
    db
      .select()
      .from(readiness)
      .where(and(eq(readiness.clientId, clientId), gte(readiness.recordedOn, addDays(today, -30)))),
    healthConsent(db, clientId),
  ]);
  // Pain is health data: without consent the rules never see it.
  const pains: MonitoringInput['pains'] = [];
  if (consented) {
    const [pl, ef] = await Promise.all([
      db
        .select()
        .from(painLogs)
        .where(and(eq(painLogs.clientId, clientId), gte(painLogs.occurredOn, addDays(today, -60)))),
      db
        .select({
          sessionId: exerciseFeedback.sessionId,
          pain: exerciseFeedback.pain,
          name: exercises.name,
          date: sessions.scheduledDate,
          performedDate: attendance.performedDate,
        })
        .from(exerciseFeedback)
        .innerJoin(sessionExercises, eq(sessionExercises.id, exerciseFeedback.sessionExerciseId))
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .innerJoin(sessions, eq(sessions.id, exerciseFeedback.sessionId))
        .leftJoin(attendance, eq(attendance.sessionId, exerciseFeedback.sessionId))
        .where(and(eq(exerciseFeedback.clientId, clientId), isNotNull(exerciseFeedback.pain))),
    ]);
    for (const x of pl)
      pains.push({
        date: x.occurredOn,
        sessionId: x.sessionId,
        where: x.bodyRegion,
        intensity: x.intensity,
      });
    for (const x of ef)
      if (x.pain != null)
        pains.push({
          date: x.performedDate ?? x.date ?? today,
          sessionId: x.sessionId,
          where: x.name,
          intensity: x.pain,
        });
  }
  // Performance drops: the assessment engine's own verdict (change beyond measurement error).
  const declines: MonitoringInput['declines'] = [];
  try {
    const progress = await assessmentProgressUnsecured(
      systemContext(db, organizationId, now),
      clientId,
    );
    for (const s of progress.series) {
      const v = s.lastStep ?? s.overall;
      if (v?.verdict === 'probable_decline')
        declines.push({
          testId: `${s.test.id}:${s.side}`,
          testName:
            s.side === 'both'
              ? s.test.name
              : `${s.test.name} (${s.side === 'left' ? 'izq.' : 'dcha.'})`,
          date: s.points.at(-1)!.on,
        });
    }
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
  }
  // Assessment weeks of live plans and whether an assessment was recorded around them.
  const weeks = await db
    .select({ id: microcycles.id, weekIndex: microcycles.weekIndex, start: microcycles.startDate })
    .from(microcycles)
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
    .where(
      and(
        eq(trainingPlans.clientId, clientId),
        eq(trainingPlans.status, 'active'),
        eq(microcycles.weekType, 'test'),
        isNotNull(microcycles.startDate),
        lte(microcycles.startDate, today),
      ),
    );
  const assessed = weeks.length
    ? await db
        .select({ on: assessments.assessedOn })
        .from(assessments)
        .where(and(eq(assessments.clientId, clientId), ne(assessments.status, 'cancelled')))
    : [];
  return {
    today,
    sessions: ses.map((s) => ({
      id: s.id,
      date: s.date,
      title: s.title,
      status: s.status,
      reasonCode: s.reasonCode,
      sessionRpe: s.sessionRpe,
      targetRpe: s.targetRpe,
    })),
    sets: sets
      .filter((x) => x.date)
      .map((x) => ({
        sessionId: x.sessionId,
        date: x.date!,
        exerciseId: x.exerciseId,
        exerciseName: x.exerciseName,
        rir: x.rir,
        // The target only applies to the exercise it was prescribed for.
        rirMin: x.exerciseId === x.prescribedExerciseId ? x.rirMin : null,
        rirMax: x.exerciseId === x.prescribedExerciseId ? x.rirMax : null,
      })),
    pains,
    readiness: readinessRows.map((r) => ({
      date: r.recordedOn,
      energy: r.energy,
      sleepQuality: r.sleepQuality,
      motivation: r.motivation,
      fatigue: r.fatigue,
      stress: r.stress,
      soreness: r.soreness,
    })),
    declines,
    reassessments: weeks.map((w) => ({
      id: w.id,
      weekIndex: w.weekIndex,
      dueDate: addDays(w.start!, 6),
      assessed: assessed.some((a) => a.on >= addDays(w.start!, -7)),
    })),
  };
}

/** Internal actor for system jobs (never bound to RLS, never written to the audit log). */
function systemContext(db: Database, organizationId: string, now: () => Date): RequestContext {
  return {
    db,
    now,
    actor: {
      userId: '00000000-0000-0000-0000-000000000000',
      organizationId,
      roles: ['ADMIN'],
      trainerId: null,
      clientId: null,
    },
  } as unknown as RequestContext;
}

// ── Evaluation and persistence (system code) ──────────────────────────────────

/**
 * Evaluates the client's alerts and reconciles them: one live alert per situation (`alert_key`),
 * updated or escalated in place; alerts whose condition no longer holds are resolved
 * automatically; a situation a person resolved is not raised again for a few days. New red alerts
 * notify the client's active trainers.
 */
export async function monitorClient(
  app: { db: Database; now: () => Date },
  clientId: string,
): Promise<{ open: number; created: number; resolved: number }> {
  const db = app.db;
  const [c] = await db
    .select({ organizationId: clients.organizationId, status: clients.status })
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!c) return { open: 0, created: 0, resolved: 0 };
  const today = localDate(app.now());
  const cfg = await organizationRules(db, c.organizationId);
  const off = await db
    .select({ key: clientRuleOverrides.ruleKey })
    .from(clientRuleOverrides)
    .where(and(eq(clientRuleOverrides.clientId, clientId), eq(clientRuleOverrides.enabled, false)));
  const active = cfg.rules.map((r) =>
    off.some((o) => o.key === r.key) ? { ...r, enabled: false } : r,
  );
  const candidates: AlertCandidate[] =
    c.status === 'archived'
      ? []
      : evaluateAlerts(
          await buildMonitoringInput(db, c.organizationId, clientId, today, app.now),
          active,
        );

  return db.transaction(async (txx) => {
    const tx = txx as unknown as Database;
    const live = await tx
      .select()
      .from(alerts)
      .where(and(eq(alerts.clientId, clientId), ne(alerts.status, 'resolved')));
    const cooldownFrom = new Date(app.now().getTime() - COOLDOWN_DAYS * 86_400_000);
    const recentlyResolved = await tx
      .select({ key: alerts.alertKey, severity: alerts.severity })
      .from(alerts)
      .where(
        and(
          eq(alerts.clientId, clientId),
          eq(alerts.status, 'resolved'),
          isNotNull(alerts.resolvedBy),
          gte(alerts.resolvedAt, cooldownFrom),
        ),
      );
    let created = 0;
    let resolved = 0;
    const rank = { green: 0, yellow: 1, red: 2 };
    const newRed: AlertCandidate[] = [];
    for (const a of candidates) {
      const cur = live.find((x) => x.alertKey === a.key);
      if (cur) {
        const escalated = rank[a.severity] > rank[cur.severity];
        await tx
          .update(alerts)
          .set({
            severity: a.severity,
            message: a.message,
            data: a.data,
            ruleSetVersion: cfg.version,
            ...(escalated ? { status: 'open' as const } : {}),
          })
          .where(eq(alerts.id, cur.id));
        if (escalated && a.severity === 'red') newRed.push(a);
        continue;
      }
      // Resolved by a person recently: only raise it again if it got worse.
      const r = recentlyResolved.find((x) => x.key === a.key);
      if (r && rank[a.severity] <= rank[r.severity]) continue;
      const [ins] = await tx
        .insert(alerts)
        .values({
          organizationId: c.organizationId,
          clientId,
          severity: a.severity,
          type: a.ruleKey,
          message: a.message,
          data: a.data,
          ruleKey: a.ruleKey,
          alertKey: a.key,
          ruleSetVersion: cfg.version,
        })
        .onConflictDoNothing()
        .returning({ id: alerts.id });
      if (ins) {
        created++;
        if (a.severity === 'red') newRed.push(a);
      }
    }
    const stale = live.filter((x) => !candidates.some((a) => a.key === x.alertKey));
    if (stale.length) {
      await tx
        .update(alerts)
        .set({
          status: 'resolved',
          resolvedAt: app.now(),
          resolvedBy: null,
          resolutionNote: 'Resuelta automáticamente: la condición ya no se cumple.',
        })
        .where(
          inArray(
            alerts.id,
            stale.map((x) => x.id),
          ),
        );
      resolved = stale.length;
    }
    if (newRed.length) {
      const users = await tx
        .select({ userId: trainers.userId })
        .from(trainerClientAssignments)
        .innerJoin(trainers, eq(trainers.id, trainerClientAssignments.trainerId))
        .where(
          and(
            eq(trainerClientAssignments.clientId, clientId),
            isNull(trainerClientAssignments.endedAt),
          ),
        );
      for (const u of users)
        for (const a of newRed)
          await tx.insert(notifications).values({
            organizationId: c.organizationId,
            userId: u.userId,
            type: 'alert_red',
            title: 'Alerta roja',
            body: a.message,
            link: `/app/clients/${clientId}?tab=seguimiento`,
          });
    }
    const [{ open } = { open: 0 }] = await tx
      .select({ open: sql<number>`count(*)::int` })
      .from(alerts)
      .where(and(eq(alerts.clientId, clientId), ne(alerts.status, 'resolved')));
    return { open, created, resolved };
  });
}

/** Daily job: every client with an active plan (and anyone with live alerts). */
export async function monitorAllClients(app: { db: Database; now: () => Date }) {
  const ids = await app.db
    .selectDistinct({ id: trainingPlans.clientId })
    .from(trainingPlans)
    .where(and(eq(trainingPlans.status, 'active'), isNotNull(trainingPlans.clientId)));
  const withAlerts = await app.db
    .selectDistinct({ id: alerts.clientId })
    .from(alerts)
    .where(ne(alerts.status, 'resolved'));
  const all = [...new Set([...ids.map((x) => x.id!), ...withAlerts.map((x) => x.id)])];
  let created = 0;
  let resolved = 0;
  for (const id of all) {
    const r = await monitorClient(app, id);
    created += r.created;
    resolved += r.resolved;
  }
  return { clients: all.length, created, resolved };
}

// ── Use cases ─────────────────────────────────────────────────────────────────

/** Schedules alert evaluation for a client after the current transaction commits. */
export function scheduleMonitoring(ctx: RequestContext, clientId: string) {
  afterCommit(ctx, `monitor:${clientId}`, (root) => monitorClient(root, clientId));
}

async function refreshClientAlerts_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'alerts:manage', clientId);
  scheduleMonitoring(ctx, clientId);
}

async function listAlerts_(ctx: RequestContext, query: unknown = {}) {
  const q = parse(alertsQuerySchema, query);
  requirePermission(ctx, 'alerts:manage');
  if (q.clientId) await authorizeClient(ctx, 'alerts:manage', q.clientId);
  // RLS keeps a trainer to the clients assigned to them.
  const rows = await ctx.db
    .select({
      id: alerts.id,
      clientId: alerts.clientId,
      severity: alerts.severity,
      type: alerts.type,
      message: alerts.message,
      data: alerts.data,
      status: alerts.status,
      createdAt: alerts.createdAt,
      updatedAt: alerts.updatedAt,
      resolvedAt: alerts.resolvedAt,
      resolutionNote: alerts.resolutionNote,
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(alerts)
    .innerJoin(clients, eq(clients.id, alerts.clientId))
    .where(
      and(
        q.status === 'live'
          ? ne(alerts.status, 'resolved')
          : q.status
            ? eq(alerts.status, q.status)
            : undefined,
        q.severity ? eq(alerts.severity, q.severity) : undefined,
        q.clientId ? eq(alerts.clientId, q.clientId) : undefined,
      ),
    )
    .orderBy(
      sql`CASE ${alerts.severity} WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 ELSE 2 END`,
      desc(alerts.updatedAt),
    )
    .limit(q.limit);
  return rows;
}
export type AlertRow = Awaited<ReturnType<typeof listAlerts_>>[number];

async function updateAlertStatus_(ctx: RequestContext, id: string, input: unknown) {
  const d = parse(alertStatusSchema, input);
  const [a] = await ctx.db.select().from(alerts).where(eq(alerts.id, id));
  if (!a) throw new DomainError('not_found', 'Alerta no encontrada.');
  await authorizeClient(ctx, 'alerts:manage', a.clientId).catch((e) => {
    if (e instanceof DomainError && e.code === 'not_found')
      throw new DomainError('not_found', 'Alerta no encontrada.');
    throw e;
  });
  await ctx.db
    .update(alerts)
    .set(
      d.status === 'resolved'
        ? {
            status: 'resolved',
            resolvedBy: ctx.actor.userId,
            resolvedAt: ctx.now(),
            resolutionNote: d.note ?? null,
          }
        : { status: d.status },
    )
    .where(eq(alerts.id, id));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'alert',
    entityId: id,
    clientId: a.clientId,
    changes: [{ field: 'status', before: a.status, after: d.status }],
    reason: d.note ?? null,
  });
}

/** Adherence, load, wellness and (for staff) live alerts of one client. */
async function clientMonitoring_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'monitoring:read', clientId);
  const staff = ctx.actor.roles.includes('ADMIN') || ctx.actor.roles.includes('TRAINER');
  const today = localDate(ctx.now());
  const from = addDays(today, -7 * 12 + 1);
  const ses = await monitoredSessions(ctx.db as Database, clientId, from, addDays(today, 6));
  const past = ses.filter((s) => s.date <= today);
  const adh = (days: number) => adherence(past, addDays(today, -(days - 1)), today);
  const weeks = weeklyLoad(
    past.map((s) => ({
      date: s.date,
      sessionRpe: s.sessionRpe,
      durationMin: s.durationMin ?? s.estimatedMin,
    })),
    // The current week and the 7 before it.
    addDays(today, 1 - isoWeekday(today) - 49),
    today,
  ).map((w) => ({
    ...w,
    adherence: adherence(
      past,
      w.weekStart,
      addDays(w.weekStart, 6) < today ? addDays(w.weekStart, 6) : today,
    ),
  }));
  const ready = await ctx.db
    .select()
    .from(readiness)
    .where(and(eq(readiness.clientId, clientId), gte(readiness.recordedOn, addDays(today, -13))))
    .orderBy(asc(readiness.recordedOn));
  const live = staff
    ? await ctx.db
        .select()
        .from(alerts)
        .where(and(eq(alerts.clientId, clientId), ne(alerts.status, 'resolved')))
        .orderBy(
          sql`CASE ${alerts.severity} WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 ELSE 2 END`,
          desc(alerts.updatedAt),
        )
    : [];
  const overrides = staff
    ? await ctx.db
        .select()
        .from(clientRuleOverrides)
        .where(eq(clientRuleOverrides.clientId, clientId))
    : [];
  return {
    today,
    adherence28: adh(28),
    adherence84: adh(84),
    weeks,
    recent: past
      .slice(-12)
      .reverse()
      .map((s) => ({
        id: s.id,
        date: s.date,
        title: s.title,
        status: s.status,
        sessionRpe: s.sessionRpe,
        targetRpe: s.targetRpe,
        durationMin: s.durationMin,
        load: sessionLoad(s.sessionRpe, s.durationMin),
        fatigue: s.fatigue,
        comment: s.comment,
      })),
    readiness: ready.map((r) => ({
      date: r.recordedOn,
      energy: r.energy,
      sleepQuality: r.sleepQuality,
      soreness: r.soreness,
      score: wellnessScore({
        date: r.recordedOn,
        energy: r.energy,
        sleepQuality: r.sleepQuality,
        motivation: r.motivation,
        fatigue: r.fatigue,
        stress: r.stress,
        soreness: r.soreness,
      }),
    })),
    alerts: live,
    disabledRules: overrides
      .filter((o) => !o.enabled)
      .map((o) => ({ key: o.ruleKey, reason: o.reason })),
  };
}
export type ClientMonitoring = Awaited<ReturnType<typeof clientMonitoring_>>;

/** Organization overview for the trainer's "Hoy" (RLS limits it to accessible clients). */
async function monitoringOverview_(ctx: RequestContext) {
  requirePermission(ctx, 'alerts:manage');
  const today = localDate(ctx.now());
  const from = addDays(today, -27);
  const rows = await ctx.db
    .select({ clientId: sessions.clientId, status: attendance.status })
    .from(sessions)
    .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
    .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
    .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
    .innerJoin(trainingPlans, eq(trainingPlans.id, phases.planId))
    .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
    .where(
      and(
        inArray(trainingPlans.status, ['active', 'completed']),
        or(eq(sessions.published, true), isNotNull(attendance.id)),
        gte(sessions.scheduledDate, from),
        lte(sessions.scheduledDate, today),
      ),
    );
  const a = adherence(
    rows.map((r, i) => ({ id: String(i), date: today, status: r.status })),
    today,
    today,
  );
  const counts = await ctx.db
    .select({ severity: alerts.severity, count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(ne(alerts.status, 'resolved'))
    .groupBy(alerts.severity);
  return {
    adherence28: a,
    alerts: {
      red: counts.find((x) => x.severity === 'red')?.count ?? 0,
      yellow: counts.find((x) => x.severity === 'yellow')?.count ?? 0,
      green: counts.find((x) => x.severity === 'green')?.count ?? 0,
    },
  };
}

// ── Exercise feedback (client; also replayed from the offline queue) ──────────

export async function applyExerciseFeedback(
  ctx: RequestContext,
  d: z.infer<typeof exerciseFeedbackSchema>,
  loadSessionExercise: (
    ctx: RequestContext,
    sessionExerciseId: string,
  ) => Promise<{ sessionId: string; organizationId: string; clientId: string; own: boolean }>,
) {
  const se = await loadSessionExercise(ctx, d.sessionExerciseId);
  const consented = d.pain != null ? await healthConsent(ctx.db as Database, se.clientId) : false;
  const values = {
    difficulty: d.difficulty ?? null,
    pain: d.pain != null && consented ? d.pain : null,
    comment: d.comment ?? null,
  };
  await ctx.db
    .insert(exerciseFeedback)
    .values({
      organizationId: se.organizationId,
      clientId: se.clientId,
      sessionId: se.sessionId,
      sessionExerciseId: d.sessionExerciseId,
      ...values,
    })
    .onConflictDoUpdate({ target: exerciseFeedback.sessionExerciseId, set: values });
  scheduleMonitoring(ctx, se.clientId);
  return { painStored: d.pain != null && consented };
}

// Use cases run under Row Level Security (see rls.ts).
export const getMonitoringRules = secured(getMonitoringRules_);
export const updateMonitoringRules = secured(updateMonitoringRules_);
export const setClientRuleOverride = secured(setClientRuleOverride_);
export const refreshClientAlerts = secured(refreshClientAlerts_);
export const listAlerts = secured(listAlerts_);
export const updateAlertStatus = secured(updateAlertStatus_);
export const clientMonitoring = secured(clientMonitoring_);
export const monitoringOverview = secured(monitoringOverview_);
