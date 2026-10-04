import { encrypt, openSecret } from '@tp/auth';
import {
  assignTrainerSchema,
  createClientSchema,
  listClientsSchema,
  setAvailabilitySchema,
  setEquipmentSchema,
  setGoalsSchema,
  trainingProfileSchema,
  updateClientSchema,
  historyEntrySchema,
  type Page,
} from '@tp/contracts';
import { schema, uuidv7, type Executor } from '@tp/db';
import {
  ageAt,
  CLIENT_SELF_EDITABLE_FIELDS,
  diffFields,
  DomainError,
  validateGoalSelection,
} from '@tp/domain';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { referralStatus } from './health';
import { parse } from './validation';
import { secured } from './rls';

const {
  clients,
  clientTrainingProfiles,
  clientGoals,
  clientAvailability,
  clientEquipment,
  clientHistoryEntries,
  trainerClientAssignments,
  trainers,
  goals,
  sports,
  equipment,
} = schema;

export interface ClientSummary {
  id: string;
  firstName: string;
  lastName: string;
  age: number | null;
  status: string;
  modality: string;
  primaryGoal: string | null;
  trainers: string[];
  hasAccount: boolean;
}

const BASIC_FIELDS = [
  'firstName',
  'lastName',
  'birthDate',
  'sex',
  'email',
  'phone',
  'modality',
  'status',
  'preferences',
] as const;

function scopeCondition(ctx: RequestContext, scope: 'org' | 'assigned' | 'own'): SQL | undefined {
  const orgCond = eq(clients.organizationId, ctx.actor.organizationId);
  if (scope === 'org') return orgCond;
  if (scope === 'own') return and(orgCond, eq(clients.id, ctx.actor.clientId ?? sql`NULL`));
  return and(
    orgCond,
    inArray(
      clients.id,
      ctx.db
        .select({ id: trainerClientAssignments.clientId })
        .from(trainerClientAssignments)
        .where(
          and(
            eq(trainerClientAssignments.trainerId, ctx.actor.trainerId ?? sql`NULL`),
            isNull(trainerClientAssignments.endedAt),
          ),
        ),
    ),
  );
}

async function listClients_(ctx: RequestContext, query: unknown): Promise<Page<ClientSummary>> {
  const q = parse(listClientsSchema, query ?? {});
  const scope = requirePermission(ctx, 'clients:read');
  const conds: (SQL | undefined)[] = [scopeCondition(ctx, scope)];
  if (q.status) conds.push(eq(clients.status, q.status));
  else conds.push(sql`${clients.status} <> 'archived'`);
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(clients.firstName, term),
        ilike(clients.lastName, term),
        ilike(sql`${clients.firstName} || ' ' || ${clients.lastName}`, term),
        ilike(clients.email, term),
      ),
    );
  }
  const where = and(...conds);
  const [{ total } = { total: 0 }] = await ctx.db
    .select({ total: count() })
    .from(clients)
    .where(where);
  const rows = await ctx.db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      birthDate: clients.birthDate,
      status: clients.status,
      modality: clients.modality,
      userId: clients.userId,
    })
    .from(clients)
    .where(where)
    .orderBy(asc(clients.lastName), asc(clients.firstName))
    .limit(q.limit)
    .offset(q.offset);
  const ids = rows.map((r) => r.id);
  const primaryGoals = ids.length
    ? await ctx.db
        .select({ clientId: clientGoals.clientId, name: goals.name })
        .from(clientGoals)
        .innerJoin(goals, eq(goals.id, clientGoals.goalId))
        .where(
          and(
            inArray(clientGoals.clientId, ids),
            eq(clientGoals.isPrimary, true),
            eq(clientGoals.status, 'active'),
          ),
        )
    : [];
  const assigned = ids.length
    ? await ctx.db
        .select({
          clientId: trainerClientAssignments.clientId,
          name: sql<string>`${trainers.firstName} || ' ' || ${trainers.lastName}`,
        })
        .from(trainerClientAssignments)
        .innerJoin(trainers, eq(trainers.id, trainerClientAssignments.trainerId))
        .where(
          and(
            inArray(trainerClientAssignments.clientId, ids),
            isNull(trainerClientAssignments.endedAt),
          ),
        )
    : [];
  const now = ctx.now();
  return {
    items: rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      age: r.birthDate ? ageAt(r.birthDate, now) : null,
      status: r.status,
      modality: r.modality,
      primaryGoal: primaryGoals.find((g) => g.clientId === r.id)?.name ?? null,
      trainers: assigned.filter((a) => a.clientId === r.id).map((a) => a.name),
      hasAccount: r.userId != null,
    })),
    total: Number(total),
    limit: q.limit,
    offset: q.offset,
  };
}

