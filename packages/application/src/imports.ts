/**
 * Validated imports (encargo §52): clients, exercises, assessments and bibliographic references from
 * CSV or XLSX. Nothing is written until the trainer confirms: the file is parsed, every row is
 * validated (format with the contract's zod schema, then references against the database: goals,
 * tests, clients, duplicates) and stored with its errors for a preview. Confirming imports only the
 * valid rows, each through the regular use case (same permissions, audit and RLS); a row that
 * still fails is marked with its error and the rest go on. The raw file is not kept.
 */
import {
  createImportSchema,
  IMPORT_COLUMNS,
  importRowSchemas,
  type ImportEntity,
} from '@tp/contracts';
import { schema } from '@tp/db';
import { DomainError, normalizeHeader, parseCsv, toCsv } from '@tp/domain';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { createAssessment, insertReferenceValue, recordAssessmentResult } from './assessments';
import { writeAudit } from './audit';
import { authorizeClient, requirePermission } from './authz';
import { createClient } from './clients';
import type { RequestContext } from './context';
import { createExercise } from './library';
import type { FileOut } from './reports';
import { readXlsx, toXlsx } from './render/xlsx';
import { secured, withSavepoint } from './rls';
import { createSource } from './science';
import { parse } from './validation';

const {
  assessmentTests,
  clients,
  equipment,
  evidenceSources,
  exercises,
  goals,
  importJobs,
  importRows,
  movementPatterns,
  populations,
  referenceValues,
  sports,
} = schema;

const MAX_ROWS = 1000;
const MAX_CELL = 5000;
type Errors = Record<string, string[]>;
type Row = { rowNumber: number; data: Record<string, unknown>; errors: Errors };

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const add = (e: Errors, field: string, msg: string) => (e[field] ??= []).push(msg);

/** By slug or by (accent/case-insensitive) name. */
function lookup<T extends { slug: string; name: string }>(list: T[], value: string): T | undefined {
  const v = norm(value);
  return list.find((x) => x.slug === value || norm(x.slug) === v || norm(x.name) === v);
}

// ── Parsing ───────────────────────────────────────────────────────────────────

async function readRows(fileName: string, base64: string): Promise<string[][]> {
  const buf = Buffer.from(base64, 'base64');
  if (/\.xlsx$/i.test(fileName)) {
    try {
      return await readXlsx(buf);
    } catch {
      throw new DomainError('validation', 'No se pudo leer el archivo XLSX.', {
        file: ['invalid'],
      });
    }
  }
  if (/\.(csv|txt)$/i.test(fileName)) return parseCsv(buf.toString('utf8'));
  throw new DomainError('validation', 'Formato no admitido: usa CSV o XLSX.', { file: ['format'] });
}

function toRecords(entity: ImportEntity, rows: string[][]) {
  const cols = IMPORT_COLUMNS[entity];
  const [head, ...data] = rows;
  if (!head) throw new DomainError('validation', 'El archivo está vacío.', { file: ['empty'] });
  const keys = head.map((h) => {
    const k = normalizeHeader(h);
    return cols.find((c) => c.key === k || c.aliases?.includes(k))?.key ?? null;
  });
  const missing = cols.filter((c) => c.required && !keys.includes(c.key)).map((c) => c.header);
  if (missing.length)
    throw new DomainError('validation', `Faltan columnas obligatorias: ${missing.join(', ')}.`, {
      columns: missing,
    });
  if (data.length > MAX_ROWS)
    throw new DomainError('validation', `Máximo ${MAX_ROWS} filas por archivo.`, {
      file: ['too_many_rows'],
    });
  // No importable field takes more than 4 000 characters: longer cells are refused before parsing.
  for (const [i, r] of data.entries()) {
    const j = r.findIndex((c) => (c ?? '').length > MAX_CELL);
    if (j >= 0)
      throw new DomainError(
        'validation',
        `La celda de la fila ${i + 2}, columna «${head[j] ?? j + 1}», es demasiado larga (máximo ${MAX_CELL.toLocaleString('es-ES')} caracteres).`,
        { file: ['cell_too_long'] },
      );
  }
  return data.map((r, i) => ({
    // Spreadsheet row number (header = row 1).
    rowNumber: i + 2,
    raw: Object.fromEntries(keys.flatMap((k, j) => (k ? [[k, r[j] ?? '']] : []))),
  }));
}

