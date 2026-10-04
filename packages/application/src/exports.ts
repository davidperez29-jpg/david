/**
 * Exports (encargo §53) as CSV or XLSX: clients, assessments, planning, sessions and evolution.
 * Row Level Security keeps every export to what the actor may see (ADMIN: organization; trainer:
 * assigned clients). Every export is audited. No health declarations are exported here (the
 * data-subject export is a privacy feature, Phase 13).
 */
import { exportQuerySchema, type ExportEntity } from '@tp/contracts';
import { schema } from '@tp/db';
import { DomainError, prescriptionShort, toCsv, type Cell } from '@tp/domain';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { clientAssessmentProgress } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import type { FileOut } from './reports';
import { toXlsx } from './render/xlsx';
import { secured } from './rls';
import { prescriptionOf } from './sessions';
import { parse } from './validation';

const {
  assessmentResults,
  assessmentTests,
  assessments,
  attendance,
  clientGoals,
  clientTrainingProfiles,
  clients,
  exercises,
  goals,
  mesocycles,
  microcycles,
  phases,
  sessionBlocks,
  sessionExercises,
  sessions,
  setLogs,
  trainingPlans,
} = schema;

const NAMES: Record<ExportEntity, string> = {
  clients: 'clientes',
  assessments: 'evaluaciones',
  plan: 'planificacion',
  sessions: 'sesiones',
  progress: 'evolucion',
};
const num = (v: string | number | null) => (v == null ? null : Number(v));