async function getClient_(ctx: RequestContext, clientId: string) {
  await authorizeClient(ctx, 'clients:read', clientId);
  const [c] = await ctx.db.select().from(clients).where(eq(clients.id, clientId));
  if (!c) throw new DomainError('not_found', 'Cliente no encontrado.');
  const [profile] = await ctx.db
    .select()
    .from(clientTrainingProfiles)
    .where(eq(clientTrainingProfiles.clientId, clientId));
  const goalRows = await ctx.db
    .select({
      id: clientGoals.id,
      goalId: clientGoals.goalId,
      name: goals.name,
      isPrimary: clientGoals.isPrimary,
      priorityWeight: clientGoals.priorityWeight,
      targetDate: clientGoals.targetDate,
      sportId: clientGoals.sportId,
      sportName: sports.name,
      competitiveLevel: clientGoals.competitiveLevel,
      notes: clientGoals.notes,
    })
    .from(clientGoals)
    .innerJoin(goals, eq(goals.id, clientGoals.goalId))
    .leftJoin(sports, eq(sports.id, clientGoals.sportId))
    .where(and(eq(clientGoals.clientId, clientId), eq(clientGoals.status, 'active')))
    .orderBy(desc(clientGoals.isPrimary), desc(clientGoals.priorityWeight));
  const availability = await ctx.db
    .select()
    .from(clientAvailability)
    .where(eq(clientAvailability.clientId, clientId))
    .orderBy(asc(clientAvailability.weekday), asc(clientAvailability.startTime));
  const equipmentRows = await ctx.db
    .select({
      equipmentId: clientEquipment.equipmentId,
      name: equipment.name,
      location: clientEquipment.location,
    })
    .from(clientEquipment)
    .innerJoin(equipment, eq(equipment.id, clientEquipment.equipmentId))
    .where(eq(clientEquipment.clientId, clientId))
    .orderBy(asc(equipment.name));
  const assignments = await ctx.db
    .select({
      id: trainerClientAssignments.id,
      trainerId: trainers.id,
      name: sql<string>`${trainers.firstName} || ' ' || ${trainers.lastName}`,
      role: trainerClientAssignments.role,
    })
    .from(trainerClientAssignments)
    .innerJoin(trainers, eq(trainers.id, trainerClientAssignments.trainerId))
    .where(
      and(
        eq(trainerClientAssignments.clientId, clientId),
        isNull(trainerClientAssignments.endedAt),
      ),
    );
  const history = await ctx.db
    .select()
    .from(clientHistoryEntries)
    .where(eq(clientHistoryEntries.clientId, clientId))
    .orderBy(desc(clientHistoryEntries.periodStart));
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    birthDate: c.birthDate,
    age: c.birthDate ? ageAt(c.birthDate, ctx.now()) : null,
    sex: c.sex,
    email: c.email,
    phone: c.phoneEnc ? openSecret(ctx.keys, c.phoneEnc) : null,
    joinedAt: c.joinedAt,
    status: c.status,
    modality: c.modality,
    preferences: c.preferences,
    progressTestIds: c.progressTestIds,
    hasAccount: c.userId != null,
    anonymizedAt: c.anonymizedAt,
    version: c.version,
    profile: profile
      ? {
          experienceLevel: profile.experienceLevel,
          yearsTraining: profile.yearsTraining != null ? Number(profile.yearsTraining) : null,
          sessionsPerWeek: profile.sessionsPerWeek,
          sessionDurationMin: profile.sessionDurationMin,
          location: profile.location,
          notes: profile.notes,
        }
      : null,
    goals: goalRows.map((g) => ({ ...g, priorityWeight: Number(g.priorityWeight) })),
    availability: availability.map((a) => ({
      weekday: a.weekday,
      startTime: a.startTime?.slice(0, 5) ?? null,
      endTime: a.endTime?.slice(0, 5) ?? null,
      maxDurationMin: a.maxDurationMin,
    })),
    equipment: equipmentRows,
    assignments,
    history,
    // Safety flag is shown to everyone who can see the client; details stay behind health:read.
    referral: await referralStatus(ctx.db, clientId),
  };
}
export type ClientDetail = Awaited<ReturnType<typeof getClient_>>;