// ── Validation against the database ────────────────────────────────────────────

async function validate(
  ctx: RequestContext,
  entity: ImportEntity,
  recs: ReturnType<typeof toRecords>,
) {
  const out: Row[] = recs.map(({ rowNumber, raw }) => {
    const r = importRowSchemas[entity].safeParse(raw);
    const errors: Errors = {};
    if (!r.success)
      for (const i of r.error.issues) add(errors, String(i.path[0] ?? 'fila'), i.message);
    // The values as written in the file are kept for the preview (`raw`).
    return {
      rowNumber,
      data: { ...(r.success ? (r.data as Record<string, unknown>) : raw), raw },
      errors,
    };
  });
  const ok = out.filter((r) => !Object.keys(r.errors).length);
  const seen = new Map<string, number>();
  const dup = (r: Row, field: string, key: string | undefined) => {
    if (!key) return;
    if (seen.has(key)) add(r.errors, field, `Repetido en la fila ${seen.get(key)}.`);
    else seen.set(key, r.rowNumber);
  };

  if (entity === 'clients') {
    const [gs, ss] = await Promise.all([
      ctx.db.select({ id: goals.id, slug: goals.slug, name: goals.name }).from(goals),
      ctx.db.select({ id: sports.id, slug: sports.slug, name: sports.name }).from(sports),
    ]);
    const emails = ok
      .map((r) => r.data.email as string | undefined)
      .filter((e): e is string => !!e);
    const existing = new Set(
      emails.length
        ? (
            await ctx.db
              .select({ email: clients.email })
              .from(clients)
              .where(
                and(
                  eq(clients.organizationId, ctx.actor.organizationId),
                  inArray(sql`lower(${clients.email})`, emails),
                ),
              )
          ).map((c) => c.email!.toLowerCase())
        : [],
    );
    for (const r of ok) {
      const d = r.data;
      if (d.objetivo) {
        const g = lookup(gs, d.objetivo as string);
        if (g) d.goalId = g.id;
        else add(r.errors, 'objetivo', 'Objetivo desconocido en el catálogo.');
      }
      if (d.deporte) {
        const s = lookup(ss, d.deporte as string);
        if (s) d.sportId = s.id;
        else add(r.errors, 'deporte', 'Deporte desconocido en el catálogo.');
        if (!d.objetivo)
          add(r.errors, 'objetivo', 'Indica el objetivo al que se asocia el deporte.');
      }
      if (d.email && existing.has(d.email as string))
        add(r.errors, 'email', 'Ya existe un cliente con ese email.');
      dup(r, 'email', d.email as string | undefined);
      if (!d.email)
        dup(
          r,
          'nombre',
          `${norm(d.nombre as string)}|${norm(d.apellidos as string)}|${d.fecha_nacimiento}`,
        );
    }
  }

  if (entity === 'exercises') {
    const [ps, eqs, names] = await Promise.all([
      ctx.db
        .select({
          id: movementPatterns.id,
          slug: movementPatterns.slug,
          name: movementPatterns.name,
        })
        .from(movementPatterns),
      ctx.db
        .select({ id: equipment.id, slug: equipment.slug, name: equipment.name })
        .from(equipment),
      ctx.db
        .select({ name: exercises.name })
        .from(exercises)
        .where(
          or(
            isNull(exercises.organizationId),
            eq(exercises.organizationId, ctx.actor.organizationId),
          ),
        ),
    ]);
    const known = new Set(names.map((n) => norm(n.name)));
    for (const r of ok) {
      const d = r.data;
      if (d.patron) {
        const p = lookup(ps, d.patron as string);
        if (p) d.movementPatternId = p.id;
        else add(r.errors, 'patron', 'Patrón de movimiento desconocido.');
      }
      if (d.material) {
        const ids: string[] = [];
        for (const m of String(d.material)
          .split(/[|,]/)
          .map((x) => x.trim())
          .filter(Boolean)) {
          const e = lookup(eqs, m);
          if (e) ids.push(e.id);
          else add(r.errors, 'material', `Material desconocido: «${m}».`);
        }
        d.equipmentIds = ids;
      }
      if (known.has(norm(d.nombre as string)))
        add(r.errors, 'nombre', 'Ya existe un ejercicio con ese nombre.');
      dup(r, 'nombre', norm(d.nombre as string));
    }
  }

  if (entity === 'assessments') {
    const ts = await ctx.db
      .select({
        id: assessmentTests.id,
        slug: assessmentTests.slug,
        name: assessmentTests.name,
        sided: assessmentTests.sided,
      })
      .from(assessmentTests)
      .where(
        or(
          isNull(assessmentTests.organizationId),
          eq(assessmentTests.organizationId, ctx.actor.organizationId),
        ),
      );
    const emails = [...new Set(ok.map((r) => r.data.email_cliente as string))];
    // RLS: only clients the actor can see; assessments need assessments:write on each of them.
    const cs = emails.length
      ? await ctx.db
          .select({ id: clients.id, email: clients.email })
          .from(clients)
          .where(inArray(sql`lower(${clients.email})`, emails))
      : [];
    const allowed = new Map<string, string>();
    for (const c of cs) {
      try {
        await authorizeClient(ctx, 'assessments:write', c.id);
        allowed.set(c.email!.toLowerCase(), c.id);
      } catch {
        /* not assigned: reported per row */
      }
    }
    for (const r of ok) {
      const d = r.data;
      const clientId = allowed.get(d.email_cliente as string);
      if (clientId) d.clientId = clientId;
      else add(r.errors, 'email_cliente', 'Cliente no encontrado o no asignado a ti.');
      const t = lookup(ts, d.test as string);
      if (!t) add(r.errors, 'test', 'Test desconocido en el catálogo.');
      else {
        d.testId = t.id;
        if (t.sided && !d.lado)
          add(r.errors, 'lado', 'Este test se mide por lado: indica izquierdo o derecho.');
        if (!t.sided && d.lado && d.lado !== 'both')
          add(r.errors, 'lado', 'Este test no se mide por lado.');
      }
      dup(r, 'test', `${d.email_cliente}|${d.fecha}|${t?.id}|${d.lado ?? 'both'}`);
    }
  }

  if (entity === 'references') {
    const dois = ok
      .map((r) => (r.data.doi as string | undefined)?.toLowerCase())
      .filter((x): x is string => !!x);
    const pmids = ok.map((r) => r.data.pmid as string | undefined).filter((x): x is string => !!x);
    const existing =
      dois.length || pmids.length
        ? await ctx.db
            .select({ doi: evidenceSources.doi, pmid: evidenceSources.pmid })
            .from(evidenceSources)
            .where(
              and(
                or(
                  isNull(evidenceSources.organizationId),
                  eq(evidenceSources.organizationId, ctx.actor.organizationId),
                ),
                or(
                  dois.length ? inArray(sql`lower(${evidenceSources.doi})`, dois) : undefined,
                  pmids.length ? inArray(evidenceSources.pmid, pmids) : undefined,
                ),
              ),
            )
        : [];
    const doiSet = new Set(existing.map((e) => e.doi?.toLowerCase()).filter(Boolean));
    const pmidSet = new Set(existing.map((e) => e.pmid).filter(Boolean));
    for (const r of ok) {
      const d = r.data;
      const doi = (d.doi as string | undefined)?.toLowerCase();
      if (doi && doiSet.has(doi)) add(r.errors, 'doi', 'Ya existe una fuente con ese DOI.');
      if (d.pmid && pmidSet.has(d.pmid as string))
        add(r.errors, 'pmid', 'Ya existe una fuente con ese PMID.');
      dup(r, 'doi', doi);
      dup(r, 'pmid', d.pmid as string | undefined);
    }
  }
  if (entity === 'reference_values') {
    const visibleTo = (col: AnyPgColumn) => or(isNull(col), eq(col, ctx.actor.organizationId));
    const [ts, ps, ss] = await Promise.all([
      ctx.db
        .select({ id: assessmentTests.id, slug: assessmentTests.slug, name: assessmentTests.name })
        .from(assessmentTests)
        .where(visibleTo(assessmentTests.organizationId)),
      ctx.db
        .select({ id: populations.id, slug: populations.slug, name: populations.name })
        .from(populations)
        .where(visibleTo(populations.organizationId)),
      ctx.db.select({ id: sports.id, slug: sports.slug, name: sports.name }).from(sports),
    ]);
    const dois = ok.map((r) => r.data.fuente_doi as string | undefined).filter(Boolean);
    const pmids = ok.map((r) => r.data.fuente_pmid as string | undefined).filter(Boolean);
    const srcs =
      dois.length || pmids.length
        ? await ctx.db
            .select({
              id: evidenceSources.id,
              doi: evidenceSources.doi,
              pmid: evidenceSources.pmid,
            })
            .from(evidenceSources)
            .where(
              and(
                visibleTo(evidenceSources.organizationId),
                or(
                  dois.length
                    ? inArray(sql`lower(${evidenceSources.doi})`, dois as string[])
                    : undefined,
                  pmids.length ? inArray(evidenceSources.pmid, pmids as string[]) : undefined,
                ),
              ),
            )
        : [];
    // The centre's own rows, to refuse the same group twice (re-importing the same file).
    const mine = await ctx.db
      .select()
      .from(referenceValues)
      .where(eq(referenceValues.organizationId, ctx.actor.organizationId));
    const groupKey = (x: {
      testId: string;
      variable: string;
      populationId: string;
      sex: string | null;
      ageMin: number | null;
      ageMax: number | null;
      sourceId: string;
    }) =>
      [
        x.testId,
        norm(x.variable),
        x.populationId,
        x.sex ?? 'mixed',
        x.ageMin,
        x.ageMax,
        x.sourceId,
      ].join('|');
    const existing = new Set(mine.map(groupKey));
    for (const r of ok) {
      const d = r.data;
      const t = lookup(ts, d.test as string);
      if (!t) add(r.errors, 'test', 'Test desconocido en el catálogo.');
      else d.testId = t.id;
      const pop = lookup(ps, d.poblacion as string);
      if (!pop) add(r.errors, 'poblacion', 'Población desconocida en el catálogo.');
      else d.populationId = pop.id;
      if (d.deporte) {
        const sp = lookup(ss, d.deporte as string);
        if (!sp) add(r.errors, 'deporte', 'Deporte desconocido.');
        else d.sportSlug = sp.slug;
      }
      const src =
        srcs.find((x) => d.fuente_doi && x.doi?.toLowerCase() === d.fuente_doi) ??
        srcs.find((x) => d.fuente_pmid && x.pmid === d.fuente_pmid);
      if (!src)
        add(
          r.errors,
          d.fuente_doi ? 'fuente_doi' : 'fuente_pmid',
          'Fuente no registrada: añádela antes en Ciencia o con la importación de referencias.',
        );
      else d.sourceId = src.id;
      if (t && pop && src) {
        const key = groupKey({
          testId: t.id,
          variable: d.variable as string,
          populationId: pop.id,
          sex: (d.sexo as string | undefined) ?? null,
          ageMin: (d.edad_min as number | undefined) ?? null,
          ageMax: (d.edad_max as number | undefined) ?? null,
          sourceId: src.id,
        });
        if (existing.has(key))
          add(r.errors, 'variable', 'El centro ya tiene esta referencia (mismo grupo y fuente).');
        dup(r, 'variable', key);
      }
    }
  }
  return out;
}

