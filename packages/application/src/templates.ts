/**
 * Template library (restructure phase 3, docs/PLANNING.md §6 ter): filtered list, detail with its
 * versions, «Crear desde cero», «Duplicar en mis plantillas», edit (every saved edit is a version),
 * archive and restore a version. Global templates are read-only; the organization's are shared by
 * its staff (permission `plans:templates`).
 */
import {
  archiveTemplateSchema,
  createTemplateSchema,
  duplicateTemplateSchema,
  restoreTemplateVersionSchema,
  templateQuerySchema,
  updateTemplateSchema,
} from '@tp/contracts';
import { schema, uuidv7 } from '@tp/db';
import {
  DomainError,
  expandTemplate,
  matchesTemplate,
  missingEquipment,
  prescriptionShort,
  slugify,
  templateExerciseRefs,
  templateFitScore,
  templateSessions,
  validateDefinition,
  validatePrescription,
  withEditorIds,
  type ClientFit,
  type PlanDuration,
  type TemplateDefinition,
  type TemplateFacts,
  type TemplateKind,
} from '@tp/domain';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import type { RequestContext } from './context';
import { resolveExercises } from './planning';
import { secured } from './rls';
import { blankDefinition, recordTemplateVersion, templateEquipment } from './template-store';
import { parse } from './validation';

const {
  planTemplates,
  planTemplateVersions,
  programmingProfiles,
  clients,
  clientTrainingProfiles,
  clientEquipment,
  equipment,
  methods,
  users,
} = schema;

const visible = (ctx: RequestContext, col: AnyPgColumn) =>
  or(isNull(col), eq(col, ctx.actor.organizationId));

/** What the trainer's client brings to the library: profile, level, days and equipment. */
async function clientFit(ctx: RequestContext, clientId: string): Promise<ClientFit> {
  await authorizeClient(ctx, 'plans:read', clientId);
  const [c] = await ctx.db
    .select({
      profileSlug: programmingProfiles.slug,
      levelN: clients.programmingLevel,
      sessionsPerWeek: clientTrainingProfiles.sessionsPerWeek,
    })
    .from(clients)
    .leftJoin(programmingProfiles, eq(programmingProfiles.id, clients.programmingProfileId))
    .leftJoin(clientTrainingProfiles, eq(clientTrainingProfiles.clientId, clients.id))
    .where(eq(clients.id, clientId));
  const eqRows = await ctx.db
    .select({ slug: equipment.slug })
    .from(clientEquipment)
    .innerJoin(equipment, eq(equipment.id, clientEquipment.equipmentId))
    .where(eq(clientEquipment.clientId, clientId));
  return {
    profileSlug: c?.profileSlug ?? null,
    levelN: c?.levelN ?? null,
    sessionsPerWeek: c?.sessionsPerWeek ?? null,
    equipment: eqRows.map((r) => r.slug),
  };
}

/**
 * The library with its filters (profile, level, days, population, kind, origin, archived, text and
 * «what the client can do with their equipment»). With a client, templates are ordered by fit.
 * Reads only the metadata, never the content: a few hundred templates answer in milliseconds.
 */
