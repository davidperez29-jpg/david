/**
 * Migración 003 · procedencia de lo registrado y auditoría del reloj (docs/AUDIT_BLOCK1.md A-10 y
 * A-14; docs/EXECUTION.md §2).
 *
 * - `origin`, `recorded_by` y `origin_method` en `session_log` y `set_log`: la procedencia se
 *   GUARDA con cada registro (no se deduce en la interfaz), con el vocabulario del dominio
 *   (`src/domain/measurement.ts`): `self_reported` (autodeclarado), `direct` (medido u observado
 *   directamente), `imported`, `calculated`, `estimated`; y quién lo registró: `client`,
 *   `trainer`, `device`, `system`. Lo importado, calculado o estimado exige `origin_method`
 *   (fuente, o fórmula y versión). Hoy todo lo registrado lo autodeclara el cliente desde su
 *   móvil: los registros existentes son exactamente eso (valores por defecto).
 * - `set_log.clock_adjustment`, `session_log.start_clock_adjustment` y `finish_clock_adjustment`:
 *   por qué se usó la hora de recepción en lugar de la del dispositivo (`ahead_of_server` o
 *   `before_lower_bound`). La hora del dispositivo se sigue guardando aparte. Antes de esta
 *   migración el único motivo posible era `ahead_of_server`: los registros antiguos con
 *   `clock_adjusted = 1` lo tienen implícito (no se reescriben: `set_log` solo admite añadir).
 *
 * Solo añade columnas (ALTER TABLE ADD COLUMN), sin reescribir filas ni reconstruir tablas, y un
 * disparador: en `session_log`, la procedencia y los motivos de ajuste no se modifican después
 * (en `set_log` ya no se modifica nada).
 * Una vez aplicada en cualquier base NO se modifica (suma de comprobación).
 */
const ORIGIN = `origin TEXT NOT NULL DEFAULT 'self_reported' CHECK (origin IN ('self_reported', 'direct', 'imported', 'calculated', 'estimated'))`;
const RECORDED_BY = `recorded_by TEXT NOT NULL DEFAULT 'client' CHECK (recorded_by IN ('client', 'trainer', 'device', 'system'))`;
// Ojo: en SQLite un CHECK que da NULL se considera superado; por eso se exige IS NOT NULL.
const METHOD = `origin_method TEXT CHECK ((origin IN ('self_reported', 'direct') AND (origin_method IS NULL OR length(origin_method) BETWEEN 1 AND 200)) OR (origin IN ('imported', 'calculated', 'estimated') AND origin_method IS NOT NULL AND length(origin_method) BETWEEN 1 AND 200))`;
const ADJUSTMENT = (column: string) =>
  `${column} TEXT CHECK (${column} IS NULL OR ${column} IN ('ahead_of_server', 'before_lower_bound'))`;

export const MIGRATION_003 = `
ALTER TABLE set_log ADD COLUMN ${ORIGIN};
ALTER TABLE set_log ADD COLUMN ${RECORDED_BY};
ALTER TABLE set_log ADD COLUMN ${METHOD};
ALTER TABLE set_log ADD COLUMN ${ADJUSTMENT('clock_adjustment')};
ALTER TABLE session_log ADD COLUMN ${ORIGIN};
ALTER TABLE session_log ADD COLUMN ${RECORDED_BY};
ALTER TABLE session_log ADD COLUMN ${METHOD};
ALTER TABLE session_log ADD COLUMN ${ADJUSTMENT('start_clock_adjustment')};
ALTER TABLE session_log ADD COLUMN ${ADJUSTMENT('finish_clock_adjustment')};
CREATE TRIGGER session_log_provenance_is_immutable BEFORE UPDATE ON session_log
WHEN NEW.origin IS NOT OLD.origin OR NEW.recorded_by IS NOT OLD.recorded_by
  OR NEW.origin_method IS NOT OLD.origin_method
  OR NEW.start_clock_adjustment IS NOT OLD.start_clock_adjustment
  OR (OLD.finished_at IS NOT NULL AND NEW.finish_clock_adjustment IS NOT OLD.finish_clock_adjustment)
BEGIN SELECT RAISE(ABORT, 'la procedencia y la auditoría del reloj no se modifican'); END;
`;