// ── Use cases ─────────────────────────────────────────────────────────────────

const LABEL: Record<ImportEntity, string> = {
  clients: 'clientes',
  exercises: 'ejercicios',
  assessments: 'evaluaciones',
  references: 'referencias',
  reference_values: 'valores de referencia',
};

function requireEntityPermission(ctx: RequestContext, entity: ImportEntity) {
  requirePermission(ctx, 'data:import');
  if (entity === 'clients') requirePermission(ctx, 'clients:create');
  if (entity === 'exercises') requirePermission(ctx, 'library:write');
  if (entity === 'assessments') requirePermission(ctx, 'assessments:write');
  if (entity === 'references') requirePermission(ctx, 'science:write');
  // Centre norms change comparisons for every client: publishing them is ADMIN's (phase 18).
  if (entity === 'reference_values') requirePermission(ctx, 'science:publish');
}

async function createImportJob_(ctx: RequestContext, input: unknown) {
  const d = parse(createImportSchema, input);
  requireEntityPermission(ctx, d.entity);
  const rows = await validate(
    ctx,
    d.entity,
    toRecords(d.entity, await readRows(d.fileName, d.contentBase64)),
  );
  const valid = rows.filter((r) => !Object.keys(r.errors).length).length;
  const [job] = await ctx.db
    .insert(importJobs)
    .values({
      organizationId: ctx.actor.organizationId,
      entity: d.entity,
      fileName: d.fileName,
      status: 'pending',
      totalRows: rows.length,
      validRows: valid,
      createdBy: ctx.actor.userId,
    })
    .returning({ id: importJobs.id });
  if (rows.length)
    await ctx.db.insert(importRows).values(
      rows.map((r) => ({
        organizationId: ctx.actor.organizationId,
        jobId: job!.id,
        rowNumber: r.rowNumber,
        data: r.data,
        errors: Object.keys(r.errors).length ? r.errors : null,
        status: Object.keys(r.errors).length ? ('invalid' as const) : ('valid' as const),
      })),
    );
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'import_job',
    entityId: job!.id,
    changes: { entity: d.entity, file: d.fileName, rows: rows.length, valid },
  });
  return { id: job!.id, total: rows.length, valid, invalid: rows.length - valid };
}