async function insertGoals(
  tx: Executor,
  ctx: RequestContext,
  clientId: string,
  input: z.output<typeof setGoalsSchema>['goals'],
): Promise<void> {
  const problems = validateGoalSelection(
    input.map((g) => ({ ...g, targetDate: g.targetDate ?? null })),
  );
  if (problems.length)
    throw new DomainError('validation', 'Objetivos no válidos.', { goals: problems });
  const known = await tx
    .select({ id: goals.id, org: goals.organizationId })
    .from(goals)
    .where(
      inArray(
        goals.id,
        input.map((g) => g.goalId),
      ),
    );
  for (const g of input) {
    const k = known.find((x) => x.id === g.goalId);
    if (!k || (k.org !== null && k.org !== ctx.actor.organizationId)) {
      throw new DomainError('validation', 'Objetivo desconocido.', { goals: ['unknown_goal'] });
    }
  }
  await tx.insert(clientGoals).values(
    input.map((g) => ({
      clientId,
      goalId: g.goalId,
      isPrimary: g.isPrimary,
      priorityWeight: String(g.priorityWeight),
      targetDate: g.targetDate ?? null,
      sportId: g.sportId ?? null,
      competitiveLevel: g.competitiveLevel ?? null,
      notes: g.notes ?? null,
      createdBy: ctx.actor.userId,
    })),
  );
}

async function replaceAvailability(
  tx: Executor,
  clientId: string,
  slots: z.output<typeof setAvailabilitySchema>['slots'],
): Promise<void> {
  await tx.delete(clientAvailability).where(eq(clientAvailability.clientId, clientId));
  if (slots.length) {
    await tx.insert(clientAvailability).values(
      slots.map((s) => ({
        clientId,
        weekday: s.weekday,
        startTime: s.startTime ?? null,
        endTime: s.endTime ?? null,
        maxDurationMin: s.maxDurationMin ?? null,
      })),
    );
  }
}

async function replaceEquipment(
  tx: Executor,
  ctx: RequestContext,
  clientId: string,
  items: z.output<typeof setEquipmentSchema>['items'],
): Promise<void> {
  if (items.length) {
    const known = await tx
      .select({ id: equipment.id, org: equipment.organizationId })
      .from(equipment)
      .where(
        inArray(
          equipment.id,
          items.map((i) => i.equipmentId),
        ),
      );
    const ok = items.every((i) => {
      const k = known.find((x) => x.id === i.equipmentId);
      return k && (k.org === null || k.org === ctx.actor.organizationId);
    });
    if (!ok)
      throw new DomainError('validation', 'Material desconocido.', { equipment: ['unknown'] });
  }
  await tx.delete(clientEquipment).where(eq(clientEquipment.clientId, clientId));
  if (items.length) {
    await tx
      .insert(clientEquipment)
      .values(items.map((i) => ({ clientId, equipmentId: i.equipmentId, location: i.location })));
  }
}

