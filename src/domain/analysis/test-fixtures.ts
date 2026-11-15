import { type EffortTargetV2 } from '../training/effort';
import { type SessionLogV2, type SetLogV2 } from '../training/execution';
import { type LoadSpec, type PerformedLoad } from '../training/load';
import { type RepTarget } from '../training/prescription';
import { type SessionContent, type SessionItem, type SessionVersion } from '../training/session-v2';
import { type SessionAnalysisInput } from './session';

/**
 * SOLO PARA PRUEBAS: construcción de versiones, ejecuciones y series del dominio, con valores por
 * defecto explícitos. No se usa en la aplicación.
 */
export function item(
  id: string,
  order: number,
  options: {
    sets?: number;
    reps?: RepTarget & { perSide?: boolean };
    load?: LoadSpec;
    effort?: EffortTargetV2;
    name?: string;
    block?: string;
  } = {},
): SessionItem {
  return {
    id,
    variantId: `v-${id}`,
    variantName: options.name ?? id,
    order,
    block: options.block ?? String.fromCharCode(64 + order),
    blockMode: 'sequential',
    sets: options.sets ?? 3,
    defaults: {
      reps: options.reps ?? { kind: 'fixed', reps: 10 },
      load: options.load ?? { kind: 'external', kg: 60, basis: 'total' },
      effort: options.effort ?? { kind: 'none' },
      restSeconds: 120,
    },
    perSet: [],
  };
}

export function version(
  number: number,
  items: SessionItem[],
  options: { plannedDate?: string; publishedAt?: string; estimatedMinutes?: number } = {},
): SessionVersion {
  const content: SessionContent = {
    schema: 1,
    plannedDate: options.plannedDate ?? '2026-11-09',
    dayOrder: 1,
    title: 'Fuerza · pierna',
    focus: 'Fuerza',
    ...(options.estimatedMinutes !== undefined
      ? { estimatedMinutes: options.estimatedMinutes }
      : {}),
    items,
  };
  return {
    id: `ver-${number}`,
    sessionId: 's-1',
    number,
    content,
    publishedAt: options.publishedAt ?? '2026-11-08T18:00:00.000Z',
    publishedBy: 't-alex',
    changes: null,
    executionState: 'not_started',
  };
}

export function sessionLog(options: Partial<SessionLogV2> = {}): SessionLogV2 {
  const startedAt = options.startedAt ?? '2026-11-09T09:00:00.000Z';
  return {
    id: 'log-1',
    sessionId: 's-1',
    clientId: 'c-lucia',
    startedAt,
    startDeviceAt: startedAt,
    startTimeZone: 'Europe/Madrid',
    startUtcOffsetMin: 60,
    startReceivedAt: options.startReceivedAt ?? startedAt,
    startedVersion: 1,
    lastActivityAt: options.finishedAt ?? startedAt,
    pausedSeconds: 0,
    startClockAdjustment: null,
    finishClockAdjustment: null,
    origin: 'self_reported',
    recordedBy: 'client',
    ...options,
  };
}

let counter = 0;

export function setLog(
  prescriptionId: string,
  setNumber: number,
  performed: {
    completed?: boolean;
    reps?: number;
    durationS?: number;
    distanceM?: number;
    load?: PerformedLoad;
    rir?: number;
    rpe?: number;
    rpeScale?: SetLogV2['rpeScale'];
    note?: string;
  },
  options: Partial<SetLogV2> = {},
): SetLogV2 {
  counter += 1;
  const performedAt =
    options.performedAt ?? `2026-11-09T09:${String(10 + setNumber).padStart(2, '0')}:00.000Z`;
  const completed = performed.completed ?? true;
  return {
    clientSetId: options.clientSetId ?? `set-${prescriptionId}-${setNumber}-${counter}`,
    sessionLogId: 'log-1',
    sessionId: 's-1',
    clientId: 'c-lucia',
    versionNumber: 1,
    prescriptionId,
    variantId: `v-${prescriptionId}`,
    setNumber,
    role: 'working',
    completed,
    ...(completed
      ? {
          ...(performed.reps !== undefined ? { reps: performed.reps } : {}),
          ...(performed.durationS !== undefined ? { durationS: performed.durationS } : {}),
          ...(performed.distanceM !== undefined ? { distanceM: performed.distanceM } : {}),
          ...(performed.load ? { load: performed.load } : {}),
          ...(performed.rir !== undefined ? { rir: performed.rir } : {}),
          ...(performed.rpe !== undefined ? { rpe: performed.rpe } : {}),
          ...(performed.rpeScale ? { rpeScale: performed.rpeScale } : {}),
        }
      : {}),
    ...(performed.note ? { note: performed.note } : {}),
    performedAt,
    deviceRecordedAt: performedAt,
    deviceTimeZone: 'Europe/Madrid',
    deviceUtcOffsetMin: 60,
    receivedAt: options.receivedAt ?? performedAt,
    clockAdjusted: false,
    clockAdjustment: null,
    origin: 'self_reported',
    recordedBy: 'client',
    ...options,
  };
}

export const kg = (value: number): PerformedLoad => ({ kind: 'external', kg: value });

export function input(
  overrides: Partial<SessionAnalysisInput> & Pick<SessionAnalysisInput, 'versions'>,
): SessionAnalysisInput {
  return {
    perspective: 'original',
    currentVersion: Math.max(...overrides.versions.map((v) => v.number)),
    execution: null,
    startObserved: true,
    today: '2026-11-14',
    timeZone: 'Europe/Madrid',
    now: '2026-11-14T12:00:00.000Z',
    exerciseName: (variantId, fallback) => fallback ?? variantId,
    ...overrides,
  };
}
