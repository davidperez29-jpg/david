import 'server-only';
import {
  canonicalJson,
  normalizeContent,
  type SessionContent,
  type TrainingSession,
} from '@/domain/training/session-v2';
import { type SqlDatabase } from '../../db/sqlite.ts';
import { type DateRange, type TrainingRepository } from '../ports';
import {
  type SessionLogRow,
  type SessionRow,
  type SetLogRow,
  toSession,
  toSessionLog,
  toSetLog,
  toVersion,
  type VersionRow,
} from './rows';

/**
 * Prescripción v2 en SQLite. Cada escritura es una transacción `BEGIN IMMEDIATE`: las
 * comprobaciones (revisión esperada, estado) y los cambios ocurren sin que otra petición
 * pueda colarse en medio.
 */
export function createSqliteTraining(db: SqlDatabase): TrainingRepository {
  const sessionById = (id: string) =>
    db.prepare('SELECT * FROM session WHERE id = @id').get<SessionRow>({ id });
  const versionOf = (sessionId: string, number: number) =>
    db
      .prepare('SELECT * FROM session_version WHERE session_id = @sessionId AND number = @number')
      .get<VersionRow>({ sessionId, number });
  const contentJson = (content: SessionContent) => canonicalJson(normalizeContent(content));

  return {
    getSession: async (id) => {
      const row = sessionById(id);
      return row ? toSession(row) : null;
    },

    listSessions: async (clientId, range?: DateRange) => {
      const rows = range
        ? db
            .prepare(
              `SELECT * FROM session WHERE client_id = @clientId AND planned_date BETWEEN @from AND @to
               ORDER BY planned_date, day_order, created_at, id`,
            )
            .all<SessionRow>({ clientId, from: range.from, to: range.to })
        : db
            .prepare(
              'SELECT * FROM session WHERE client_id = @clientId ORDER BY planned_date, day_order, created_at, id',
            )
            .all<SessionRow>({ clientId });
      return rows.map(toSession);
    },

    createDraft: async (session: TrainingSession) =>
      db.transaction(() => {
        if (sessionById(session.id)) return 'exists';
        if (!session.draft) throw new Error('Un borrador nuevo necesita contenido.');
        db.prepare(
          `INSERT INTO session (id, client_id, trainer_id, planned_date, day_order, label, status,
             current_version, draft_content, draft_base_version, draft_revision, created_at, updated_at)
           VALUES (@id, @clientId, @trainerId, @plannedDate, @dayOrder, @label, 'draft',
             NULL, @draft, NULL, 0, @createdAt, @updatedAt)`,
        ).run({
          id: session.id,
          clientId: session.clientId,
          trainerId: session.trainerId,
          plannedDate: session.plannedDate,
          dayOrder: session.dayOrder,
          label: session.label ?? null,
          draft: contentJson(session.draft),
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        });
        return 'created';
      }),

    saveDraft: async ({ sessionId, expectedRevision, content, updatedAt }) =>
      db.transaction(() => {
        const row = sessionById(sessionId);
        if (!row) return { result: 'not_found' };
        if (row.draft_content === null) return { result: 'no_draft' };
        const json = contentJson(content);
        if (row.draft_revision !== expectedRevision) {
          return json === canonicalJson(JSON.parse(row.draft_content))
            ? { result: 'unchanged', revision: row.draft_revision }
            : { result: 'conflict', revision: row.draft_revision };
        }
        const revision = row.draft_revision + 1;
        // Mientras no se haya publicado nunca, la fecha y el orden visibles son los del borrador.
        const unpublished = row.status === 'draft';
        db.prepare(
          `UPDATE session SET draft_content = @json, draft_revision = @revision, updated_at = @updatedAt,
             planned_date = CASE WHEN @unpublished = 1 THEN @plannedDate ELSE planned_date END,
             day_order = CASE WHEN @unpublished = 1 THEN @dayOrder ELSE day_order END,
             label = CASE WHEN @unpublished = 1 THEN @label ELSE label END
           WHERE id = @id`,
        ).run({
          id: sessionId,
          json,
          revision,
          updatedAt,
          unpublished: unpublished ? 1 : 0,
          plannedDate: content.plannedDate,
          dayOrder: content.dayOrder,
          label: content.label?.trim() || null,
        });
        return { result: 'saved', revision };
      }),

    deleteDraft: async (sessionId) =>
      db.transaction(() => {
        const row = sessionById(sessionId);
        if (!row) return 'not_found';
        if (row.status !== 'draft') return 'not_deletable';
        db.prepare("DELETE FROM session WHERE id = @id AND status = 'draft'").run({
          id: sessionId,
        });
        return 'deleted';
      }),

    startChangeDraft: async (sessionId, updatedAt) =>
      db.transaction(() => {
        const row = sessionById(sessionId);
        if (!row) return 'not_found';
        if (row.status !== 'published' || row.current_version === null) return 'not_published';
        if (row.draft_content !== null) return 'exists';
        const version = versionOf(sessionId, row.current_version)!;
        db.prepare(
          `UPDATE session SET draft_content = @content, draft_base_version = @base,
             draft_revision = draft_revision + 1, updated_at = @updatedAt WHERE id = @id`,
        ).run({ id: sessionId, content: version.content, base: row.current_version, updatedAt });
        return 'started';
      }),

    discardChangeDraft: async (sessionId, updatedAt) =>
      db.transaction(() => {
        const row = sessionById(sessionId);
        if (!row || row.status !== 'published' || row.draft_content === null) return 'not_found';
        db.prepare(
          `UPDATE session SET draft_content = NULL, draft_base_version = NULL,
             draft_revision = draft_revision + 1, updated_at = @updatedAt WHERE id = @id`,
        ).run({ id: sessionId, updatedAt });
        return 'discarded';
      }),

    publish: async (input) =>
      db.transaction(() => {
        const row = sessionById(input.sessionId);
        if (!row) return { result: 'not_found' };
        const json = contentJson(input.content);
        if (row.draft_content === null) {
          // ¿Es un reintento de una publicación ya hecha con este mismo contenido?
          if (row.current_version !== null) {
            const current = versionOf(input.sessionId, row.current_version)!;
            if (canonicalJson(JSON.parse(current.content)) === json) {
              return { result: 'already_published', version: toVersion(current) };
            }
          }
          return { result: 'no_draft' };
        }
        if (row.draft_revision !== input.expectedRevision) {
          return { result: 'conflict', revision: row.draft_revision };
        }
        const number = (row.current_version ?? 0) + 1;
        db.prepare(
          `INSERT INTO session_version (id, session_id, number, content, published_at, published_by,
             reason, changes, execution_state)
           VALUES (@id, @sessionId, @number, @content, @publishedAt, @publishedBy, @reason, @changes, @state)`,
        ).run({
          id: input.versionId,
          sessionId: input.sessionId,
          number,
          content: json,
          publishedAt: input.publishedAt,
          publishedBy: input.publishedBy,
          reason: input.reason?.trim() || null,
          changes: input.changes ? JSON.stringify(input.changes) : null,
          state: input.executionState,
        });
        db.prepare(
          `UPDATE session SET status = 'published', current_version = @number, draft_content = NULL,
             draft_base_version = NULL, draft_revision = draft_revision + 1, updated_at = @publishedAt,
             planned_date = @plannedDate, day_order = @dayOrder, label = @label
           WHERE id = @id`,
        ).run({
          id: input.sessionId,
          number,
          publishedAt: input.publishedAt,
          plannedDate: input.content.plannedDate,
          dayOrder: input.content.dayOrder,
          label: input.content.label?.trim() || null,
        });
        return { result: 'published', version: toVersion(versionOf(input.sessionId, number)!) };
      }),

    getVersion: async (sessionId, number) => {
      const row = versionOf(sessionId, number);
      return row ? toVersion(row) : null;
    },

    listVersions: async (sessionId) =>
      db
        .prepare('SELECT * FROM session_version WHERE session_id = @sessionId ORDER BY number')
        .all<VersionRow>({ sessionId })
        .map(toVersion),

    getExecution: async (sessionId) => {
      const log = db
        .prepare('SELECT * FROM session_log WHERE session_id = @sessionId')
        .get<SessionLogRow>({ sessionId });
      if (!log) return null;
      const sets = db
        .prepare(
          'SELECT * FROM set_log WHERE session_log_id = @id ORDER BY prescription_id, set_number, received_at, client_set_id',
        )
        .all<SetLogRow>({ id: log.id });
      return { log: toSessionLog(log), setLogs: sets.map(toSetLog) };
    },
  };
}