async function listPlanTemplates_(ctx: RequestContext, query: unknown = {}) {
  requirePermission(ctx, 'plans:templates');
  const q = parse(templateQuerySchema, query ?? {});
  const fit = q.client ? await clientFit(ctx, q.client) : null;
  const [rows, profiles, equipmentNames] = await Promise.all([
    ctx.db
      .select({
        id: planTemplates.id,
        slug: planTemplates.slug,
        name: planTemplates.name,
        description: planTemplates.description,
        goalSlug: planTemplates.goalSlug,
        level: planTemplates.level,
        levelN: planTemplates.levelN,
        profileSlug: planTemplates.profileSlug,
        sessionsPerWeek: planTemplates.sessionsPerWeek,
        durationMonths: planTemplates.durationMonths,
        methodSlugs: planTemplates.methodSlugs,
        population: planTemplates.population,
        equipmentSlugs: planTemplates.equipmentSlugs,
        kind: planTemplates.kind,
        templateVersion: planTemplates.templateVersion,
        archivedAt: planTemplates.archivedAt,
        organizationId: planTemplates.organizationId,
        /** Saved from a real plan with its own weeks: its length is fixed. */
        fixedLength: sql<boolean>`jsonb_array_length(coalesce(${planTemplates.definition} -> 'weeks', '[]'::jsonb)) > 0`,
      })
      .from(planTemplates)
      .where(
        and(visible(ctx, planTemplates.organizationId), eq(planTemplates.status, 'published')),
      ),
    ctx.db
      .select({
        slug: programmingProfiles.slug,
        name: programmingProfiles.name,
        sortOrder: programmingProfiles.sortOrder,
      })
      .from(programmingProfiles)
      .where(visible(ctx, programmingProfiles.organizationId)),
    fit
      ? ctx.db
          .select({ slug: equipment.slug, name: equipment.name })
          .from(equipment)
          .where(visible(ctx, equipment.organizationId))
      : Promise.resolve([]),
  ]);
  const profile = new Map(profiles.map((p) => [p.slug, p]));
  const eqName = new Map(equipmentNames.map((e) => [e.slug, e.name]));
  const items = rows
    .map(({ organizationId, archivedAt, ...r }) => {
      const facts: TemplateFacts = {
        ...r,
        kind: r.kind as TemplateKind,
        isGlobal: organizationId === null,
        archived: archivedAt !== null,
      };
      return {
        ...r,
        isGlobal: facts.isGlobal,
        archived: facts.archived,
        profileName: r.profileSlug ? (profile.get(r.profileSlug)?.name ?? r.profileSlug) : null,
        /** Equipment the client lacks for it (names), when listing for a client. */
        missingEquipment: fit?.equipment
          ? missingEquipment(r.equipmentSlugs, fit.equipment).map((e) => eqName.get(e) ?? e)
          : [],
        fit: fit ? templateFitScore(facts, fit) : null,
        facts,
      };
    })
    .filter((t) =>
      matchesTemplate(t.facts, {
        ...q,
        equipment: q.fitsEquipment ? (fit?.equipment ?? []) : undefined,
      }),
    );
  const order = (t: (typeof items)[number]) => profile.get(t.profileSlug ?? '')?.sortOrder ?? 999;
  items.sort(
    (a, b) =>
      (fit ? (b.fit ?? 0) - (a.fit ?? 0) : 0) ||
      order(a) - order(b) ||
      (a.levelN ?? 0) - (b.levelN ?? 0) ||
      a.sessionsPerWeek - b.sessionsPerWeek ||
      a.name.localeCompare(b.name, 'es'),
  );
  return items.map(({ facts: _f, ...t }) => t);
}
export type PlanTemplateSummary = Awaited<ReturnType<typeof listPlanTemplates_>>[number];

async function loadTemplate(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'plans:templates');
  const [t] = await ctx.db
    .select()
    .from(planTemplates)
    .where(and(eq(planTemplates.id, id), visible(ctx, planTemplates.organizationId)));
  if (!t) throw new DomainError('not_found', 'Plantilla no encontrada.');
  return t;
}

/** Own templates only (global ones are read-only: duplicate them first). */
async function loadOwnTemplate(ctx: RequestContext, id: string) {
  const t = await loadTemplate(ctx, id);
  if (t.organizationId === null)
    throw new DomainError(
      'forbidden',
      'Las plantillas de la plataforma no se editan: duplícala en tus plantillas.',
    );
  return t;
}

