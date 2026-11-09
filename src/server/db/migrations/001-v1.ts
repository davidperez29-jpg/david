/**
 * Migración 001 · esquema de V1 (docs/V1_SPEC.md §4).
 *
 * Una vez aplicada en cualquier base NO se modifica: su suma de comprobación queda guardada en
 * `schema_migrations` y el arranque falla si cambia. Los cambios van en una migración nueva.
 *
 * Convenciones (portables a PostgreSQL, §8.3.4): identificadores TEXT (UUID o los de la semilla),
 * fechas `AAAA-MM-DD`, instantes ISO 8601 en UTC, JSON en TEXT validado, booleanos 0/1.
 */
const DATE = (column: string) =>
  `CHECK (${column} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`;
const INSTANT = (column: string, nullable = false) =>
  nullable
    ? `CHECK (${column} IS NULL OR ${column} LIKE '____-__-__T__:__:__%Z')`
    : `CHECK (${column} LIKE '____-__-__T__:__:__%Z')`;
const immutable = (table: string) => `
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table} solo admite añadir filas'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table}
BEGIN SELECT RAISE(ABORT, '${table} solo admite añadir filas'); END;`;

export const MIGRATION_001 = `
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE trainer (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80)
) STRICT;

CREATE TABLE client (
  id TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL REFERENCES trainer (id),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  population TEXT NOT NULL
    CHECK (population IN ('general_health', 'performance', 'older_adult', 'return_to_sport')),
  goal TEXT NOT NULL CHECK (length(goal) <= 200),
  sport TEXT CHECK (sport IS NULL OR length(sport) BETWEEN 1 AND 80),
  started_on TEXT NOT NULL ${DATE('started_on')},
  UNIQUE (id, trainer_id)
) STRICT;
CREATE INDEX client_by_trainer ON client (trainer_id);

-- Varias sesiones por cliente y día: índice sin unicidad (docs/V1_SPEC.md §4.1).
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  trainer_id TEXT NOT NULL,
  planned_date TEXT NOT NULL ${DATE('planned_date')},
  day_order INTEGER NOT NULL CHECK (day_order >= 1),
  label TEXT CHECK (label IS NULL OR length(label) BETWEEN 1 AND 40),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  current_version INTEGER CHECK (current_version IS NULL OR current_version >= 1),
  draft_content TEXT CHECK (draft_content IS NULL OR json_valid(draft_content)),
  draft_base_version INTEGER,
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  created_at TEXT NOT NULL ${INSTANT('created_at')},
  updated_at TEXT NOT NULL ${INSTANT('updated_at')},
  UNIQUE (id, client_id),
  FOREIGN KEY (client_id, trainer_id) REFERENCES client (id, trainer_id),
  FOREIGN KEY (id, current_version) REFERENCES session_version (session_id, number)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK ((status = 'draft') = (current_version IS NULL)),
  CHECK (status = 'published' OR draft_content IS NOT NULL),
  CHECK (
    draft_base_version IS NULL
    OR (draft_content IS NOT NULL AND draft_base_version = current_version)
  )
) STRICT;
CREATE INDEX session_by_client_day ON session (client_id, planned_date, day_order);

-- Versiones publicadas: inmutables.
CREATE TABLE session_version (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES session (id),
  number INTEGER NOT NULL CHECK (number >= 1),
  content TEXT NOT NULL CHECK (json_valid(content)),
  published_at TEXT NOT NULL ${INSTANT('published_at')},
  published_by TEXT NOT NULL REFERENCES trainer (id),
  reason TEXT CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 300),
  changes TEXT CHECK (changes IS NULL OR json_valid(changes)),
  execution_state TEXT NOT NULL
    CHECK (execution_state IN ('not_started', 'started_no_sets', 'in_progress', 'finished')),
  UNIQUE (session_id, number),
  CHECK (execution_state <> 'finished' OR reason IS NOT NULL)
) STRICT;
${immutable('session_version')}

-- Una ejecución por sesión. El inicio no cambia nunca; el fin se registra una sola vez.
CREATE TABLE session_log (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  started_at TEXT NOT NULL ${INSTANT('started_at')},
  start_device_at TEXT NOT NULL ${INSTANT('start_device_at')},
  start_time_zone TEXT NOT NULL CHECK (length(start_time_zone) BETWEEN 1 AND 64),
  start_utc_offset_min INTEGER NOT NULL CHECK (start_utc_offset_min BETWEEN -840 AND 840),
  start_received_at TEXT NOT NULL ${INSTANT('start_received_at')},
  last_activity_at TEXT NOT NULL ${INSTANT('last_activity_at')},
  finished_at TEXT ${INSTANT('finished_at', true)},
  finish_device_at TEXT ${INSTANT('finish_device_at', true)},
  finish_received_at TEXT ${INSTANT('finish_received_at', true)},
  finish_reason TEXT CHECK (finish_reason IS NULL OR finish_reason IN ('all_done', 'ended_early')),
  pending_sets_confirmed INTEGER
    CHECK (pending_sets_confirmed IS NULL OR pending_sets_confirmed >= 0),
  -- Esfuerzo percibido de la sesión (0–10) del modelo de la Fase 1; su formalización depende de Q2.
  perceived_effort INTEGER CHECK (perceived_effort IS NULL OR perceived_effort BETWEEN 0 AND 10),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 500),
  UNIQUE (id, session_id, client_id),
  FOREIGN KEY (session_id, client_id) REFERENCES session (id, client_id),
  CHECK (
    (finished_at IS NULL) = (finish_reason IS NULL)
    AND (finished_at IS NULL) = (finish_device_at IS NULL)
    AND (finished_at IS NULL) = (finish_received_at IS NULL)
    AND (finished_at IS NULL) = (pending_sets_confirmed IS NULL)
  )
) STRICT;
CREATE TRIGGER session_log_start_is_immutable BEFORE UPDATE ON session_log
WHEN NEW.id <> OLD.id OR NEW.session_id <> OLD.session_id OR NEW.client_id <> OLD.client_id
  OR NEW.started_at <> OLD.started_at OR NEW.start_device_at <> OLD.start_device_at
  OR NEW.start_time_zone <> OLD.start_time_zone
  OR NEW.start_utc_offset_min <> OLD.start_utc_offset_min
  OR NEW.start_received_at <> OLD.start_received_at
BEGIN SELECT RAISE(ABORT, 'el inicio de una ejecución no se modifica'); END;
CREATE TRIGGER session_log_finish_once BEFORE UPDATE ON session_log
WHEN OLD.finished_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'una ejecución terminada no se modifica'); END;
CREATE TRIGGER session_log_no_delete BEFORE DELETE ON session_log
BEGIN SELECT RAISE(ABORT, 'session_log no se borra'); END;

-- Series registradas: solo se añaden. Una corrección sustituye (supersedes) al registro efectivo.
CREATE TABLE set_log (
  client_set_id TEXT PRIMARY KEY,
  session_log_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  prescription_id TEXT NOT NULL CHECK (length(prescription_id) BETWEEN 1 AND 80),
  variant_id TEXT NOT NULL CHECK (length(variant_id) BETWEEN 1 AND 80),
  set_number INTEGER NOT NULL CHECK (set_number BETWEEN 1 AND 50),
  role TEXT NOT NULL DEFAULT 'working' CHECK (role IN ('working')),
  completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
  reps INTEGER CHECK (reps IS NULL OR reps BETWEEN 1 AND 100),
  duration_s REAL CHECK (duration_s IS NULL OR (duration_s > 0 AND duration_s <= 3600)),
  distance_m REAL CHECK (distance_m IS NULL OR (distance_m > 0 AND distance_m <= 10000)),
  load_kind TEXT CHECK (
    load_kind IS NULL OR load_kind IN (
      'external', 'bodyweight', 'bodyweight_plus', 'assisted', 'elastic', 'device',
      'self_selected', 'none', 'other'
    )
  ),
  load_kg REAL CHECK (load_kg IS NULL OR (load_kg >= 0 AND load_kg <= 500)),
  load_descriptor TEXT CHECK (load_descriptor IS NULL OR length(load_descriptor) BETWEEN 1 AND 120),
  rir INTEGER CHECK (rir IS NULL OR rir BETWEEN 0 AND 10),
  rpe REAL CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER))),
  rpe_scale TEXT CHECK (rpe_scale IS NULL OR rpe_scale IN ('rir_based', 'omni_res', 'borg_cr10')),
  note TEXT CHECK (note IS NULL OR length(note) <= 300),
  supersedes TEXT UNIQUE REFERENCES set_log (client_set_id),
  performed_at TEXT NOT NULL ${INSTANT('performed_at')},
  device_recorded_at TEXT NOT NULL ${INSTANT('device_recorded_at')},
  device_time_zone TEXT NOT NULL CHECK (length(device_time_zone) BETWEEN 1 AND 64),
  device_utc_offset_min INTEGER NOT NULL CHECK (device_utc_offset_min BETWEEN -840 AND 840),
  received_at TEXT NOT NULL ${INSTANT('received_at')},
  clock_adjusted INTEGER NOT NULL DEFAULT 0 CHECK (clock_adjusted IN (0, 1)),
  FOREIGN KEY (session_log_id, session_id, client_id)
    REFERENCES session_log (id, session_id, client_id),
  FOREIGN KEY (session_id, version_number) REFERENCES session_version (session_id, number),
  CHECK (
    (completed = 1 AND load_kind IS NOT NULL
      AND (reps IS NOT NULL OR duration_s IS NOT NULL OR distance_m IS NOT NULL))
    OR (completed = 0 AND reps IS NULL AND duration_s IS NULL AND distance_m IS NULL
      AND load_kind IS NULL AND load_kg IS NULL AND rir IS NULL AND rpe IS NULL)
  ),
  CHECK ((rpe IS NULL) = (rpe_scale IS NULL))
) STRICT;
-- Un único registro original por serie; con supersedes único, cada serie forma una cadena lineal.
CREATE UNIQUE INDEX set_log_one_original
  ON set_log (session_log_id, prescription_id, set_number) WHERE supersedes IS NULL;
CREATE INDEX set_log_by_session ON set_log (session_id);
CREATE TRIGGER set_log_correction_same_set BEFORE INSERT ON set_log
WHEN NEW.supersedes IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM set_log s
  WHERE s.client_set_id = NEW.supersedes AND s.session_log_id = NEW.session_log_id
    AND s.prescription_id = NEW.prescription_id AND s.set_number = NEW.set_number
)
BEGIN SELECT RAISE(ABORT, 'una corrección debe sustituir a un registro de la misma serie'); END;
${immutable('set_log')}

-- Idempotencia de los comandos del cliente (también de start y finish).
CREATE TABLE client_command (
  command_id TEXT PRIMARY KEY CHECK (length(command_id) BETWEEN 8 AND 80),
  session_id TEXT NOT NULL REFERENCES session (id),
  client_id TEXT NOT NULL REFERENCES client (id),
  type TEXT NOT NULL CHECK (type IN ('start', 'log_set', 'finish')),
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  received_at TEXT NOT NULL ${INSTANT('received_at')}
) STRICT;
${immutable('client_command')}
`;