async function jobOf(ctx: RequestContext, id: string) {
  requirePermission(ctx, 'data:import');
  const [job] = await ctx.db.select().from(importJobs).where(eq(importJobs.id, id));
  if (!job) throw new DomainError('not_found', 'Importación no encontrada.');
  return job;
}

async function getImportJob_(ctx: RequestContext, id: string) {
  const job = await jobOf(ctx, id);
  const rows = await ctx.db
    .select()
    .from(importRows)
    .where(eq(importRows.jobId, id))
    .orderBy(asc(importRows.rowNumber));
  return {
    id: job.id,
    entity: job.entity as ImportEntity,
    fileName: job.fileName,
    status: job.status,
    total: job.totalRows ?? rows.length,
    valid: job.validRows ?? 0,
    createdAt: job.createdAt,
    columns: IMPORT_COLUMNS[job.entity as ImportEntity],
    rows: rows.map((r) => ({
      rowNumber: r.rowNumber,
      status: r.status,
      data: r.data as Record<string, unknown>,
      errors: (r.errors as Errors | null) ?? {},
      createdEntityId: r.createdEntityId,
    })),
  };
}
export type ImportJobView = Awaited<ReturnType<typeof getImportJob_>>;

async function listImportJobs_(ctx: RequestContext) {
  requirePermission(ctx, 'data:import');
  return ctx.db
    .select({
      id: importJobs.id,
      entity: importJobs.entity,
      fileName: importJobs.fileName,
      status: importJobs.status,
      total: importJobs.totalRows,
      valid: importJobs.validRows,
      createdAt: importJobs.createdAt,
    })
    .from(importJobs)
    .orderBy(desc(importJobs.createdAt))
    .limit(30);
}

