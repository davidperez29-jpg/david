import 'server-only';
import { addDays, type IsoDate, utcOffsetMinutes } from '@/domain/time';
import { fromLegacySession } from '@/domain/training/compat';
import { normalizeContent, canonicalJson, resolveSets } from '@/domain/training/session-v2';
import { effectiveSetRecords, plannedSetCount } from '@/domain/training/session';
import { type DemoDataset } from '../repositories/demo/dataset';
import { type SqlDatabase } from './sqlite.ts';

/** Versión de la semilla: cambia si cambia lo que se siembra (se guarda en `meta`). */
export const SEED_VERSION = '2';

const at = (instant: string, seconds: number) =>
  new Date(Date.parse(instant) + seconds * 1000).toISOString();

/**
 * Siembra una base vacía con los datos ficticios de la demostración, ya en el modelo v2:
 * - sesiones de la Fase 1 publicadas como versión 1 de su entrenador;
 * - registros como `session_log` y `set_log` (series efectivas: el reenvío duplicado de la
 *   semilla no se guarda, como haría la idempotencia) con el RIR o RPE en cada serie (P-84);
 * - las series no hechas quedan pendientes (sin registro).
 * Todo en una sola transacción.
 */
export function seedDatabase(
  db: SqlDatabase,
  data: DemoDataset,
  options: { seedDate: IsoDate; timeZone: string; now: string },
): void {
  const variantName = new Map(data.library.variants.map((v) => [v.id, v.name]));
  db.transaction(() => {
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (@key, @value)');
    meta.run({ key: 'seed_date', value: options.seedDate });
    meta.run({ key: 'seed_version', value: SEED_VERSION });
    meta.run({ key: 'seeded_at', value: options.now });
    meta.run({ key: 'time_zone', value: options.timeZone });

    const trainer = db.prepare('INSERT INTO trainer (id, display_name) VALUES (@id, @name)');
    for (const t of data.trainers) trainer.run({ id: t.id, name: t.displayName });

    const client = db.prepare(
      `INSERT INTO client (id, trainer_id, display_name, status, population, goal, sport, started_on, created_at)
       VALUES (@id, @trainerId, @name, @status, @population, @goal, @sport, @startedOn, @createdAt)`,
    );
    data.clients.forEach((c, index) =>
      client.run({
        id: c.id,
        trainerId: c.trainerId,
        name: c.displayName,
        status: c.status,
        population: c.population,
        goal: c.goal,
        sport: c.sport ?? null,
        startedOn: c.startedOn,
        // Alta en el momento de sembrar, un instante distinto por cliente: el orden de alta
        // (el de las listas) conserva el de la demostración.
        createdAt: at(options.now, index / 1000),
      }),
    );

    const trainerOf = new Map(data.clients.map((c) => [c.id, c.trainerId]));
    const insertSession = db.prepare(
      `INSERT INTO session (id, client_id, trainer_id, planned_date, day_order, label, status,
         current_version, draft_content, draft_base_version, draft_revision, created_at, updated_at)
       VALUES (@id, @clientId, @trainerId, @plannedDate, @dayOrder, @label, 'published', 1, NULL, NULL, 1, @at, @at)`,
    );
    const insertVersion = db.prepare(
      `INSERT INTO session_version (id, session_id, number, content, published_at, published_by, execution_state)
       VALUES (@id, @sessionId, 1, @content, @at, @by, 'not_started')`,
    );
    for (const session of data.sessions) {
      const content = normalizeContent(fromLegacySession(session, (id) => variantName.get(id)));
      const trainerId = trainerOf.get(session.clientId)!;
      // Publicada (ficticiamente) dos días antes de su fecha, y nunca después de la siembra.
      const publishedOn = session.date < options.seedDate ? session.date : options.seedDate;
      const publishedAt = `${addDays(publishedOn, -2)}T08:00:00.000Z`;
      insertSession.run({
        id: session.id,
        clientId: session.clientId,
        trainerId,
        plannedDate: content.plannedDate,
        dayOrder: content.dayOrder,
        label: content.label ?? null,
        at: publishedAt,
      });
      insertVersion.run({
        id: `ver-${session.id}-1`,
        sessionId: session.id,
        content: canonicalJson(content),
        at: publishedAt,
        by: trainerId,
      });
    }

    const sessions = new Map(data.sessions.map((s) => [s.id, s]));
    const insertLog = db.prepare(
      `INSERT INTO session_log (id, session_id, client_id, started_version, started_at, start_device_at,
         start_time_zone, start_utc_offset_min, start_received_at, last_activity_at, finished_at,
         finish_device_at, finish_received_at, finish_reason, pending_sets_confirmed, perceived_effort,
         comment)
       VALUES (@id, @sessionId, @clientId, 1, @startedAt, @startedAt, @tz, @offset, @startedAt,
         @lastActivity, @finishedAt, @finishedAt, @finishedAt, @finishReason, @pending, @effort,
         @comment)`,
    );
    const insertSet = db.prepare(
      `INSERT INTO set_log (client_set_id, session_log_id, session_id, client_id, version_number,
         prescription_id, variant_id, set_number, role, completed, reps, duration_s, distance_m,
         load_kind, load_kg, load_descriptor, rir, rpe, rpe_scale, performed_at, device_recorded_at,
         device_time_zone, device_utc_offset_min, received_at, clock_adjusted)
       VALUES (@id, @logId, @sessionId, @clientId, 1, @rx, @variant, @setNumber, 'working', 1, @reps,
         @duration, @distance, @loadKind, @loadKg, @loadDescriptor, @rir, @rpe, @rpeScale, @at, @at,
         @tz, @offset, @at, 0)`,
    );
    for (const log of data.logs) {
      const session = sessions.get(log.sessionId)!;
      const startedAt = log.startedAt ?? `${log.date}T18:00:00.000Z`;
      const done = effectiveSetRecords(session, log.sets).filter((s) => s.completed);
      const setTimes = done.map((_, index) => at(startedAt, (index + 1) * 150));
      const lastActivity = log.finishedAt ?? setTimes.at(-1) ?? startedAt;
      insertLog.run({
        id: log.id,
        sessionId: log.sessionId,
        clientId: log.clientId,
        startedAt,
        tz: options.timeZone,
        offset: utcOffsetMinutes(startedAt, options.timeZone),
        lastActivity,
        finishedAt: log.finishedAt ?? null,
        finishReason: log.finishedAt
          ? done.length === plannedSetCount(session)
            ? 'all_done'
            : 'ended_early'
          : null,
        pending: log.finishedAt ? plannedSetCount(session) - done.length : null,
        effort: log.perceivedEffort ?? null,
        comment: log.comment ?? null,
      });
      done.forEach((record, index) => {
        const rx = session.exercises.find((e) => e.id === record.prescriptionId)!;
        const target = resolveSets({
          sets: rx.sets,
          defaults: fromLegacySession(session).items.find((i) => i.id === rx.id)!.defaults,
          perSet: [],
        })[0]!;
        const feedback = log.exerciseFeedback?.find((f) => f.prescriptionId === rx.id);
        const byTime = rx.reps.kind === 'seconds' || rx.reps.kind === 'meters';
        const load =
          target.load.kind === 'external'
            ? { kind: 'external', kg: record.loadKg, descriptor: null }
            : target.load.kind === 'other'
              ? { kind: 'other', kg: null, descriptor: target.load.text }
              : { kind: target.load.kind, kg: null, descriptor: null };
        insertSet.run({
          id: `seed-${log.id}-${rx.id}-${record.setNumber}`,
          logId: log.id,
          sessionId: log.sessionId,
          clientId: log.clientId,
          rx: rx.id,
          variant: rx.variantId,
          setNumber: record.setNumber,
          reps: byTime ? null : record.reps,
          duration: rx.reps.kind === 'seconds' ? rx.reps.seconds : null,
          distance: rx.reps.kind === 'meters' ? rx.reps.meters : null,
          loadKind: load.kind,
          loadKg: load.kg,
          loadDescriptor: load.descriptor,
          rir: feedback?.rir ?? null,
          rpe: feedback?.rpe ?? null,
          rpeScale: feedback?.rpe !== undefined ? 'rir_based' : null,
          at: setTimes[index]!,
          tz: options.timeZone,
          offset: utcOffsetMinutes(setTimes[index]!, options.timeZone),
        });
      });
    }
  });
}
