/**
 * Specific searches (restructure phase 9, docs/SCIENCE_SYSTEM.md §4): every module is built from
 * searches by objective, population, injury, phase, method, test or criterion, and each one is
 * logged with its query, date, what was reviewed and what was selected.
 */
import { scienceSearchSchema } from '@tp/contracts';
import { schema } from '@tp/db';
import { DomainError } from '@tp/domain';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { writeAudit } from './audit';
import { requirePermission } from './authz';
import type { RequestContext } from './context';
import { citeShort } from './evidence-cards';
import { secured } from './rls';
import { parse } from './validation';

const { scienceSearches, evidenceSources } = schema;

async function listScienceSearches_(ctx: RequestContext, query: { topic?: string } = {}) {
  requirePermission(ctx, 'science:read');
  const visible = or(
    isNull(scienceSearches.organizationId),
    eq(scienceSearches.organizationId, ctx.actor.organizationId),
  );
  const rows = await ctx.db
    .select()
    .from(scienceSearches)
    .where(query.topic ? and(visible, eq(scienceSearches.topic, query.topic)) : visible)
    .orderBy(desc(scienceSearches.searchedOn), scienceSearches.topic, scienceSearches.searchKey);
  const ids = [...new Set(rows.flatMap((r) => r.selectedSourceIds))];
  const srcs = ids.length
    ? await ctx.db
        .select({
          id: evidenceSources.id,
          authors: evidenceSources.authors,
          year: evidenceSources.year,
        })
        .from(evidenceSources)
        .where(inArray(evidenceSources.id, ids))
    : [];
  const cite = new Map(srcs.map((s) => [s.id, citeShort(s)]));
  return {
    topics: [...new Set(rows.map((r) => r.topic))].sort(),
    items: rows.map((r) => ({
      id: r.id,
      topic: r.topic,
      objective: r.objective,
      population: r.population,
      injury: r.injury,
      phase: r.phase,
      method: r.method,
      test: r.test,
      criterion: r.criterion,
      query: r.query,
      database: r.database,
      searchedOn: r.searchedOn,
      reviewed: r.reviewed,
      selected: r.selectedSourceIds.map((id) => ({ id, citation: cite.get(id) ?? '—' })),
      reason: r.reason,
      isGlobal: r.organizationId === null,
    })),
  };
}

/** The centre logs its own search (ADMIN or trainer with science:write). */
async function createScienceSearch_(ctx: RequestContext, input: unknown) {
  const d = parse(scienceSearchSchema, input);
  requirePermission(ctx, 'science:write', { organizationId: ctx.actor.organizationId });
  if (d.selectedSourceIds.length) {
    const found = await ctx.db
      .select({ id: evidenceSources.id })
      .from(evidenceSources)
      .where(
        and(
          inArray(evidenceSources.id, d.selectedSourceIds),
          or(
            isNull(evidenceSources.organizationId),
            eq(evidenceSources.organizationId, ctx.actor.organizationId),
          ),
        ),
      );
    if (found.length !== new Set(d.selectedSourceIds).size)
      throw new DomainError('validation', 'Alguna fuente seleccionada no existe.', {
        selectedSourceIds: ['unknown'],
      });
  }
  const [row] = await ctx.db
    .insert(scienceSearches)
    .values({
      organizationId: ctx.actor.organizationId,
      topic: d.topic,
      objective: d.objective,
      population: d.population ?? null,
      injury: d.injury ?? null,
      phase: d.phase ?? null,
      method: d.method ?? null,
      test: d.test ?? null,
      criterion: d.criterion ?? null,
      query: d.query,
      database: d.database,
      searchedOn: d.searchedOn,
      reviewed: d.reviewed ?? null,
      selectedSourceIds: [...new Set(d.selectedSourceIds)],
      reason: d.reason ?? null,
      createdBy: ctx.actor.userId,
    })
    .returning({ id: scienceSearches.id });
  await writeAudit(ctx.db, ctx, {
    action: 'create',
    entityType: 'science_search',
    entityId: row!.id,
    changes: { topic: d.topic },
  });
  return { id: row!.id };
}

export const listScienceSearches = secured(listScienceSearches_);
export const createScienceSearch = secured(createScienceSearch_);
