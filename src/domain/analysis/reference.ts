import { addDays, type IsoDateTime, startOfLocalDay } from '../time';
import { type SessionLogV2, type SetLogV2 } from '../training/execution';
import { type SessionVersion } from '../training/session-v2';

/**
 * Prescripción de referencia (P-92, P-117 y P-121; docs/BLOCK3_SPEC.md §4.2 y §21.6).
 *
 * - **Original:** la instrucción que tenía la clienta en su momento.
 *   - Serie registrada: la versión de su registro (es un dato).
 *   - Lo no registrado de una sesión empezada: la versión del último registro; si no hay
 *     registros, la de inicio, solo si se observó (no si se dedujo al migrar a la `002`).
 *   - Sesión sin empezar: la vigente al terminar el día previsto, solo si es inequívoca.
 * - **Vigente:** la prescripción actual del entrenador.
 *
 * Nunca se sustituye una referencia desconocida por la vigente ni se usa la fecha prevista
 * actual como si fuera la de una versión anterior.
 */
export type Perspective = 'original' | 'current';

export type UndeterminedReason =
  /** La versión de inicio de una ejecución anterior a la migración `002` se dedujo al migrar. */
  | 'start_version_deduced'
  /** El último registro no es el mismo por la hora del móvil que por la de llegada. */
  | 'record_order_ambiguous'
  /** Sesión sin empezar cuyas versiones tienen fechas previstas distintas. */
  | 'planned_dates_differ'
  /** Al terminar el día previsto no había ninguna versión publicada. */
  | 'no_version_at_end_of_day'
  /** El día previsto aún no ha terminado: la referencia original no está fijada. */
  | 'planned_day_not_over';

export type ReferenceBasis =
  /** La versión con la que se registró la serie. */
  | 'set_version'
  /** La del último registro de la sesión (P-117). */
  | 'last_record'
  /** La de inicio, observada (P-117). */
  | 'start_version'
  /** La vigente al terminar el día previsto (P-117, P-121). */
  | 'end_of_planned_day'
  /** La vigente ahora. */
  | 'current';

export type SessionReference =
  | { kind: 'determined'; version: number; basis: Exclude<ReferenceBasis, 'set_version'> }
  | { kind: 'undetermined'; reason: UndeterminedReason };

export const UNDETERMINED_REASON_TEXT: Record<UndeterminedReason, string> = {
  start_version_deduced:
    'La ejecución es anterior al registro de la versión de inicio: esa versión se dedujo al actualizar la base y no se usa.',
  record_order_ambiguous:
    'El último registro no es el mismo según la hora del móvil que según la hora de llegada, y tienen versiones distintas.',
  planned_dates_differ: 'Las versiones de la sesión tienen fechas previstas distintas.',
  no_version_at_end_of_day: 'Al terminar el día previsto no había ninguna versión publicada.',
  planned_day_not_over: 'El día previsto aún no ha terminado.',
};

export const REFERENCE_BASIS_TEXT: Record<ReferenceBasis, string> = {
  set_version: 'versión con la que se registró la serie',
  last_record: 'versión del último registro de la sesión',
  start_version: 'versión con la que se empezó',
  end_of_planned_day: 'versión vigente al terminar el día previsto',
  current: 'versión vigente',
};

/**
 * ¿La versión de inicio de esta ejecución se observó (la envió el móvil al empezar) o se dedujo
 * al aplicar la migración `002`?
 *
 * - Una base sembrada con la `002` ya aplicada no tiene ejecuciones anteriores a ella.
 * - En otro caso, son anteriores las que llegaron antes de aplicarla (reloj del servidor).
 * - Sin el dato de la migración no se puede afirmar: se trata como deducida.
 */
export function startVersionObserved(input: {
  startReceivedAt: IsoDateTime;
  migration002AppliedAt: IsoDateTime | null;
  seededAt: IsoDateTime | null;
}): boolean {
  if (input.migration002AppliedAt === null) return false;
  const applied = Date.parse(input.migration002AppliedAt);
  if (input.seededAt !== null && Date.parse(input.seededAt) >= applied) return true;
  return Date.parse(input.startReceivedAt) >= applied;
}

/** El último registro de la sesión, si es inequívoco (por la hora del móvil y por la de llegada). */
function lastRecordVersion(setLogs: readonly SetLogV2[]): number | 'ambiguous' | null {
  if (setLogs.length === 0) return null;
  const byPerformed = [...setLogs].sort(
    (a, b) =>
      Date.parse(b.performedAt) - Date.parse(a.performedAt) ||
      Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
  )[0]!;
  const byReceived = [...setLogs].sort(
    (a, b) =>
      Date.parse(b.receivedAt) - Date.parse(a.receivedAt) ||
      Date.parse(b.performedAt) - Date.parse(a.performedAt),
  )[0]!;
  return byPerformed.versionNumber === byReceived.versionNumber
    ? byPerformed.versionNumber
    : 'ambiguous';
}

/**
 * Referencia de la sesión para lo NO registrado (las series registradas usan siempre la suya).
 * `now` decide si el día previsto ya terminó; `timeZone` es la zona de la aplicación.
 */
export function sessionReference(input: {
  perspective: Perspective;
  versions: readonly Pick<SessionVersion, 'number' | 'publishedAt' | 'content'>[];
  currentVersion: number;
  execution: { log: SessionLogV2; setLogs: readonly SetLogV2[] } | null;
  startObserved: boolean;
  timeZone: string;
  now: IsoDateTime;
}): SessionReference {
  if (input.perspective === 'current') {
    return { kind: 'determined', version: input.currentVersion, basis: 'current' };
  }
  if (input.execution) {
    const last = lastRecordVersion(input.execution.setLogs);
    if (last === 'ambiguous') return { kind: 'undetermined', reason: 'record_order_ambiguous' };
    if (last !== null) return { kind: 'determined', version: last, basis: 'last_record' };
    return input.startObserved
      ? { kind: 'determined', version: input.execution.log.startedVersion, basis: 'start_version' }
      : { kind: 'undetermined', reason: 'start_version_deduced' };
  }
  const dates = new Set(input.versions.map((v) => v.content.plannedDate));
  if (dates.size !== 1) return { kind: 'undetermined', reason: 'planned_dates_differ' };
  const [plannedDate] = [...dates] as [string];
  const endOfDay = Date.parse(startOfLocalDay(addDays(plannedDate, 1), input.timeZone));
  if (Date.parse(input.now) < endOfDay) {
    return { kind: 'undetermined', reason: 'planned_day_not_over' };
  }
  const vigentThen = [...input.versions]
    .filter((v) => Date.parse(v.publishedAt) < endOfDay)
    .sort((a, b) => b.number - a.number)[0];
  return vigentThen
    ? { kind: 'determined', version: vigentThen.number, basis: 'end_of_planned_day' }
    : { kind: 'undetermined', reason: 'no_version_at_end_of_day' };
}