async function resolveTrainerForNewClient(
  ctx: RequestContext,
  requested?: string,
): Promise<string> {
  if (requested && requested !== ctx.actor.trainerId) {
    if (!ctx.actor.roles.includes('ADMIN')) {
      throw new DomainError('forbidden', 'Solo administración puede asignar a otro entrenador.');
    }
    const [t] = await ctx.db
      .select({ id: trainers.id })
      .from(trainers)
      .where(
        and(
          eq(trainers.id, requested),
          eq(trainers.organizationId, ctx.actor.organizationId),
          eq(trainers.active, true),
        ),
      );
    if (!t)
      throw new DomainError('validation', 'Entrenador no válido.', { trainerId: ['unknown'] });
    return t.id;
  }
  if (ctx.actor.trainerId) return ctx.actor.trainerId;
  throw new DomainError('validation', 'Selecciona el entrenador responsable.', {
    trainerId: ['required'],
  });
}

async function createClient_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  const data = parse(createClientSchema, input);
  requirePermission(ctx, 'clients:create', { organizationId: ctx.actor.organizationId });
  const trainerId = await resolveTrainerForNewClient(ctx, data.trainerId);
  const b = data.basics;
  return ctx.db.transaction(async (tx) => {
    // Id generated here (no RETURNING): under RLS a trainer cannot see the row until the
    // assignment below exists.
    const clientId = uuidv7();
    await tx.insert(clients).values({
      id: clientId,
      organizationId: ctx.actor.organizationId,
      firstName: b.firstName,
      lastName: b.lastName,
      birthDate: b.birthDate ?? null,
      sex: b.sex,
      email: b.email ?? null,
      phoneEnc: b.phone ? encrypt(ctx.keys.encryptionKey, b.phone) : null,
      modality: b.modality,
      status: b.status,
      preferences: b.preferences ?? null,
      createdBy: ctx.actor.userId,
      updatedBy: ctx.actor.userId,
    });
    await tx.insert(trainerClientAssignments).values({
      organizationId: ctx.actor.organizationId,
      trainerId,
      clientId,
      role: 'primary',
      createdBy: ctx.actor.userId,
    });
    const p = data.profile ?? trainingProfileSchema.parse({});
    await tx.insert(clientTrainingProfiles).values({
      clientId,
      experienceLevel: p.experienceLevel,
      yearsTraining: p.yearsTraining != null ? String(p.yearsTraining) : null,
      sessionsPerWeek: p.sessionsPerWeek ?? null,
      sessionDurationMin: p.sessionDurationMin ?? null,
      location: p.location ?? null,
      notes: p.notes ?? null,
      createdBy: ctx.actor.userId,
    });
    if (data.goals?.length) await insertGoals(tx, ctx, clientId, data.goals);
    if (data.availability?.length) await replaceAvailability(tx, clientId, data.availability);
    if (data.equipment?.length) await replaceEquipment(tx, ctx, clientId, data.equipment);
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'client',
      entityId: clientId,
      clientId,
      changes: diffFields({}, { ...b, phone: b.phone ? '[set]' : null }, BASIC_FIELDS),
    });
    return { id: clientId };
  });
}

async function updateClient_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ version: number }> {
  const data = parse(updateClientSchema, input);
  const resource = await authorizeClient(ctx, 'clients:write', clientId);
  const scope = requirePermission(ctx, 'clients:write', resource);
  const { expectedVersion, ...changes } = data;
  const keys = Object.keys(changes).filter(
    (k) => (changes as Record<string, unknown>)[k] !== undefined,
  ) as (keyof typeof changes)[];
  if (scope === 'own') {
    const forbidden = keys.filter(
      (k) => !(CLIENT_SELF_EDITABLE_FIELDS as readonly string[]).includes(k),
    );
    if (forbidden.length) {
      throw new DomainError('forbidden', 'No puedes modificar estos datos.', { fields: forbidden });
    }
  }
  if (changes.status === 'archived') {
    throw new DomainError('validation', 'Usa la acción de archivar.', { status: ['use_archive'] });
  }
  return ctx.db.transaction(async (tx) => {
    const [before] = await tx.select().from(clients).where(eq(clients.id, clientId)).for('update');
    if (!before) throw new DomainError('not_found', 'Cliente no encontrado.');
    if (before.version !== expectedVersion) {
      throw new DomainError(
        'conflict',
        'Otra persona ha modificado este cliente. Recarga los datos.',
      );
    }
    const set: Partial<typeof clients.$inferInsert> = {
      updatedBy: ctx.actor.userId,
      version: before.version + 1,
    };
    for (const k of keys) {
      if (k === 'phone')
        set.phoneEnc = changes.phone ? encrypt(ctx.keys.encryptionKey, changes.phone) : null;
      else (set as Record<string, unknown>)[k] = (changes as Record<string, unknown>)[k] ?? null;
    }
    await tx.update(clients).set(set).where(eq(clients.id, clientId));
    const beforePlain = {
      ...before,
      phone: before.phoneEnc ? openSecret(ctx.keys, before.phoneEnc) : null,
    };
    const afterPlain = {
      ...beforePlain,
      ...Object.fromEntries(keys.map((k) => [k, changes[k] ?? null])),
    };
    const diff = diffFields(beforePlain, afterPlain, BASIC_FIELDS).map((d) =>
      d.field === 'phone'
        ? { ...d, before: d.before ? '[set]' : null, after: d.after ? '[set]' : null }
        : d,
    );
    if (diff.length) {
      await writeAudit(tx, ctx, {
        action: 'update',
        entityType: 'client',
        entityId: clientId,
        clientId,
        changes: diff,
      });
    }
    return { version: before.version + 1 };
  });
}