async function getPlanTemplate_(ctx: RequestContext, id: string) {
  const t = await loadTemplate(ctx, id);
  // Rows without an id (global templates) get one by position: the same on every read.
  let n = 0;
  const def = withEditorIds(t.definition as TemplateDefinition, () => `r${++n}`);
  const refs = templateExerciseRefs(def);
  const ex = await resolveExercises(ctx, refs);
  const [ms, versions, eqNames] = await Promise.all([
    t.methodSlugs.length
      ? ctx.db
          .select({ id: methods.id, slug: methods.slug, name: methods.name })
          .from(methods)
          .where(and(isNull(methods.organizationId), inArray(methods.slug, t.methodSlugs)))
      : Promise.resolve([]),
    ctx.db
      .select({
        version: planTemplateVersions.version,
        name: planTemplateVersions.name,
        note: planTemplateVersions.note,
        createdAt: planTemplateVersions.createdAt,
        updatedAt: planTemplateVersions.updatedAt,
        usedAt: planTemplateVersions.usedAt,
        author: users.displayName,
      })
      .from(planTemplateVersions)
      .leftJoin(users, eq(users.id, planTemplateVersions.createdBy))
      .where(eq(planTemplateVersions.templateId, t.id))
      .orderBy(desc(planTemplateVersions.version)),
    t.equipmentSlugs.length
      ? ctx.db
          .select({ slug: equipment.slug, name: equipment.name })
          .from(equipment)
          .where(
            and(visible(ctx, equipment.organizationId), inArray(equipment.slug, t.equipmentSlugs)),
          )
      : Promise.resolve([]),
  ]);
  const expanded = expandTemplate(def);
  const describe = (x: TemplateDefinition['sessions'][number]) => ({
    id: x.id!,
    dayLabel: x.dayLabel,
    title: x.title,
    objective: x.objective ?? null,
    blocks: x.blocks.map((b) => ({
      id: b.id!,
      type: b.type,
      label: b.label ?? null,
      exercises: b.exercises.map((e) => ({
        id: e.id!,
        name: ex.get(e.exercise)?.name ?? e.exercise,
        short: prescriptionShort(e.prescription),
        progression: e.progression?.kind ?? 'none',
      })),
    })),
  });
  return {
    ...t,
    definition: def,
    isGlobal: t.organizationId === null,
    archived: t.archivedAt !== null,
    editable: t.organizationId !== null && t.archivedAt === null,
    fixedLength: !!def.weeks?.length,
    totalWeeks: expanded.totalWeeks,
    methods: ms,
    equipment: t.equipmentSlugs.map((s) => eqNames.find((e) => e.slug === s)?.name ?? s),
    /** Exercises the template uses: its reference (slug or id), id and name, for the table. */
    exercises: refs.flatMap((ref) => {
      const e = ex.get(ref);
      return e ? [{ ref, id: e.id, name: e.name }] : [];
    }),
    versions,
    phases: expanded.phases.map((p, i) => ({
      name: p.name,
      objective: p.objective ?? null,
      startWeek: p.startWeek,
      endWeek: p.endWeek,
      /** The phase has its own weekly sessions (otherwise, the template's). */
      ownSessions: !!def.phases[i]?.sessions,
      mesocycles: p.mesocycles.map((m) => ({
        name: m.name,
        weeks: m.weeks,
        focus: m.focus ?? null,
        weekTypes: m.microcycles.map((w) => w.weekType),
      })),
    })),
    sessions: def.sessions.map(describe),
    phaseSessions: def.phases.map((p) => (p.sessions ?? []).map(describe)),
  };
}
export type PlanTemplateDetail = Awaited<ReturnType<typeof getPlanTemplate_>>;

/** Checks a definition before saving it: structure, exercises available and prescriptions. */
async function checkDefinition(ctx: RequestContext, def: TemplateDefinition) {
  const issues: Record<string, string[]> = {};
  for (const i of validateDefinition(def)) (issues[i.path] ??= []).push(i.message);
  const refs = templateExerciseRefs(def);
  const ex = await resolveExercises(ctx, refs);
  const missing = refs.filter((r) => !ex.has(r));
  if (missing.length) issues.exercises = missing.map((m) => `Ejercicio no disponible: ${m}.`);
  for (const s of templateSessions(def))
    for (const b of s.blocks)
      for (const e of b.exercises) {
        const v = validatePrescription(e.prescription, {
          supportsVbt: ex.get(e.exercise)?.supportsVbt ?? false,
          clientExperience: null,
        });
        for (const [k, m] of Object.entries(v))
          (issues[`${s.dayLabel}.${ex.get(e.exercise)?.name ?? e.exercise}.${k}`] ??= []).push(
            ...m,
          );
      }
  if (Object.keys(issues).length)
    throw new DomainError('validation', 'La plantilla tiene datos no válidos.', issues);
}

async function uniqueSlug(ctx: RequestContext, name: string) {
  const base = slugify(name);
  const taken = new Set(
    (
      await ctx.db
        .select({ slug: planTemplates.slug })
        .from(planTemplates)
        .where(eq(planTemplates.organizationId, ctx.actor.organizationId))
    ).map((r) => r.slug),
  );
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** «Crear desde cero»: an empty template with the sessions of a week, ready for the table. */
async function createTemplate_(ctx: RequestContext, input: unknown): Promise<{ id: string }> {
  requirePermission(ctx, 'plans:templates');
  const d = parse(createTemplateSchema, input);
  const def = withEditorIds(
    blankDefinition(d.sessionsPerWeek, d.durationMonths as PlanDuration),
    uuidv7,
  );
  const slug = await uniqueSlug(ctx, d.name);
  return ctx.db.transaction(async (tx) => {
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
        profileSlug: d.profileSlug ?? null,
        levelN: d.levelN ?? null,
        population: d.population ?? [],
        kind: d.kind ?? 'training',
        createdBy: ctx.actor.userId,
      })
      .returning({ id: planTemplates.id, organizationId: planTemplates.organizationId });
    await recordTemplateVersion(tx, ctx, t!, { name: d.name, definition: def }, { note: 'Creada' });
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'plan_template',
      entityId: t!.id,
      changes: { name: d.name, fromScratch: true, sessionsPerWeek: def.sessionsPerWeek },
    });
    return { id: t!.id };
  });
}

