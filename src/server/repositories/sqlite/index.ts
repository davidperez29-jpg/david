import 'server-only';
import { type Client, type Trainer } from '@/domain/people';
import { addDays, localDateOf } from '@/domain/time';
import { toLegacyLog, toLegacySession } from '@/domain/training/compat';
import { type PlannedSession, type SessionLog } from '@/domain/training/session';
import { type SqlDatabase } from '../../db/sqlite.ts';
import { createDemoRepositories } from '../demo';
import { type DemoDataset } from '../demo/dataset';
import { type DateRange, type Repositories } from '../ports';
import { parseContent, type SessionLogRow, type SetLogRow, toSessionLog, toSetLog } from './rows';
import { createSqliteExecution } from './execution';
import { createSqliteTraining } from './training';

interface ClientRow {
  id: string;
  trainer_id: string;
  display_name: string;
  status: Client['status'];
  population: Client['population'];
  goal: string;
  sport: string | null;
  started_on: string;
}

const toClient = (row: ClientRow): Client => ({
  id: row.id,
  trainerId: row.trainer_id,
  displayName: row.display_name,
  status: row.status,
  population: row.population,
  goal: row.goal,
  ...(row.sport ? { sport: row.sport } : {}),
  startedOn: row.started_on,
});

interface PublishedRow {
  id: string;
  client_id: string;
  content: string;
}

/**
 * Repositorios sobre SQLite.
 * - Lo que V1 escribe o referencia (entrenadores, clientes, sesiones, versiones y ejecución)
 *   está en la base.
 * - Los datos de referencia de solo lectura (biblioteca, objetivos, evaluaciones, readaptación,
 *   compartición) siguen en el código hasta su fase, generados con la fecha de la semilla.
 * - Las pantallas existentes leen sesiones y registros con la capa de compatibilidad: solo
 *   ven sesiones publicadas, en su versión vigente.
 */
export function createSqliteRepositories(db: SqlDatabase, reference: DemoDataset): Repositories {
  const readOnly = createDemoRepositories(reference);
  const training = createSqliteTraining(db);

  const published = (where: string, params: Record<string, string>) =>
    db
      .prepare(
        `SELECT s.id, s.client_id, v.content FROM session s
         JOIN session_version v ON v.session_id = s.id AND v.number = s.current_version
         WHERE s.status = 'published' AND ${where}
         ORDER BY s.planned_date, s.day_order, s.created_at, s.id`,
      )
      .all<PublishedRow>(params)
      .map((row) =>
        toLegacySession({ id: row.id, clientId: row.client_id }, parseContent(row.content)),
      );

  function legacyLogs(clientId: string, range: DateRange): SessionLog[] {
    // Registros de las sesiones previstas en el rango y de las ejecutadas en el rango (P-89).
    const rows = db
      .prepare(
        `SELECT l.*, s.planned_date AS planned_date FROM session_log l
         JOIN session s ON s.id = l.session_id
         WHERE l.client_id = @clientId AND s.status = 'published'
           AND ((s.planned_date BETWEEN @from AND @to)
             OR (l.started_at >= @fromInstant AND l.started_at < @toInstant))`,
      )
      .all<SessionLogRow & { planned_date: string }>({
        clientId,
        from: range.from,
        to: range.to,
        fromInstant: `${addDays(range.from, -1)}T00:00:00.000Z`,
        toInstant: `${addDays(range.to, 2)}T00:00:00.000Z`,
      });
    const sessions = new Map(
      published('s.client_id = @clientId', { clientId }).map((s) => [s.id, s] as const),
    );
    const setsOf = db.prepare(
      'SELECT * FROM set_log WHERE session_log_id = @id ORDER BY received_at',
    );
    return rows.flatMap((row) => {
      const log = toSessionLog(row);
      const executedOn = localDateOf(log.startedAt, log.startTimeZone);
      const plannedIn = row.planned_date >= range.from && row.planned_date <= range.to;
      const executedIn = executedOn >= range.from && executedOn <= range.to;
      const session: PlannedSession | undefined = sessions.get(row.session_id);
      if (!session || !(plannedIn || executedIn)) return [];
      return [toLegacyLog(session, log, setsOf.all<SetLogRow>({ id: row.id }).map(toSetLog))];
    });
  }

  return {
    ...readOnly,
    trainers: {
      getById: async (id) => {
        const row = db
          .prepare('SELECT id, display_name FROM trainer WHERE id = @id')
          .get<{ id: string; display_name: string }>({ id });
        return row ? ({ id: row.id, displayName: row.display_name } satisfies Trainer) : null;
      },
    },
    clients: {
      listByTrainer: async (trainerId) =>
        db
          .prepare('SELECT * FROM client WHERE trainer_id = @trainerId ORDER BY created_at, id')
          .all<ClientRow>({ trainerId })
          .map(toClient),
      getById: async (id) => {
        const row = db.prepare('SELECT * FROM client WHERE id = @id').get<ClientRow>({ id });
        return row ? toClient(row) : null;
      },
    },
    sessions: {
      listByClient: async (clientId, range) =>
        published('s.client_id = @clientId AND s.planned_date BETWEEN @from AND @to', {
          clientId,
          from: range.from,
          to: range.to,
        }),
      getById: async (id) => published('s.id = @id', { id })[0] ?? null,
    },
    logs: {
      listByClient: async (clientId, range) => legacyLogs(clientId, range),
    },
    training,
    execution: createSqliteExecution(db),
  };
}