async function setClientArchived_(
  ctx: RequestContext,
  clientId: string,
  archived: boolean,
  reason?: string,
): Promise<void> {
  const resource = await authorizeClient(ctx, 'clients:archive', clientId);
  requirePermission(ctx, 'clients:archive', resource);
  await ctx.db.transaction(async (tx) => {
    const [before] = await tx.select().from(clients).where(eq(clients.id, clientId));
    await tx
      .update(clients)
      .set({
        status: archived ? 'archived' : 'active',
        archivedAt: archived ? ctx.now() : null,
        version: before!.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(clients.id, clientId));
    await writeAudit(tx, ctx, {
      action: archived ? 'archive' : 'restore',
      entityType: 'client',
      entityId: clientId,
      clientId,
      changes: [
        { field: 'status', before: before!.status, after: archived ? 'archived' : 'active' },
      ],
      reason: reason ?? null,
    });
  });
}

function denyOwnScope(
  ctx: RequestContext,
  permission: 'clients:write' | 'goals:write',
  resource: Awaited<ReturnType<typeof authorizeClient>>,
) {
  if (requirePermission(ctx, permission, resource) === 'own') {
    throw new DomainError('forbidden', 'Solo tu entrenador puede modificar estos datos.');
  }
}

async function updateTrainingProfile_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<void> {
  const p = parse(trainingProfileSchema, input);
  const resource = await authorizeClient(ctx, 'clients:write', clientId);
  denyOwnScope(ctx, 'clients:write', resource);
  const fields = [
    'experienceLevel',
    'yearsTraining',
    'sessionsPerWeek',
    'sessionDurationMin',
    'location',
    'notes',
  ] as const;
  await ctx.db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(clientTrainingProfiles)
      .where(eq(clientTrainingProfiles.clientId, clientId));
    const values = {
      experienceLevel: p.experienceLevel,
      yearsTraining: p.yearsTraining != null ? String(p.yearsTraining) : null,
      sessionsPerWeek: p.sessionsPerWeek ?? null,
      sessionDurationMin: p.sessionDurationMin ?? null,
      location: p.location ?? null,
      notes: p.notes ?? null,
      updatedBy: ctx.actor.userId,
    };
    await tx
      .insert(clientTrainingProfiles)
      .values({ clientId, ...values, createdBy: ctx.actor.userId })
      .onConflictDoUpdate({
        target: clientTrainingProfiles.clientId,
        set: { ...values, version: sql`${clientTrainingProfiles.version} + 1` },
      });
    const norm = (r: Record<string, unknown> | undefined): Record<string, unknown> | null =>
      r ? { ...r, yearsTraining: r.yearsTraining != null ? Number(r.yearsTraining) : null } : null;
    const diff = diffFields(norm(before), norm(values), fields);
    if (diff.length) {
      await writeAudit(tx, ctx, {
        action: 'update',
        entityType: 'client_training_profile',
        entityId: clientId,
        clientId,
        changes: diff,
      });
    }
  });
}

