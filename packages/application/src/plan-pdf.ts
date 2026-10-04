/**
 * Plan PDF (pending 5 of Phase 15): the whole plan, week by week, for the team (technical
 * prescription and internal notes) or for the client (plain language, only what is written for
 * them). A client only gets their own active or completed plans and only published sessions.
 * Downloads are audited as exports.
 */
import { schema } from '@tp/db';
import {
  DomainError,
  planDocument,
  prescriptionForClient,
  prescriptionShort,
  type PlanAudience,
  type PlanPrintInput,
} from '@tp/domain';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { writeAudit } from './audit';
import { authorizeClient } from './authz';
import type { RequestContext } from './context';
import { loadPlan, toPrescription } from './planning';
import { reportPdf } from './render/pdf';
import type { FileOut } from './reports';
import { secured } from './rls';

const {
  clients,
  exercises,
  mesocycles,
  microcycles,
  organizations,
  phases,
  sessionBlocks,
  sessionExercises,
  sessions,
  trainingPlans,
} = schema;

const STATUS: Record<string, string> = {
  draft: 'Borrador',
  proposed: 'Propuesta',
  active: 'Activo',
  completed: 'Completado',
  archived: 'Archivado',
};

const isStaff = (ctx: RequestContext) =>
  ctx.actor.roles.includes('ADMIN') || ctx.actor.roles.includes('TRAINER');

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

async function authorizePlan(ctx: RequestContext, planId: string, audience: PlanAudience) {
  if (isStaff(ctx)) return loadPlan(ctx, planId, 'plans:read');
  // The client: own plan, already running or finished, and the client's version only.
  const [p] = await ctx.db.select().from(trainingPlans).where(eq(trainingPlans.id, planId));
  if (
    !p ||
    audience !== 'client' ||
    !p.clientId ||
    p.clientId !== ctx.actor.clientId ||
    !['active', 'completed'].includes(p.status)
  )
    throw new DomainError('not_found', 'Plan no encontrado.');
  await authorizeClient(ctx, 'sessions:read', p.clientId).catch(() => {
    throw new DomainError('not_found', 'Plan no encontrado.');
  });
  return p;
}

export async function planPrintInput(
  ctx: RequestContext,
  planId: string,
  audience: PlanAudience,
): Promise<PlanPrintInput> {
  const p = await authorizePlan(ctx, planId, audience);
  const publishedOnly = !isStaff(ctx);
  const [[c], [org], weeks] = await Promise.all([
    ctx.db
      .select({ first: clients.firstName, last: clients.lastName })
      .from(clients)
      .where(eq(clients.id, p.clientId!)),
    ctx.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, p.organizationId)),
    ctx.db
      .select({ w: microcycles, phase: phases.name })
      .from(microcycles)
      .innerJoin(mesocycles, eq(mesocycles.id, microcycles.mesocycleId))
      .innerJoin(phases, eq(phases.id, mesocycles.phaseId))
      .where(eq(phases.planId, planId))
      .orderBy(asc(microcycles.weekIndex)),
  ]);
  const ses = weeks.length
    ? await ctx.db
        .select()
        .from(sessions)
        .where(
          and(
            inArray(
              sessions.microcycleId,
              weeks.map((x) => x.w.id),
            ),
            publishedOnly ? eq(sessions.published, true) : undefined,
          ),
        )
        .orderBy(asc(sessions.position))
    : [];
  const blocks = ses.length
    ? await ctx.db
        .select()
        .from(sessionBlocks)
        .where(
          inArray(
            sessionBlocks.sessionId,
            ses.map((s) => s.id),
          ),
        )
        .orderBy(asc(sessionBlocks.position))
    : [];
  const rows = blocks.length
    ? await ctx.db
        .select({ se: sessionExercises, name: exercises.name })
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
  const altIds = [...new Set(rows.flatMap((r) => r.se.alternativeExerciseIds))];
  const alts = altIds.length
    ? await ctx.db
        .select({ id: exercises.id, name: exercises.name })
        .from(exercises)
        .where(inArray(exercises.id, altIds))
    : [];
  const staffText = audience === 'staff';
  return {
    audience,
    generatedAt: ctx.now().toISOString(),
    organization: org?.name ?? '',
    client: c ? `${c.first} ${c.last}` : '',
    plan: {
      name: p.name,
      status: STATUS[p.status] ?? p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      objective: p.description,
    },
    weeks: weeks.map(({ w, phase }) => ({
      index: w.weekIndex,
      type: w.weekType,
      startDate: w.startDate,
      phase,
      notes: staffText ? w.notes : null,
      sessions: ses
        .filter((s) => s.microcycleId === w.id)
        .sort(
          (a, b) =>
            (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '') || a.position - b.position,
        )
        .map((s) => ({
          dayLabel: s.dayLabel,
          title: s.title,
          date: s.scheduledDate,
          minutes: s.estimatedDurationMin,
          objective: s.objective,
          notesForClient: s.notesForClient,
          notesForTrainer: staffText ? s.notesForTrainer : null,
          blocks: blocks
            .filter((b) => b.sessionId === s.id)
            .map((b) => ({
              label: b.label,
              type: b.type,
              exercises: rows
                .filter((r) => r.se.blockId === b.id)
                .map((r) => {
                  const pr = toPrescription(r.se);
                  return {
                    name: r.name,
                    prescription: staffText ? prescriptionShort(pr) : prescriptionForClient(pr),
                    notesForClient: r.se.notesForClient,
                    coachNotes: staffText ? r.se.coachNotes : null,
                    alternatives: alts
                      .filter((a) => r.se.alternativeExerciseIds.includes(a.id))
                      .map((a) => a.name),
                  };
                }),
            })),
        })),
    })),
  };
}

async function downloadPlanPdf_(
  ctx: RequestContext,
  planId: string,
  version: string | null,
): Promise<FileOut> {
  if (version && !['staff', 'client'].includes(version))
    throw new DomainError('validation', 'Versión no válida.', { version: ['staff o client'] });
  // Staff choose the version (team by default); a client always gets theirs.
  const audience: PlanAudience = !isStaff(ctx) || version === 'client' ? 'client' : 'staff';
  const input = await planPrintInput(ctx, planId, audience);
  const [p] = await ctx.db
    .select({ clientId: trainingPlans.clientId })
    .from(trainingPlans)
    .where(eq(trainingPlans.id, planId));
  await writeAudit(ctx.db, ctx, {
    action: 'export',
    entityType: 'plan',
    entityId: planId,
    clientId: p!.clientId,
    changes: { format: 'pdf', version: audience },
  });
  return {
    fileName: `plan-${slug(input.plan.name)}${audience === 'client' ? '' : '.equipo'}.pdf`,
    contentType: 'application/pdf',
    body: await reportPdf(planDocument(input)),
  };
}

export const downloadPlanPdf = secured(downloadPlanPdf_);