async function rowsFor(
  ctx: RequestContext,
  q: ReturnType<typeof exportQuerySchema.parse>,
): Promise<Cell[][]> {
  const byClient = q.clientId ? eq(clients.id, q.clientId) : undefined;
  const dateRange = (col: Parameters<typeof gte>[0]) =>
    and(q.from ? gte(col, q.from) : undefined, q.to ? lte(col, q.to) : undefined);

  if (q.entity === 'clients') {
    const rows = await ctx.db
      .select({
        c: clients,
        experience: clientTrainingProfiles.experienceLevel,
        spw: clientTrainingProfiles.sessionsPerWeek,
        goal: goals.name,
      })
      .from(clients)
      .leftJoin(clientTrainingProfiles, eq(clientTrainingProfiles.clientId, clients.id))
      .leftJoin(
        clientGoals,
        and(
          eq(clientGoals.clientId, clients.id),
          eq(clientGoals.isPrimary, true),
          eq(clientGoals.status, 'active'),
        ),
      )
      .leftJoin(goals, eq(goals.id, clientGoals.goalId))
      .where(and(eq(clients.organizationId, ctx.actor.organizationId), byClient))
      .orderBy(asc(clients.lastName), asc(clients.firstName));
    return [
      [
        'Nombre',
        'Apellidos',
        'Fecha nacimiento',
        'Sexo',
        'Email',
        'Modalidad',
        'Estado',
        'Experiencia',
        'Sesiones semana',
        'Objetivo principal',
        'Alta',
      ],
      ...rows.map(({ c, experience, spw, goal }) => [
        c.firstName,
        c.lastName,
        c.birthDate,
        c.sex,
        c.email,
        c.modality,
        c.status,
        experience,
        spw,
        goal,
        c.joinedAt,
      ]),
    ];
  }

  if (q.entity === 'assessments') {
    const rows = await ctx.db
      .select({
        first: clients.firstName,
        last: clients.lastName,
        email: clients.email,
        on: assessments.assessedOn,
        context: assessments.context,
        test: assessmentTests.name,
        unit: assessmentTests.unit,
        side: assessmentResults.side,
        value: assessmentResults.value,
        attempts: assessmentResults.attempts,
        valid: assessmentResults.valid,
      })
      .from(assessmentResults)
      .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
      .innerJoin(assessmentTests, eq(assessmentTests.id, assessmentResults.testId))
      .innerJoin(clients, eq(clients.id, assessments.clientId))
      .where(
        and(byClient, dateRange(assessments.assessedOn), sql`${assessments.status} <> 'cancelled'`),
      )
      .orderBy(asc(clients.lastName), asc(assessments.assessedOn), asc(assessmentTests.name));
    return [
      [
        'Cliente',
        'Email',
        'Fecha',
        'Contexto',
        'Test',
        'Lado',
        'Valor',
        'Unidad',
        'Intentos',
        'Válido',
      ],
      ...rows.map((r) => [
        `${r.first} ${r.last}`,
        r.email,
        r.on,
        r.context,
        r.test,
        r.side,
        num(r.value),
        r.unit,
        Array.isArray(r.attempts) ? (r.attempts as number[]).join(' | ') : null,
        r.valid,
      ]),
    ];
  }

  if (q.entity === 'plan') {
    let planId = q.planId;
    if (!planId && q.clientId) {
      const [p] = await ctx.db
        .select({ id: trainingPlans.id })
        .from(trainingPlans)
        .where(and(eq(trainingPlans.clientId, q.clientId), eq(trainingPlans.kind, 'CLIENT_PLAN')))
        .orderBy(sql`${trainingPlans.status} = 'active' DESC`, desc(trainingPlans.createdAt))
        .limit(1);
      planId = p?.id;
    }
    if (!planId)
      throw new DomainError('validation', 'Indica el plan o un cliente con plan.', {
        planId: ['required'],
      });
    const [plan] = await ctx.db.select().from(trainingPlans).where(eq(trainingPlans.id, planId));
    if (!plan?.clientId) throw new DomainError('not_found', 'Plan no encontrado.');
    await authorizeClient(ctx, 'data:export', plan.clientId);
    const rows = await ctx.db
      .select({
        phase: phases.name,
        week: microcycles.weekIndex,
        weekType: microcycles.weekType,
        date: sessions.scheduledDate,
        day: sessions.dayLabel,
        title: sessions.title,
        block: sessionBlocks.label,
        blockType: sessionBlocks.type,
        exercise: exercises.name,
        se: sessionExercises,
      })
      .from(sessionExercises)
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionExercises.blockId))
      .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
      .innerJoin(microcycles, eq(microcycles.id, sessions.microcycleId))
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
      .where(and(eq(phases.planId, planId), dateRange(sessions.scheduledDate)))
      .orderBy(
        asc(microcycles.weekIndex),
        asc(sessions.scheduledDate),
        asc(sessions.position),
        asc(sessionBlocks.position),
        asc(sessionExercises.position),
      );
    return [
      [
        'Plan',
        'Fase',
        'Semana',
        'Tipo de semana',
        'Fecha',
        'Sesión',
        'Bloque',
        'Ejercicio',
        'Prescripción',
        'Series',
        'Reps mín.',
        'Reps máx.',
        'Carga (kg)',
        '% 1RM',
        'RIR mín.',
        'RIR máx.',
        'Descanso (s)',
      ],
      ...rows.map((r) => [
        plan.name,
        r.phase,
        r.week,
        r.weekType,
        r.date,
        `${r.day} · ${r.title ?? ''}`.trim(),
        r.block ?? r.blockType,
        r.exercise,
        prescriptionShort(prescriptionOf(r.se)),
        r.se.sets,
        r.se.repsMin,
        r.se.repsMax,
        num(r.se.loadKg),
        num(r.se.loadPct1rm),
        r.se.rirMin,
        r.se.rirMax,
        r.se.restS,
      ]),
    ];
  }

  if (q.entity === 'sessions') {
    const logs = await ctx.db
      .select({
        first: clients.firstName,
        last: clients.lastName,
        date: sessions.scheduledDate,
        title: sessions.title,
        status: attendance.status,
        exercise: exercises.name,
        set: setLogs.setIndex,
        load: setLogs.loadKg,
        reps: setLogs.reps,
        rir: setLogs.rir,
        rirAssumed: setLogs.rirAssumed,
        rpe: setLogs.rpe,
        duration: setLogs.durationS,
        role: setLogs.loggedByRole,
      })
      .from(setLogs)
      .innerJoin(sessions, eq(sessions.id, setLogs.sessionId))
      .innerJoin(clients, eq(clients.id, setLogs.clientId))
      .innerJoin(exercises, eq(exercises.id, setLogs.exerciseIdPerformed))
      .leftJoin(attendance, eq(attendance.sessionId, sessions.id))
      .where(and(byClient, dateRange(sessions.scheduledDate), eq(setLogs.completed, true)))
      .orderBy(asc(clients.lastName), asc(sessions.scheduledDate), asc(setLogs.loggedAt));
    return [
      [
        'Cliente',
        'Fecha',
        'Sesión',
        'Asistencia',
        'Ejercicio realizado',
        'Serie',
        'Carga (kg)',
        'Reps',
        'RIR (autoinformado)',
        'RPE',
        'Duración (s)',
        'Registrado por',
      ],
      ...logs.map((r) => [
        `${r.first} ${r.last}`,
        r.date,
        r.title,
        r.status,
        r.exercise,
        r.set,
        num(r.load),
        r.reps,
        r.rirAssumed ? null : r.rir,
        num(r.rpe),
        r.duration,
        r.role === 'client' ? 'cliente' : 'entrenador',
      ]),
    ];
  }

  // progress: one row per measurement with the change verdict of the series.
  if (!q.clientId)
    throw new DomainError('validation', 'La evolución se exporta por cliente.', {
      clientId: ['required'],
    });
  const p = await clientAssessmentProgress(ctx, q.clientId);
  const out: Cell[][] = [
    [
      'Test',
      'Lado',
      'Fecha',
      'Valor',
      'Unidad',
      'Cambio total',
      'Valoración del cambio (frente al error de medida)',
    ],
  ];
  for (const s of p.series)
    for (const [i, pt] of s.points.entries())
      if ((!q.from || pt.on >= q.from) && (!q.to || pt.on <= q.to))
        out.push([
          s.test.name,
          s.side,
          pt.on,
          pt.value,
          s.test.unit,
          i === s.points.length - 1 && s.overall ? s.overall.delta : null,
          i === s.points.length - 1 ? (s.overall?.label ?? s.note) : null,
        ]);
  return out;
}

async function exportData_(ctx: RequestContext, input: unknown): Promise<FileOut> {
  const q = parse(exportQuerySchema, input);
  requirePermission(ctx, 'data:export');
  if (q.clientId) await authorizeClient(ctx, 'data:export', q.clientId);
  const rows = await rowsFor(ctx, q);
  const stamp = ctx.now().toISOString().slice(0, 10);
  const name = `${NAMES[q.entity]}-${stamp}`;
  await writeAudit(ctx.db, ctx, {
    action: 'export',
    entityType: 'export',
    entityId: null,
    clientId: q.clientId ?? null,
    changes: {
      entity: q.entity,
      format: q.format,
      rows: rows.length - 1,
      from: q.from ?? null,
      to: q.to ?? null,
    },
  });
  if (q.format === 'csv')
    return {
      fileName: `${name}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(toCsv(rows), 'utf8'),
    };
  return {
    fileName: `${name}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: await toXlsx([{ name: NAMES[q.entity], rows, bold: [0] }], ctx.now()),
  };
}

export const exportData = secured(exportData_);
/** Kept for symmetry with the import templates. */
export const EXPORT_LABELS = NAMES;