/** «Duplicar en mis plantillas»: an independent copy (of a global or own template) to edit. */
async function duplicateTemplate_(
  ctx: RequestContext,
  id: string,
  input: unknown = {},
): Promise<{ id: string }> {
  const src = await loadTemplate(ctx, id);
  const d = parse(duplicateTemplateSchema, input ?? {});
  const name = d.name ?? `${src.name} (copia)`;
  // New editor ids: the copy's rows are its own.
  const def = withEditorIds(stripIds(src.definition as TemplateDefinition), uuidv7);
  const slug = await uniqueSlug(ctx, name);
  return ctx.db.transaction(async (tx) => {
    const [t] = await tx
      .insert(planTemplates)
      .values({
        organizationId: ctx.actor.organizationId,
        slug,
        name,
        description: src.description,
        goalSlug: src.goalSlug,
        level: src.level,
        sessionsPerWeek: src.sessionsPerWeek,
        durationMonths: src.durationMonths,
        definition: def,
        methodSlugs: src.methodSlugs,
        status: 'published',
        profileSlug: src.profileSlug,
        levelN: src.levelN,
        population: src.population,
        equipmentSlugs: src.equipmentSlugs,
        kind: src.kind,
        derivedFromTemplateId: src.id,
        createdBy: ctx.actor.userId,
      })
      .returning({ id: planTemplates.id, organizationId: planTemplates.organizationId });
    await recordTemplateVersion(
      tx,
      ctx,
      t!,
      { name, definition: def },
      { note: `Copia de «${src.name}» (v${src.templateVersion})` },
    );
    await writeAudit(tx, ctx, {
      action: 'create',
      entityType: 'plan_template',
      entityId: t!.id,
      changes: { duplicatedFrom: src.id, version: src.templateVersion, name },
    });
    return { id: t!.id };
  });
}

function stripIds(def: TemplateDefinition): TemplateDefinition {
  const strip = (s: TemplateDefinition['sessions'][number]) => {
    const { id: _s, ...rest } = s;
    void _s;
    return {
      ...rest,
      blocks: s.blocks.map(({ id: _b, ...b }) => {
        void _b;
        return {
          ...b,
          exercises: b.exercises.map(({ id: _e, ...e }) => {
            void _e;
            return e;
          }),
        };
      }),
    };
  };
  return {
    ...def,
    sessions: def.sessions.map(strip),
    phases: def.phases.map((p) => (p.sessions ? { ...p, sessions: p.sessions.map(strip) } : p)),
    ...(def.weeks
      ? { weeks: def.weeks.map((w) => ({ ...w, sessions: w.sessions.map(strip) })) }
      : {}),
  };
}

/**
 * Saves an edit of an own template (details and/or content) with optimistic locking. A change of
 * name or content is a version (decision A18); the equipment it needs is recalculated.
 */