/** Imports one valid row through the regular use case; returns the created entity id. */
async function importRow(
  ctx: RequestContext,
  entity: ImportEntity,
  d: Record<string, unknown>,
  fileName: string,
) {
  if (entity === 'clients') {
    const r = await createClient(ctx, {
      basics: {
        firstName: d.nombre,
        lastName: d.apellidos,
        birthDate: d.fecha_nacimiento,
        sex: d.sexo ?? 'undisclosed',
        email: d.email ?? null,
        phone: d.telefono ?? null,
        modality: d.modalidad ?? 'in_person',
      },
      profile: {
        experienceLevel: d.experiencia ?? 'none',
        sessionsPerWeek: d.sesiones_semana ?? null,
      },
      goals: d.goalId
        ? [{ goalId: d.goalId, isPrimary: true, priorityWeight: 1, sportId: d.sportId ?? null }]
        : [],
    });
    return r.id;
  }
  if (entity === 'exercises') {
    const r = await createExercise(
      ctx,
      {
        name: d.nombre,
        movementPatternId: d.movementPatternId ?? null,
        level: d.nivel ?? null,
        bodyRegion: d.region ?? null,
        clientDescription: d.descripcion_cliente ?? null,
        trainerDescription: d.descripcion_entrenador ?? null,
        equipment: ((d.equipmentIds as string[] | undefined) ?? []).map((equipmentId) => ({
          equipmentId,
          optional: false,
        })),
      },
      {
        source: 'import',
        sourceRef: fileName,
        needsReview: true,
        reviewNotes: `Importado desde ${fileName}: revisar antes de publicar.`,
      },
    );
    return r.id;
  }
  if (entity === 'references') {
    const r = await createSource(ctx, {
      title: d.titulo,
      authors: d.autores ?? [],
      year: d.anio ?? null,
      journal: d.revista ?? null,
      doi: d.doi ?? null,
      pmid: d.pmid ?? null,
      url: d.url ?? null,
      studyDesign: d.diseno ?? 'expert_opinion',
    });
    return r.id;
  }
  if (entity === 'reference_values') return insertReferenceValue(ctx, d);
  throw new Error('assessments are imported by group');
}