async function setClientGoals_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<void> {
  const { goals: list } = parse(setGoalsSchema, input);
  const resource = await authorizeClient(ctx, 'goals:write', clientId);
  denyOwnScope(ctx, 'goals:write', resource);
  await ctx.db.transaction(async (tx) => {
    const before = await tx
      .select({
        goalId: clientGoals.goalId,
        isPrimary: clientGoals.isPrimary,
        w: clientGoals.priorityWeight,
      })
      .from(clientGoals)
      .where(and(eq(clientGoals.clientId, clientId), eq(clientGoals.status, 'active')));
    // Previous goals are kept as history (status = dropped), never deleted.
    await tx
      .update(clientGoals)
      .set({ status: 'dropped', updatedBy: ctx.actor.userId })
      .where(and(eq(clientGoals.clientId, clientId), eq(clientGoals.status, 'active')));
    await insertGoals(tx, ctx, clientId, list);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'client_goals',
      entityId: clientId,
      clientId,
      changes: [
        {
          field: 'goals',
          before: before.map((g) => ({
            goalId: g.goalId,
            isPrimary: g.isPrimary,
            weight: Number(g.w),
          })),
          after: list.map((g) => ({
            goalId: g.goalId,
            isPrimary: g.isPrimary,
            weight: g.priorityWeight,
          })),
        },
      ],
    });
  });
}

async function setClientAvailability_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<void> {
  const { slots } = parse(setAvailabilitySchema, input);
  // Availability is self-editable by the client (§14.2).
  await authorizeClient(ctx, 'clients:write', clientId);
  await ctx.db.transaction(async (tx) => {
    await replaceAvailability(tx, clientId, slots);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'client_availability',
      entityId: clientId,
      clientId,
      changes: { slots: slots.length },
    });
  });
}

async function setClientEquipment_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<void> {
  const { items } = parse(setEquipmentSchema, input);
  const resource = await authorizeClient(ctx, 'clients:write', clientId);
  denyOwnScope(ctx, 'clients:write', resource);
  await ctx.db.transaction(async (tx) => {
    await replaceEquipment(tx, ctx, clientId, items);
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'client_equipment',
      entityId: clientId,
      clientId,
      changes: { items: items.length },
    });
  });
}

async function addHistoryEntry_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<{ id: string }> {
  const data = parse(historyEntrySchema, input);
  const resource = await authorizeClient(ctx, 'clients:write', clientId);
  denyOwnScope(ctx, 'clients:write', resource);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(clientHistoryEntries)
      .values({
        clientId,
        ...data,
        periodStart: data.periodStart ?? null,
        periodEnd: data.periodEnd ?? null,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: clientHistoryEntries.id });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'client_history_entry',
      entityId: row!.id,
      clientId,
    });
    return { id: row!.id };
  });
}

async function deleteHistoryEntry_(
  ctx: RequestContext,
  clientId: string,
  entryId: string,
): Promise<void> {
  const resource = await authorizeClient(ctx, 'clients:write', clientId);
  denyOwnScope(ctx, 'clients:write', resource);
  await ctx.db.transaction(async (tx) => {
    const deleted = await tx
      .delete(clientHistoryEntries)
      .where(and(eq(clientHistoryEntries.id, entryId), eq(clientHistoryEntries.clientId, clientId)))
      .returning({ description: clientHistoryEntries.description });
    if (!deleted.length) throw new DomainError('not_found', 'Entrada no encontrada.');
    await writeAudit(tx, ctx, {
      action: 'delete',
      entityType: 'client_history_entry',
      entityId: entryId,
      clientId,
      changes: [{ field: 'description', before: deleted[0]!.description, after: null }],
    });
  });
}