async function updateTemplate_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<{ version: number; templateVersion: number }> {
  const t = await loadOwnTemplate(ctx, id);
  const d = parse(updateTemplateSchema, input);
  if (t.archivedAt)
    throw new DomainError('validation', 'La plantilla está archivada: recupérala para editarla.');
  if (d.expectedVersion !== t.version)
    throw new DomainError(
      'conflict',
      'Otra persona ha cambiado esta plantilla mientras editabas: recarga para ver sus cambios.',
    );
  const def = d.definition
    ? withEditorIds(d.definition as TemplateDefinition, uuidv7)
    : (t.definition as TemplateDefinition);
  if (d.definition) await checkDefinition(ctx, def);
  const name = d.name ?? t.name;
  const contentChanged =
    name !== t.name || (!!d.definition && JSON.stringify(def) !== JSON.stringify(t.definition));
  return ctx.db.transaction(async (tx) => {
    const templateVersion = contentChanged
      ? await recordTemplateVersion(tx, ctx, t, { name, definition: def }, { note: d.note })
      : t.templateVersion;
    const equipmentSlugs = d.definition ? await templateEquipment(tx, ctx, def) : t.equipmentSlugs;
    const [u] = await tx
      .update(planTemplates)
      .set({
        name,
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.profileSlug !== undefined ? { profileSlug: d.profileSlug } : {}),
        ...(d.levelN !== undefined ? { levelN: d.levelN } : {}),
        ...(d.population ? { population: d.population } : {}),
        ...(d.kind ? { kind: d.kind } : {}),
        definition: def,
        sessionsPerWeek: def.sessionsPerWeek,
        durationMonths: def.durationMonths,
        equipmentSlugs,
        templateVersion,
        version: t.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(and(eq(planTemplates.id, t.id), eq(planTemplates.version, t.version)))
      .returning({ version: planTemplates.version });
    if (!u)
      throw new DomainError(
        'conflict',
        'Otra persona ha cambiado esta plantilla mientras editabas: recarga para ver sus cambios.',
      );
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'plan_template',
      entityId: t.id,
      changes: {
        ...(name !== t.name ? { name: [t.name, name] } : {}),
        ...(d.definition ? { content: true } : {}),
        templateVersion,
        ...(d.note ? { note: d.note } : {}),
      },
    });
    return { version: u.version, templateVersion };
  });
}

/** Archive (hide from the library without deleting: plans keep pointing to it) or recover. */
async function archiveTemplate_(ctx: RequestContext, id: string, input: unknown): Promise<void> {
  const t = await loadOwnTemplate(ctx, id);
  const d = parse(archiveTemplateSchema, input);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(planTemplates)
      .set({
        archivedAt: d.archived ? ctx.now() : null,
        version: t.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(eq(planTemplates.id, t.id));
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'plan_template',
      entityId: t.id,
      changes: { archived: d.archived },
    });
  });
}

/** Brings back the content of an earlier version as a new version (nothing is lost). */
async function restoreTemplateVersion_(
  ctx: RequestContext,
  id: string,
  input: unknown,
): Promise<{ version: number; templateVersion: number }> {
  const t = await loadOwnTemplate(ctx, id);
  const d = parse(restoreTemplateVersionSchema, input);
  if (t.archivedAt)
    throw new DomainError('validation', 'La plantilla está archivada: recupérala para editarla.');
  if (d.expectedVersion !== t.version)
    throw new DomainError(
      'conflict',
      'Otra persona ha cambiado esta plantilla mientras editabas: recarga para ver sus cambios.',
    );
  const [v] = await ctx.db
    .select()
    .from(planTemplateVersions)
    .where(
      and(eq(planTemplateVersions.templateId, t.id), eq(planTemplateVersions.version, d.version)),
    );
  if (!v) throw new DomainError('not_found', 'Versión no encontrada.');
  const def = v.definition as TemplateDefinition;
  return ctx.db.transaction(async (tx) => {
    const templateVersion = await recordTemplateVersion(
      tx,
      ctx,
      t,
      { name: v.name, definition: def },
      { note: `Restaurada la versión ${v.version}`, forceNew: true },
    );
    const [u] = await tx
      .update(planTemplates)
      .set({
        name: v.name,
        definition: def,
        sessionsPerWeek: def.sessionsPerWeek,
        durationMonths: def.durationMonths,
        equipmentSlugs: await templateEquipment(tx, ctx, def),
        templateVersion,
        version: t.version + 1,
        updatedBy: ctx.actor.userId,
      })
      .where(and(eq(planTemplates.id, t.id), eq(planTemplates.version, t.version)))
      .returning({ version: planTemplates.version });
    if (!u)
      throw new DomainError(
        'conflict',
        'Otra persona ha cambiado esta plantilla mientras editabas: recarga para ver sus cambios.',
      );
    await writeAudit(tx, ctx, {
      action: 'update',
      entityType: 'plan_template',
      entityId: t.id,
      changes: { restoredVersion: v.version, templateVersion },
    });
    return { version: u.version, templateVersion };
  });
}

export const listPlanTemplates = secured(listPlanTemplates_);
export const getPlanTemplate = secured(getPlanTemplate_);
export const createTemplate = secured(createTemplate_);
export const duplicateTemplate = secured(duplicateTemplate_);
export const updateTemplate = secured(updateTemplate_);
export const archiveTemplate = secured(archiveTemplate_);
export const restoreTemplateVersion = secured(restoreTemplateVersion_);
