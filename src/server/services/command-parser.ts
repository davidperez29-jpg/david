import 'server-only';
import { type ClientCommand } from '@/contracts/execution';
import { isValidTimeZone } from '@/domain/time';
import { issue, type Issue } from '@/domain/issues';
import { type PerformedLoad } from '@/domain/training/load';

/**
 * Analiza el JSON de un comando del cliente (de `unknown` a `ClientCommand`). Solo la FORMA:
 * los rangos y la coherencia con la prescripción los valida el dominio (`performedSetIssues`).
 * Sin bibliotecas (V1_SPEC §8.5, P-11).
 */
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const COMMAND_ID = /^[A-Za-z0-9-]{8,80}$/;
const ID = /^[A-Za-z0-9._-]{1,80}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const optionalNumber = (v: unknown) => v === undefined || v === null || typeof v === 'number';
const optionalString = (v: unknown) => v === undefined || v === null || typeof v === 'string';
const orNull = <T>(v: T | undefined) => (v === undefined ? null : v);

const LOAD_KINDS = [
  'external',
  'bodyweight',
  'none',
  'bodyweight_plus',
  'assisted',
  'elastic',
  'device',
  'self_selected',
  'other',
] as const;

function parseLoad(value: unknown, issues: Issue[]): PerformedLoad | null {
  if (value === undefined || value === null) return null;
  if (!isObj(value) || !LOAD_KINDS.includes(value.kind as (typeof LOAD_KINDS)[number])) {
    issues.push(issue('load', 'Carga no reconocida.'));
    return null;
  }
  switch (value.kind) {
    case 'external':
      if (typeof value.kg !== 'number') issues.push(issue('load.kg', 'Faltan los kg.'));
      return { kind: 'external', kg: value.kg as number };
    case 'bodyweight':
    case 'none':
      return { kind: value.kind };
    case 'bodyweight_plus':
      if (typeof value.addedKg !== 'number') issues.push(issue('load.addedKg', 'Falta el lastre.'));
      return { kind: 'bodyweight_plus', addedKg: value.addedKg as number };
    case 'assisted':
      if (!optionalNumber(value.assistanceKg))
        issues.push(issue('load.assistanceKg', 'No válida.'));
      return { kind: 'assisted', assistanceKg: orNull(value.assistanceKg as number | undefined) };
    default:
      if (!optionalString(value.descriptor) || !optionalNumber(value.kg)) {
        issues.push(issue('load', 'Carga no válida.'));
      }
      return {
        kind: value.kind as 'elastic' | 'device' | 'self_selected' | 'other',
        descriptor: orNull(value.descriptor as string | undefined),
        ...(typeof value.kg === 'number' ? { kg: value.kg } : {}),
      };
  }
}

export function parseClientCommand(
  body: unknown,
): { ok: true; command: ClientCommand } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!isObj(body)) return { ok: false, issues: [issue('', 'El cuerpo debe ser un objeto JSON.')] };
  if (typeof body.commandId !== 'string' || !COMMAND_ID.test(body.commandId)) {
    issues.push(issue('commandId', 'Identificador de comando no válido.'));
  }
  if (typeof body.clientId !== 'string' || !ID.test(body.clientId)) {
    issues.push(issue('clientId', 'Falta la identidad que creó el comando.'));
  }
  const device = body.device;
  if (
    !isObj(device) ||
    typeof device.recordedAt !== 'string' ||
    !INSTANT.test(device.recordedAt) ||
    Number.isNaN(Date.parse(device.recordedAt)) ||
    typeof device.timeZone !== 'string' ||
    !isValidTimeZone(device.timeZone) ||
    typeof device.utcOffsetMinutes !== 'number' ||
    !Number.isInteger(device.utcOffsetMinutes) ||
    Math.abs(device.utcOffsetMinutes) > 840
  ) {
    issues.push(issue('device', 'Falta la hora del dispositivo, su zona horaria o su desfase.'));
  }
  if (issues.length > 0) return { ok: false, issues };
  const base = {
    commandId: body.commandId as string,
    clientId: body.clientId as string,
    device: {
      recordedAt: new Date(Date.parse((device as Obj).recordedAt as string)).toISOString(),
      timeZone: (device as Obj).timeZone as string,
      utcOffsetMinutes: (device as Obj).utcOffsetMinutes as number,
    },
  };

  switch (body.type) {
    case 'start':
      if (!Number.isInteger(body.versionNumber) || (body.versionNumber as number) < 1) {
        return { ok: false, issues: [issue('versionNumber', 'Falta la versión.')] };
      }
      return {
        ok: true,
        command: { ...base, type: 'start', versionNumber: body.versionNumber as number },
      };
    case 'pause':
    case 'resume':
      return { ok: true, command: { ...base, type: body.type } };
    case 'finish': {
      if (typeof body.confirmEndEarly !== 'boolean') {
        issues.push(issue('confirmEndEarly', 'Indica si se termina con series pendientes.'));
      }
      if (!optionalString(body.comment)) issues.push(issue('comment', 'Comentario no válido.'));
      if (issues.length > 0) return { ok: false, issues };
      const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
      return {
        ok: true,
        command: {
          ...base,
          type: 'finish',
          confirmEndEarly: body.confirmEndEarly as boolean,
          comment: comment === '' ? null : comment,
        },
      };
    }
    case 'log_set': {
      if (!Number.isInteger(body.versionNumber) || (body.versionNumber as number) < 1) {
        issues.push(issue('versionNumber', 'Falta la versión.'));
      }
      if (typeof body.prescriptionId !== 'string' || !ID.test(body.prescriptionId)) {
        issues.push(issue('prescriptionId', 'Falta el ejercicio.'));
      }
      if (!Number.isInteger(body.setNumber) || (body.setNumber as number) < 1) {
        issues.push(issue('setNumber', 'Falta el número de serie.'));
      }
      if (typeof body.completed !== 'boolean') {
        issues.push(issue('completed', 'Indica si la serie se hizo.'));
      }
      if (
        body.supersedes !== null &&
        body.supersedes !== undefined &&
        (typeof body.supersedes !== 'string' || !COMMAND_ID.test(body.supersedes))
      ) {
        issues.push(issue('supersedes', 'Registro corregido no válido.'));
      }
      for (const field of ['reps', 'durationS', 'distanceM', 'rir', 'rpe'] as const) {
        if (!optionalNumber(body[field])) issues.push(issue(field, 'Debe ser un número.'));
      }
      if (!optionalString(body.note)) issues.push(issue('note', 'Observación no válida.'));
      const load = parseLoad(body.load, issues);
      if (issues.length > 0) return { ok: false, issues };
      const note =
        typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null;
      return {
        ok: true,
        command: {
          ...base,
          type: 'log_set',
          versionNumber: body.versionNumber as number,
          prescriptionId: body.prescriptionId as string,
          setNumber: body.setNumber as number,
          supersedes: (body.supersedes as string | null | undefined) ?? null,
          completed: body.completed as boolean,
          reps: orNull(body.reps as number | undefined),
          durationS: orNull(body.durationS as number | undefined),
          distanceM: orNull(body.distanceM as number | undefined),
          load,
          rir: orNull(body.rir as number | undefined),
          rpe: orNull(body.rpe as number | undefined),
          note,
        },
      };
    }
    default:
      return { ok: false, issues: [issue('type', 'Tipo de comando desconocido.')] };
  }
}