async function assignTrainer_(
  ctx: RequestContext,
  clientId: string,
  input: unknown,
): Promise<void> {
  const data = parse(assignTrainerSchema, input);
  const resource = await authorizeClient(ctx, 'clients:read', clientId);
  requirePermission(ctx, 'clients:assign', resource);
  const [t] = await ctx.db
    .select({ id: trainers.id })
    .from(trainers)
    .where(
      and(
        eq(trainers.id, data.trainerId),
        eq(trainers.organizationId, ctx.actor.organizationId),
        eq(trainers.active, true),
      ),
    );
  if (!t) throw new DomainError('validation', 'Entrenador no válido.', { trainerId: ['unknown'] });
  await ctx.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(trainerClientAssignments)
      .values({
        organizationId: ctx.actor.organizationId,
        trainerId: t.id,
        clientId,
        role: data.role,
        createdBy: ctx.actor.userId,
      })
      .onConflictDoNothing()
      .returning({ id: trainerClientAssignments.id });
    if (!inserted.length) throw new DomainError('conflict', 'Ese entrenador ya está asignado.');
    await writeAudit(tx, ctx, {
      action: 'assign',
      entityType: 'trainer_client_assignment',
      entityId: inserted[0]!.id,
      clientId,
      changes: { trainerId: t.id, role: data.role },
    });
  });
}

async function unassignTrainer_(
  ctx: RequestContext,
  clientId: string,
  assignmentId: string,
): Promise<void> {
  const resource = await authorizeClient(ctx, 'clients:read', clientId);
  requirePermission(ctx, 'clients:assign', resource);
  await ctx.db.transaction(async (tx) => {
    const active = await tx
      .select()
      .from(trainerClientAssignments)
      .where(
        and(
          eq(trainerClientAssignments.clientId, clientId),
          isNull(trainerClientAssignments.endedAt),
        ),
      );
    const target = active.find((a) => a.id === assignmentId);
    if (!target) throw new DomainError('not_found', 'Asignación no encontrada.');
    if (active.length === 1) {
      throw new DomainError('conflict', 'El cliente debe tener al menos un entrenador asignado.');
    }
    await tx
      .update(trainerClientAssignments)
      .set({ endedAt: ctx.now() })
      .where(eq(trainerClientAssignments.id, assignmentId));
    await writeAudit(tx, ctx, {
      action: 'unassign',
      entityType: 'trainer_client_assignment',
      entityId: assignmentId,
      clientId,
      changes: { trainerId: target.trainerId },
    });
  });
}

/**
 * Clients within the actor's scope that currently show the referral banner. Single pass over
 * declarations/screenings instead of one detail load per client.
 */
async function listClientsNeedingReferral_(
  ctx: RequestContext,
): Promise<{ id: string; firstName: string; lastName: string }[]> {
  const scope = requirePermission(ctx, 'clients:read');
  const base = and(scopeCondition(ctx, scope), sql`${clients.status} <> 'archived'`);
  const rows = await ctx.db
    .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(
      and(
        base,
        sql`(
          EXISTS (SELECT 1 FROM health_declarations h WHERE h.client_id = ${clients.id}
                  AND h.requires_professional_assessment AND h.cleared_at IS NULL)
          OR (SELECT s.result FROM screening_responses s WHERE s.client_id = ${clients.id}
              ORDER BY s.completed_on DESC, s.created_at DESC LIMIT 1) = 'refer'
        )`,
      ),
    )
    .orderBy(asc(clients.lastName));
  return rows;
}

// Use cases run under Row Level Security (see rls.ts).
export const listClients = secured(listClients_);
export const getClient = secured(getClient_);
export const createClient = secured(createClient_);
export const updateClient = secured(updateClient_);
export const setClientArchived = secured(setClientArchived_);
export const updateTrainingProfile = secured(updateTrainingProfile_);
export const setClientGoals = secured(setClientGoals_);
export const setClientAvailability = secured(setClientAvailability_);
export const setClientEquipment = secured(setClientEquipment_);
export const addHistoryEntry = secured(addHistoryEntry_);
export const deleteHistoryEntry = secured(deleteHistoryEntry_);
export const assignTrainer = secured(assignTrainer_);
export const unassignTrainer = secured(unassignTrainer_);
export const listClientsNeedingReferral = secured(listClientsNeedingReferral_);
