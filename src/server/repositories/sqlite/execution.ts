import 'server-only';
import {
  effectiveSetLogs,
  resolveExecutionInstant,
  type SetLogV2,
} from '@/domain/training/execution';
import { type SqlDatabase } from '../../db/sqlite.ts';
import {
  type CommandMeta,
  type ExecutionRepository,
  type ExecutionWriteResult,
  type SetLogInsert,
} from '../ports';
import { loadColumns, type SessionLogRow, type SetLogRow, toSetLog } from './rows';

interface CommandRow {
  command_id: string;
  session_id: string;
  client_id: string;
  type: string;
  payload_hash: string;
}

const seconds = (from: string, to: string) =>
  Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 1000));

const later = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);

/**
 * Comandos de la ejecución en SQLite. Cada uno, en una transacción `BEGIN IMMEDIATE`:
 * 1. ¿Ya se recibió este `commandId`? Mismo contenido → «ya aplicado»; otro → error.
 * 2. Comprobaciones que dependen de lo guardado (empezada, terminada, serie ya registrada…).
 * 3. El cambio y el registro del comando, juntos: o todo o nada.
 */
export function createSqliteExecution(db: SqlDatabase): ExecutionRepository {
  const commandById = (id: string) =>
    db.prepare('SELECT * FROM client_command WHERE command_id = @id').get<CommandRow>({ id });
  const logOf = (sessionId: string) =>
    db
      .prepare('SELECT * FROM session_log WHERE session_id = @sessionId')
      .get<SessionLogRow>({ sessionId });
  const setsOf = (logId: string) =>
    db
      .prepare(
        'SELECT * FROM set_log WHERE session_log_id = @id ORDER BY received_at, client_set_id',
      )
      .all<SetLogRow>({ id: logId })
      .map(toSetLog);
  const insertCommand = db.prepare(
    `INSERT INTO client_command (command_id, session_id, client_id, type, payload_hash, received_at)
     VALUES (@commandId, @sessionId, @clientId, @type, @payloadHash, @receivedAt)`,
  );

  /**
   * Envuelve un comando: idempotencia, transacción y registro del comando. Es `async` para que
   * un error de la base llegue como promesa rechazada, igual que en cualquier otro adaptador.
   */
  const command = async (
    type: string,
    meta: CommandMeta,
    apply: () => ExecutionWriteResult,
  ): Promise<ExecutionWriteResult> =>
    db.transaction(() => {
      const seen = commandById(meta.commandId);
      if (seen) {
        const same =
          seen.payload_hash === meta.payloadHash &&
          seen.session_id === meta.sessionId &&
          seen.client_id === meta.clientId &&
          seen.type === type;
        return { result: same ? 'already_applied' : 'command_id_reused' } as const;
      }
      const outcome = apply();
      if (outcome.result === 'applied') {
        insertCommand.run({
          commandId: meta.commandId,
          sessionId: meta.sessionId,
          clientId: meta.clientId,
          type,
          payloadHash: meta.payloadHash,
          receivedAt: meta.receivedAt,
        });
      }
      return outcome;
    });

  /**
   * Hora de ejecución del comando con las reglas T2–T4 (`resolveExecutionInstant`; EXECUTION.md
   * §7.1): la del dispositivo, salvo que vaya por delante del servidor o sea anterior a lo posible
   * (`lowerBound`: la publicación de la versión al empezar, el inicio de la ejecución después).
   */
  const instant = (meta: CommandMeta, lowerBound: string | null) =>
    resolveExecutionInstant(meta.device.recordedAt, meta.receivedAt, lowerBound);

  /** Cierra la pausa abierta (si la hay) y anota la actividad. */
  const touch = (log: SessionLogRow, at: string) => {
    db.prepare(
      `UPDATE session_log SET last_activity_at = @last, paused_at = NULL,
         paused_seconds = paused_seconds + @paused WHERE id = @id`,
    ).run({
      id: log.id,
      last: later(at, log.last_activity_at),
      paused: log.paused_at ? seconds(log.paused_at, at) : 0,
    });
  };

  const effectiveFor = (logId: string, prescriptionId: string, setNumber: number) =>
    effectiveSetLogs(setsOf(logId)).find(
      (s) => s.prescriptionId === prescriptionId && s.setNumber === setNumber,
    ) ?? null;

  return {
    start: (meta, input) =>
      command('start', meta, () => {
        if (logOf(meta.sessionId)) return { result: 'already_started' };
        const { performedAt, adjustment } = instant(meta, input.versionPublishedAt);
        db.prepare(
          `INSERT INTO session_log (id, session_id, client_id, started_version, started_at,
             start_device_at, start_time_zone, start_utc_offset_min, start_received_at,
             last_activity_at, start_clock_adjustment, origin, recorded_by)
           VALUES (@id, @sessionId, @clientId, @version, @startedAt, @deviceAt, @tz, @offset,
             @receivedAt, @startedAt, @adjustment, 'self_reported', 'client')`,
        ).run({
          adjustment,
          id: input.logId,
          sessionId: meta.sessionId,
          clientId: meta.clientId,
          version: input.startedVersion,
          startedAt: performedAt,
          deviceAt: meta.device.recordedAt,
          tz: meta.device.timeZone,
          offset: meta.device.utcOffsetMinutes,
          receivedAt: meta.receivedAt,
        });
        return { result: 'applied' };
      }),

    logSet: (meta, input: SetLogInsert) =>
      command('log_set', meta, () => {
        const log = logOf(meta.sessionId);
        if (!log) return { result: 'not_started' };
        if (log.finished_at) return { result: 'closed' };
        const effective: SetLogV2 | null = effectiveFor(
          log.id,
          input.prescriptionId,
          input.setNumber,
        );
        if (input.supersedes === null && effective) {
          return { result: 'set_already_logged', effective };
        }
        if (input.supersedes !== null && effective?.clientSetId !== input.supersedes) {
          return { result: 'not_effective', effective };
        }
        const { performedAt, adjustment } = instant(meta, log.started_at);
        const load = loadColumns(input.load ?? undefined);
        db.prepare(
          `INSERT INTO set_log (client_set_id, session_log_id, session_id, client_id,
             version_number, prescription_id, variant_id, set_number, role, completed, reps,
             duration_s, distance_m, load_kind, load_kg, load_descriptor, rir, rpe, rpe_scale,
             note, supersedes, performed_at, device_recorded_at, device_time_zone,
             device_utc_offset_min, received_at, clock_adjusted, clock_adjustment, origin,
             recorded_by)
           VALUES (@id, @logId, @sessionId, @clientId, @version, @rx, @variant, @setNumber,
             'working', @completed, @reps, @duration, @distance, @loadKind, @loadKg,
             @loadDescriptor, @rir, @rpe, @rpeScale, @note, @supersedes, @performedAt,
             @deviceAt, @tz, @offset, @receivedAt, @adjusted, @adjustment, 'self_reported',
             'client')`,
        ).run({
          id: meta.commandId,
          logId: log.id,
          sessionId: meta.sessionId,
          clientId: meta.clientId,
          version: input.versionNumber,
          rx: input.prescriptionId,
          variant: input.variantId,
          setNumber: input.setNumber,
          completed: input.completed ? 1 : 0,
          reps: input.reps,
          duration: input.durationS,
          distance: input.distanceM,
          loadKind: load.load_kind,
          loadKg: load.load_kg,
          loadDescriptor: load.load_descriptor,
          rir: input.rir,
          rpe: input.rpe,
          rpeScale: input.rpe !== null ? (input.rpeScale ?? null) : null,
          note: input.note,
          supersedes: input.supersedes,
          performedAt,
          deviceAt: meta.device.recordedAt,
          tz: meta.device.timeZone,
          offset: meta.device.utcOffsetMinutes,
          receivedAt: meta.receivedAt,
          adjusted: adjustment ? 1 : 0,
          adjustment,
        });
        // Registrar una serie también reanuda una sesión en pausa.
        touch(log, performedAt);
        return { result: 'applied' };
      }),

    pause: (meta) =>
      command('pause', meta, () => {
        const log = logOf(meta.sessionId);
        if (!log) return { result: 'not_started' };
        if (log.finished_at) return { result: 'closed' };
        if (!log.paused_at) {
          const { performedAt } = instant(meta, log.started_at);
          db.prepare(
            'UPDATE session_log SET paused_at = @at, last_activity_at = @last WHERE id = @id',
          ).run({ id: log.id, at: performedAt, last: later(performedAt, log.last_activity_at) });
        }
        return { result: 'applied' };
      }),

    resume: (meta) =>
      command('resume', meta, () => {
        const log = logOf(meta.sessionId);
        if (!log) return { result: 'not_started' };
        if (log.finished_at) return { result: 'closed' };
        touch(log, instant(meta, log.started_at).performedAt);
        return { result: 'applied' };
      }),

    finish: (meta, input) =>
      command('finish', meta, () => {
        const log = logOf(meta.sessionId);
        if (!log) return { result: 'not_started' };
        if (log.finished_at) return { result: 'closed' };
        const effective = effectiveSetLogs(setsOf(log.id));
        const key = (s: { prescriptionId: string; setNumber: number }) =>
          `${s.prescriptionId}#${s.setNumber}`;
        const logged = new Map(effective.map((s) => [key(s), s]));
        const pending = input.currentSets.filter((s) => !logged.has(key(s))).length;
        if (pending > 0 && !input.confirmEndEarly) {
          return { result: 'confirmation_required', pendingSets: pending };
        }
        const allDone =
          input.currentSets.length > 0 &&
          input.currentSets.every((s) => logged.get(key(s))?.completed === true);
        const { performedAt, adjustment } = instant(meta, log.started_at);
        db.prepare(
          `UPDATE session_log SET finished_at = @at, finish_device_at = @deviceAt,
             finish_clock_adjustment = @adjustment,
             finish_received_at = @receivedAt, finish_reason = @reason,
             pending_sets_confirmed = @pending, comment = @comment,
             last_activity_at = @last, paused_at = NULL,
             paused_seconds = paused_seconds + @paused
           WHERE id = @id`,
        ).run({
          id: log.id,
          at: performedAt,
          deviceAt: meta.device.recordedAt,
          receivedAt: meta.receivedAt,
          reason: allDone ? 'all_done' : 'ended_early',
          pending,
          comment: input.comment,
          last: later(performedAt, log.last_activity_at),
          paused: log.paused_at ? seconds(log.paused_at, performedAt) : 0,
          adjustment,
        });
        return { result: 'applied' };
      }),
  };
}
