/**
 * Migración 002 · ejecución del bloque 2 (docs/V1_SPEC.md §9.3 y docs/EXECUTION.md).
 *
 * - `session_log.started_version`: versión de la sesión con la que se empezó (la que recibió el
 *   cliente), con clave ajena a `session_version`. Cada serie ya guardaba la suya.
 * - `session_log.paused_at` y `paused_seconds`: pausa explícita y tiempo total en pausa, para
 *   distinguir «Pausada» de «Interrumpida» y calcular la duración sin las pausas.
 * - `client_command.type`: admite `pause` y `resume`.
 *
 * SQLite no permite añadir una clave ajena compuesta ni cambiar un CHECK con ALTER TABLE, así que
 * las dos tablas se reconstruyen (procedimiento de la documentación de SQLite) dentro de la
 * transacción de la migración (`rebuildsTables`): claves ajenas desactivadas fuera de la
 * transacción y `foreign_key_check` vacío antes de confirmar. Antes de migrar una base con datos
 * se hace una copia automática (`antes-de-migrar`).
 *
 * Una vez aplicada en cualquier base NO se modifica (suma de comprobación).
 */
const INSTANT = (column: string, nullable = false) =>
  nullable
    ? `CHECK (${column} IS NULL OR ${column} LIKE '____-__-__T__:__:__%Z')`
    : `CHECK (${column} LIKE '____-__-__T__:__:__%Z')`;

const SESSION_LOG_COLUMNS = `id, session_id, client_id, started_at, start_device_at, start_time_zone,
  start_utc_offset_min, start_received_at, last_activity_at, finished_at, finish_device_at,
  finish_received_at, finish_reason, pending_sets_confirmed, perceived_effort, comment`;

export const MIGRATION_002 = `
CREATE TABLE session_log_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  started_version INTEGER NOT NULL CHECK (started_version >= 1),
  started_at TEXT NOT NULL ${INSTANT('started_at')},
  start_device_at TEXT NOT NULL ${INSTANT('start_device_at')},
  start_time_zone TEXT NOT NULL CHECK (length(start_time_zone) BETWEEN 1 AND 64),
  start_utc_offset_min INTEGER NOT NULL CHECK (start_utc_offset_min BETWEEN -840 AND 840),
  start_received_at TEXT NOT NULL ${INSTANT('start_received_at')},
  last_activity_at TEXT NOT NULL ${INSTANT('last_activity_at')},
  paused_at TEXT ${INSTANT('paused_at', true)},
  paused_seconds INTEGER NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
  finished_at TEXT ${INSTANT('finished_at', true)},
  finish_device_at TEXT ${INSTANT('finish_device_at', true)},
  finish_received_at TEXT ${INSTANT('finish_received_at', true)},
  finish_reason TEXT CHECK (finish_reason IS NULL OR finish_reason IN ('all_done', 'ended_early')),
  pending_sets_confirmed INTEGER
    CHECK (pending_sets_confirmed IS NULL OR pending_sets_confirmed >= 0),
  perceived_effort INTEGER CHECK (perceived_effort IS NULL OR perceived_effort BETWEEN 0 AND 10),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 500),
  UNIQUE (id, session_id, client_id),
  FOREIGN KEY (session_id, client_id) REFERENCES session (id, client_id),
  FOREIGN KEY (session_id, started_version) REFERENCES session_version (session_id, number),
  CHECK (
    (finished_at IS NULL) = (finish_reason IS NULL)
    AND (finished_at IS NULL) = (finish_device_at IS NULL)
    AND (finished_at IS NULL) = (finish_received_at IS NULL)
    AND (finished_at IS NULL) = (pending_sets_confirmed IS NULL)
  ),
  -- Una ejecución terminada no está en pausa.
  CHECK (finished_at IS NULL OR paused_at IS NULL)
) STRICT;

-- La versión de inicio de las ejecuciones existentes: la vigente cuando empezaron (la última
-- publicada antes del inicio) o, si no la hay, la primera.
INSERT INTO session_log_new (${SESSION_LOG_COLUMNS}, started_version, paused_at, paused_seconds)
SELECT ${SESSION_LOG_COLUMNS.split(',')
  .map((c) => `l.${c.trim()}`)
  .join(', ')},
  COALESCE(
    (SELECT v.number FROM session_version v
     WHERE v.session_id = l.session_id AND v.published_at <= l.started_at
     ORDER BY v.number DESC LIMIT 1),
    (SELECT MIN(v.number) FROM session_version v WHERE v.session_id = l.session_id)
  ),
  NULL, 0
FROM session_log l;

DROP TABLE session_log;
ALTER TABLE session_log_new RENAME TO session_log;

CREATE TRIGGER session_log_start_is_immutable BEFORE UPDATE ON session_log
WHEN NEW.id <> OLD.id OR NEW.session_id <> OLD.session_id OR NEW.client_id <> OLD.client_id
  OR NEW.started_version <> OLD.started_version
  OR NEW.started_at <> OLD.started_at OR NEW.start_device_at <> OLD.start_device_at
  OR NEW.start_time_zone <> OLD.start_time_zone
  OR NEW.start_utc_offset_min <> OLD.start_utc_offset_min
  OR NEW.start_received_at <> OLD.start_received_at
BEGIN SELECT RAISE(ABORT, 'el inicio de una ejecución no se modifica'); END;
CREATE TRIGGER session_log_finish_once BEFORE UPDATE ON session_log
WHEN OLD.finished_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'una ejecución terminada no se modifica'); END;
CREATE TRIGGER session_log_paused_seconds_only_grow BEFORE UPDATE ON session_log
WHEN NEW.paused_seconds < OLD.paused_seconds
BEGIN SELECT RAISE(ABORT, 'el tiempo en pausa solo puede crecer'); END;
CREATE TRIGGER session_log_no_delete BEFORE DELETE ON session_log
BEGIN SELECT RAISE(ABORT, 'session_log no se borra'); END;

CREATE TABLE client_command_new (
  command_id TEXT PRIMARY KEY CHECK (length(command_id) BETWEEN 8 AND 80),
  session_id TEXT NOT NULL REFERENCES session (id),
  client_id TEXT NOT NULL REFERENCES client (id),
  type TEXT NOT NULL CHECK (type IN ('start', 'log_set', 'pause', 'resume', 'finish')),
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  received_at TEXT NOT NULL ${INSTANT('received_at')}
) STRICT;
INSERT INTO client_command_new (command_id, session_id, client_id, type, payload_hash, received_at)
SELECT command_id, session_id, client_id, type, payload_hash, received_at FROM client_command;
DROP TABLE client_command;
ALTER TABLE client_command_new RENAME TO client_command;
CREATE INDEX client_command_by_session ON client_command (session_id);
CREATE TRIGGER client_command_no_update BEFORE UPDATE ON client_command
BEGIN SELECT RAISE(ABORT, 'client_command solo admite añadir filas'); END;
CREATE TRIGGER client_command_no_delete BEFORE DELETE ON client_command
BEGIN SELECT RAISE(ABORT, 'client_command solo admite añadir filas'); END;
`;