async function confirmImportJob_(ctx: RequestContext, id: string) {
  const job = await jobOf(ctx, id);
  const entity = job.entity as ImportEntity;
  requireEntityPermission(ctx, entity);
  if (job.status !== 'pending')
    throw new DomainError('conflict', 'Esta importación ya se confirmó o se canceló.');
  const rows = await ctx.db
    .select()
    .from(importRows)
    .where(and(eq(importRows.jobId, id), eq(importRows.status, 'valid')))
    .orderBy(asc(importRows.rowNumber));
  const fileName = job.fileName ?? 'archivo';
  let imported = 0;
  const failed: { rowNumber: number; message: string }[] = [];
  const mark = async (
    rowIds: string[],
    status: 'imported' | 'invalid',
    entityId: string | null,
    message?: string,
  ) =>
    ctx.db
      .update(importRows)
      .set({
        status,
        createdEntityId: entityId,
        ...(message ? { errors: { fila: [message] } } : {}),
      })
      .where(inArray(importRows.id, rowIds));

  if (entity === 'assessments') {
    // One assessment per client, date and context; one result per row.
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const d = r.data as Record<string, unknown>;
      const k = `${d.clientId}|${d.fecha}|${d.contexto ?? ''}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const g of groups.values()) {
      const d0 = g[0]!.data as Record<string, unknown>;
      try {
        const aid = await withSavepoint(ctx, async (inner) => {
          const { id: assessmentId } = await createAssessment(inner, d0.clientId as string, {
            assessedOn: d0.fecha,
            testIds: [
              ...new Set(g.map((r) => (r.data as Record<string, unknown>).testId as string)),
            ],
            context: (d0.contexto as string | undefined) ?? `Importado desde ${fileName}`,
          });
          for (const r of g) {
            const d = r.data as Record<string, unknown>;
            await recordAssessmentResult(inner, assessmentId, {
              testId: d.testId,
              side: d.lado ?? 'both',
              attempts: d.valor,
              notes: `Importado desde ${fileName}`,
            });
          }
          return assessmentId;
        });
        await mark(
          g.map((r) => r.id),
          'imported',
          aid,
        );
        imported += g.length;
      } catch (e) {
        const message = e instanceof DomainError ? e.message : 'Error inesperado.';
        await mark(
          g.map((r) => r.id),
          'invalid',
          null,
          message,
        );
        for (const r of g) failed.push({ rowNumber: r.rowNumber, message });
      }
    }
  } else {
    for (const r of rows) {
      try {
        const entityId = await withSavepoint(ctx, (inner) =>
          importRow(inner, entity, r.data as Record<string, unknown>, fileName),
        );
        await mark([r.id], 'imported', entityId);
        imported++;
      } catch (e) {
        const message = e instanceof DomainError ? e.message : 'Error inesperado.';
        await mark([r.id], 'invalid', null, message);
        failed.push({ rowNumber: r.rowNumber, message });
      }
    }
  }
  await ctx.db
    .update(importJobs)
    .set({ status: 'succeeded', validRows: imported })
    .where(eq(importJobs.id, id));
  await writeAudit(ctx.db, ctx, {
    action: 'update',
    entityType: 'import_job',
    entityId: id,
    changes: [{ field: 'status', before: 'pending', after: 'succeeded' }],
    reason: `Importados ${imported} ${LABEL[entity]}${failed.length ? `; ${failed.length} filas con error` : ''}`,
  });
  return { imported, failed };
}

async function cancelImportJob_(ctx: RequestContext, id: string) {
  const job = await jobOf(ctx, id);
  if (job.status !== 'pending')
    throw new DomainError('conflict', 'Esta importación ya se confirmó o se canceló.');
  await ctx.db.update(importJobs).set({ status: 'cancelled' }).where(eq(importJobs.id, id));
  await ctx.db.update(importRows).set({ status: 'skipped' }).where(eq(importRows.jobId, id));
}

/** Template with the columns, an example row and a help row (CSV or XLSX). */
export async function importTemplate(
  entity: ImportEntity,
  format: 'csv' | 'xlsx',
): Promise<FileOut> {
  const cols = IMPORT_COLUMNS[entity];
  const rows = [cols.map((c) => c.header), cols.map((c) => c.example)];
  const name = `plantilla-${LABEL[entity]}`;
  if (format === 'csv')
    return {
      fileName: `${name}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(toCsv(rows), 'utf8'),
    };
  return {
    fileName: `${name}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: await toXlsx(
      [
        { name: LABEL[entity], rows, bold: [0] },
        {
          name: 'Ayuda',
          rows: [
            ['Columna', 'Obligatoria', 'Formato'],
            ...cols.map((c) => [c.header, c.required ? 'sí' : 'no', c.help]),
          ],
          bold: [0],
        },
      ],
      new Date('2026-01-01T00:00:00Z'),
    ),
  };
}

export const createImportJob = secured(createImportJob_);
export const getImportJob = secured(getImportJob_);
export const listImportJobs = secured(listImportJobs_);
export const confirmImportJob = secured(confirmImportJob_);
export const cancelImportJob = secured(cancelImportJob_);

/** Template download for the import page (same permission as importing). */
export const downloadImportTemplate = secured(
  async (ctx: RequestContext, entity: string, format: string): Promise<FileOut> => {
    requirePermission(ctx, 'data:import');
    if (!(entity in IMPORT_COLUMNS) || (format !== 'csv' && format !== 'xlsx'))
      throw new DomainError('validation', 'Plantilla no disponible.', { entity: ['unknown'] });
    return importTemplate(entity as ImportEntity, format);
  },
);
