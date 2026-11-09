import 'server-only';
import { type SessionLogV2, type SetLogV2 } from '@/domain/training/execution';
import { type PerformedLoad } from '@/domain/training/load';
import {
  type SessionContent,
  type SessionVersion,
  type TrainingSession,
} from '@/domain/training/session-v2';

/** Filas tal como están en SQLite y su conversión a objetos del dominio (y viceversa). */

export interface SessionRow {
  id: string;
  client_id: string;
  trainer_id: string;
  planned_date: string;
  day_order: number;
  label: string | null;
  status: 'draft' | 'published';
  current_version: number | null;
  draft_content: string | null;
  draft_base_version: number | null;
  draft_revision: number;
  created_at: string;
  updated_at: string;
}

export interface VersionRow {
  id: string;
  session_id: string;
  number: number;
  content: string;
  published_at: string;
  published_by: string;
  reason: string | null;
  changes: string | null;
  execution_state: SessionVersion['executionState'];
}

export interface SessionLogRow {
  id: string;
  session_id: string;
  client_id: string;
  started_at: string;
  start_device_at: string;
  start_time_zone: string;
  start_utc_offset_min: number;
  start_received_at: string;
  last_activity_at: string;
  finished_at: string | null;
  finish_device_at: string | null;
  finish_received_at: string | null;
  finish_reason: 'all_done' | 'ended_early' | null;
  pending_sets_confirmed: number | null;
  perceived_effort: number | null;
  comment: string | null;
}

export interface SetLogRow {
  client_set_id: string;
  session_log_id: string;
  session_id: string;
  client_id: string;
  version_number: number;
  prescription_id: string;
  variant_id: string;
  set_number: number;
  role: 'working';
  completed: number;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  load_kind: PerformedLoad['kind'] | null;
  load_kg: number | null;
  load_descriptor: string | null;
  rir: number | null;
  rpe: number | null;
  rpe_scale: SetLogV2['rpeScale'] | null;
  note: string | null;
  supersedes: string | null;
  performed_at: string;
  device_recorded_at: string;
  device_time_zone: string;
  device_utc_offset_min: number;
  received_at: string;
  clock_adjusted: number;
}

/** Lee un documento JSON guardado y comprueba que es un contenido de sesión reconocible. */
export function parseContent(json: string): SessionContent {
  const value = JSON.parse(json) as SessionContent;
  if (value?.schema !== 1 || !Array.isArray(value.items)) {
    throw new Error('Contenido de sesión con un formato desconocido.');
  }
  return value;
}

export function toSession(row: SessionRow): TrainingSession {
  return {
    id: row.id,
    clientId: row.client_id,
    trainerId: row.trainer_id,
    plannedDate: row.planned_date,
    dayOrder: row.day_order,
    ...(row.label ? { label: row.label } : {}),
    status: row.status,
    currentVersion: row.current_version,
    draft: row.draft_content ? parseContent(row.draft_content) : null,
    draftBaseVersion: row.draft_base_version,
    draftRevision: row.draft_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toVersion(row: VersionRow): SessionVersion {
  return {
    id: row.id,
    sessionId: row.session_id,
    number: row.number,
    content: parseContent(row.content),
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    ...(row.reason ? { reason: row.reason } : {}),
    changes: row.changes ? (JSON.parse(row.changes) as SessionVersion['changes']) : null,
    executionState: row.execution_state,
  };
}

export function toSessionLog(row: SessionLogRow): SessionLogV2 {
  return {
    id: row.id,
    sessionId: row.session_id,
    clientId: row.client_id,
    startedAt: row.started_at,
    startDeviceAt: row.start_device_at,
    startTimeZone: row.start_time_zone,
    startUtcOffsetMin: row.start_utc_offset_min,
    startReceivedAt: row.start_received_at,
    lastActivityAt: row.last_activity_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
    ...(row.finish_device_at ? { finishDeviceAt: row.finish_device_at } : {}),
    ...(row.finish_received_at ? { finishReceivedAt: row.finish_received_at } : {}),
    ...(row.finish_reason ? { finishReason: row.finish_reason } : {}),
    ...(row.pending_sets_confirmed !== null
      ? { pendingSetsConfirmed: row.pending_sets_confirmed }
      : {}),
    ...(row.perceived_effort !== null ? { perceivedEffort: row.perceived_effort } : {}),
    ...(row.comment ? { comment: row.comment } : {}),
  };
}

function toPerformedLoad(row: SetLogRow): PerformedLoad | undefined {
  switch (row.load_kind) {
    case null:
      return undefined;
    case 'external':
      return { kind: 'external', kg: row.load_kg ?? 0 };
    case 'bodyweight':
    case 'none':
      return { kind: row.load_kind };
    case 'bodyweight_plus':
      return { kind: 'bodyweight_plus', addedKg: row.load_kg ?? 0 };
    case 'assisted':
      return { kind: 'assisted', assistanceKg: row.load_kg };
    default:
      return {
        kind: row.load_kind,
        descriptor: row.load_descriptor,
        ...(row.load_kg !== null ? { kg: row.load_kg } : {}),
      };
  }
}

export function toSetLog(row: SetLogRow): SetLogV2 {
  const load = toPerformedLoad(row);
  return {
    clientSetId: row.client_set_id,
    sessionLogId: row.session_log_id,
    sessionId: row.session_id,
    clientId: row.client_id,
    versionNumber: row.version_number,
    prescriptionId: row.prescription_id,
    variantId: row.variant_id,
    setNumber: row.set_number,
    role: row.role,
    completed: row.completed === 1,
    ...(row.reps !== null ? { reps: row.reps } : {}),
    ...(row.duration_s !== null ? { durationS: row.duration_s } : {}),
    ...(row.distance_m !== null ? { distanceM: row.distance_m } : {}),
    ...(load ? { load } : {}),
    ...(row.rir !== null ? { rir: row.rir } : {}),
    ...(row.rpe !== null ? { rpe: row.rpe } : {}),
    ...(row.rpe_scale ? { rpeScale: row.rpe_scale } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.supersedes ? { supersedes: row.supersedes } : {}),
    performedAt: row.performed_at,
    deviceRecordedAt: row.device_recorded_at,
    deviceTimeZone: row.device_time_zone,
    deviceUtcOffsetMin: row.device_utc_offset_min,
    receivedAt: row.received_at,
    clockAdjusted: row.clock_adjusted === 1,
  };
}

/** Columnas de carga de una serie realizada. */
export function loadColumns(load: PerformedLoad | undefined) {
  if (!load) return { load_kind: null, load_kg: null, load_descriptor: null };
  switch (load.kind) {
    case 'external':
      return { load_kind: load.kind, load_kg: load.kg, load_descriptor: null };
    case 'bodyweight':
    case 'none':
      return { load_kind: load.kind, load_kg: null, load_descriptor: null };
    case 'bodyweight_plus':
      return { load_kind: load.kind, load_kg: load.addedKg, load_descriptor: null };
    case 'assisted':
      return { load_kind: load.kind, load_kg: load.assistanceKg, load_descriptor: null };
    default:
      return { load_kind: load.kind, load_kg: load.kg ?? null, load_descriptor: load.descriptor };
  }
}
