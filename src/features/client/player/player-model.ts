import {
  type ClientCommand,
  type ExecutionStateVM,
  type PerformedSetVM,
} from '@/contracts/execution';
import { type SetLogV2 } from '@/domain/training/execution';
import { type PerformedSet } from '@/domain/training/performance';
import { type QueuedCommand } from './local-store';

/**
 * Lo que ve el reproductor = lo confirmado por el servidor + lo pendiente en el dispositivo.
 * Cada serie sabe de dónde sale su registro: «confirmed» solo si lo ha confirmado el servidor.
 */
export type SetSync = 'confirmed' | 'queued' | 'sending' | 'error';

export interface LocalRecord extends PerformedSet {
  clientSetId: string;
  versionNumber: number;
  note?: string;
  supersedes?: string;
}

export interface SetEntry {
  record: LocalRecord | null;
  sync: SetSync | null;
  /** El registro confirmado (si lo hay), aunque haya una corrección pendiente encima. */
  confirmed: PerformedSetVM | null;
  error?: QueuedCommand['error'];
  commandId?: string;
}

export const setKey = (prescriptionId: string, setNumber: number) =>
  `${prescriptionId}#${setNumber}`;

const fromConfirmed = (s: PerformedSetVM): LocalRecord => ({
  clientSetId: s.clientSetId,
  versionNumber: s.versionNumber,
  completed: s.completed,
  ...(s.reps !== undefined ? { reps: s.reps } : {}),
  ...(s.durationS !== undefined ? { durationS: s.durationS } : {}),
  ...(s.distanceM !== undefined ? { distanceM: s.distanceM } : {}),
  ...(s.load ? { load: s.load } : {}),
  ...(s.rir !== undefined ? { rir: s.rir } : {}),
  ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
  ...(s.note ? { note: s.note } : {}),
  ...(s.supersedes ? { supersedes: s.supersedes } : {}),
});

const has = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const fromCommand = (c: Extract<ClientCommand, { type: 'log_set' }>): LocalRecord => ({
  clientSetId: c.commandId,
  versionNumber: c.versionNumber,
  completed: c.completed,
  ...(has(c.reps) ? { reps: c.reps } : {}),
  ...(has(c.durationS) ? { durationS: c.durationS } : {}),
  ...(has(c.distanceM) ? { distanceM: c.distanceM } : {}),
  ...(c.load ? { load: c.load } : {}),
  ...(has(c.rir) ? { rir: c.rir } : {}),
  ...(has(c.rpe) ? { rpe: c.rpe } : {}),
  ...(c.note ? { note: c.note } : {}),
  ...(c.supersedes ? { supersedes: c.supersedes } : {}),
});

/** Registro de cada serie combinando el servidor y la cola (lo pendiente más reciente manda). */
export function mergeSets(state: ExecutionStateVM, queue: readonly QueuedCommand[]) {
  const entries = new Map<string, SetEntry>();
  for (const s of state.sets) {
    entries.set(setKey(s.prescriptionId, s.setNumber), {
      record: fromConfirmed(s),
      sync: 'confirmed',
      confirmed: s,
    });
  }
  for (const entry of queue) {
    if (entry.command.type !== 'log_set') continue;
    const key = setKey(entry.command.prescriptionId, entry.command.setNumber);
    const previous = entries.get(key);
    entries.set(key, {
      record: fromCommand(entry.command),
      sync: entry.status,
      confirmed: previous?.confirmed ?? null,
      ...(entry.error ? { error: entry.error } : {}),
      commandId: entry.commandId,
    });
  }
  return entries;
}

/** Estado de la sesión combinando el servidor y la cola. */
export function executionFlags(state: ExecutionStateVM, queue: readonly QueuedCommand[]) {
  const live = queue.filter((e) => e.status !== 'error');
  const last = live.at(-1)?.command.type;
  return {
    started: state.startedAt !== null || live.some((e) => e.command.type === 'start'),
    startPending: state.startedAt === null && live.some((e) => e.command.type === 'start'),
    finished: state.finishedAt !== null || live.some((e) => e.command.type === 'finish'),
    finishPending: state.finishedAt === null && live.some((e) => e.command.type === 'finish'),
    paused: (state.pausedAt !== null && live.length === 0) || last === 'pause',
  };
}

/** Registros con la forma del servidor, para calcular el resumen también sin conexión. */
export function asSetLogs(
  state: ExecutionStateVM,
  queue: readonly QueuedCommand[],
  sessionId: string,
): SetLogV2[] {
  const base = {
    sessionLogId: 'local',
    sessionId,
    clientId: 'local',
    role: 'working' as const,
    deviceTimeZone: 'UTC',
    deviceUtcOffsetMin: 0,
    clockAdjusted: false,
    // Lo que registra la clienta en su móvil es autodeclarado.
    origin: 'self_reported' as const,
    recordedBy: 'client' as const,
  };
  const confirmed = state.sets.map((s): SetLogV2 => ({
    ...base,
    ...fromConfirmed(s),
    prescriptionId: s.prescriptionId,
    variantId: '',
    setNumber: s.setNumber,
    performedAt: s.performedAt,
    deviceRecordedAt: s.performedAt,
    receivedAt: s.performedAt,
  }));
  const local = queue
    .filter((e) => e.status !== 'error' && e.command.type === 'log_set')
    .map((e): SetLogV2 => {
      const c = e.command as Extract<ClientCommand, { type: 'log_set' }>;
      return {
        ...base,
        ...fromCommand(c),
        prescriptionId: c.prescriptionId,
        variantId: '',
        setNumber: c.setNumber,
        performedAt: c.device.recordedAt,
        deviceRecordedAt: c.device.recordedAt,
        receivedAt: c.device.recordedAt,
      };
    });
  return [...confirmed, ...local];
}

/** Reloj del dispositivo para un comando (hora, zona y desfase de ese momento). */
export function deviceNow() {
  const now = new Date();
  return {
    recordedAt: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    utcOffsetMinutes: -now.getTimezoneOffset(),
  };
}

/** Identificador estable del comando (también sin `crypto.randomUUID`). */
export function newCommandId(): string {
  const c = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
