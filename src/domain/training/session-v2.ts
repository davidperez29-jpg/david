import { formatSeconds } from '../format';
import { inRange, isInt, issue, type Issue, textWithin } from '../issues';
import { isIsoDate, type IsoDate, type IsoDateTime } from '../time';
import { describeEffort, effortIssues, type EffortTargetV2 } from './effort';
import { describeLoad, loadIssues, type LoadSpec } from './load';
import { formatRepTarget, formatTempo, type RepTarget, type Tempo } from './prescription';

/**
 * Prescripción v2 de una sesión (docs/V1_SPEC.md §4): valores comunes por ejercicio y
 * excepciones por serie, versiones publicadas inmutables y borradores aparte.
 */

/** Objetivo de una serie. */
export interface SetTarget {
  reps: RepTarget & { perSide?: boolean };
  load: LoadSpec;
  effort: EffortTargetV2;
  restSeconds: number;
  tempo?: Tempo;
  /** Observación visible para el cliente en esta serie. */
  note?: string;
}

/** Cambios de una serie concreta respecto a los valores comunes. */
export type SetOverride = Partial<SetTarget> & { setNumber: number };

export interface SessionItem {
  /** Estable entre versiones: una serie se identifica por (id, número de serie). */
  id: string;
  variantId: string;
  /** Nombre de la variante, copiado al publicar (la versión no depende de la biblioteca). */
  variantName?: string;
  order: number;
  /** Bloque (A, B, C…). Los ejercicios de un mismo bloque van seguidos (A1, A2). */
  block: string;
  blockMode: 'sequential';
  sets: number;
  defaults: SetTarget;
  perSet: SetOverride[];
  clientNote?: string;
  /** Solo para el entrenador: nunca llega al cliente. */
  privateNote?: string;
}

export interface SessionContent {
  schema: 1;
  plannedDate: IsoDate;
  dayOrder: number;
  /** Contexto de la sesión en el día («Mañana», «Club»…). */
  label?: string;
  title: string;
  focus: string;
  estimatedMinutes?: number;
  /** Nota visible para el cliente. */
  coachNote?: string;
  items: SessionItem[];
}

export type SessionStatusV2 = 'draft' | 'published';

export interface TrainingSession {
  id: string;
  clientId: string;
  trainerId: string;
  plannedDate: IsoDate;
  dayOrder: number;
  label?: string;
  status: SessionStatusV2;
  currentVersion: number | null;
  /** Borrador inicial o borrador de cambios (lo que aún no ve el cliente). */
  draft: SessionContent | null;
  draftBaseVersion: number | null;
  draftRevision: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type ExecutionStateAtPublish =
  'not_started' | 'started_no_sets' | 'in_progress' | 'finished';

export interface ContentChange {
  itemId?: string;
  setNumber?: number;
  text: string;
  /** Cambios que solo ve el entrenador (por ejemplo, en la nota privada). */
  trainerOnly?: boolean;
}

export interface SessionVersion {
  id: string;
  sessionId: string;
  number: number;
  content: SessionContent;
  publishedAt: IsoDateTime;
  publishedBy: string;
  reason?: string;
  changes: ContentChange[] | null;
  executionState: ExecutionStateAtPublish;
}

export interface ResolvedSet extends SetTarget {
  setNumber: number;
}

export const CONTENT_LIMITS = {
  items: 30,
  sets: { min: 1, max: 50 },
  reps: { min: 1, max: 100 },
  seconds: { min: 1, max: 3600 },
  meters: { min: 1, max: 10_000 },
  restSeconds: { min: 0, max: 1800 },
  estimatedMinutes: { min: 5, max: 300 },
  title: 80,
  focus: 120,
  label: 40,
  coachNote: 500,
  clientNote: 300,
  privateNote: 500,
  setNote: 300,
} as const;

/** Series resueltas: valores comunes con las excepciones de cada serie aplicadas. */
export function resolveSets(
  item: Pick<SessionItem, 'sets' | 'defaults' | 'perSet'>,
): ResolvedSet[] {
  return Array.from({ length: item.sets }, (_, index) => {
    const setNumber = index + 1;
    const override = item.perSet.find((o) => o.setNumber === setNumber);
    const { setNumber: _ignored, ...patch } = override ?? { setNumber };
    return { ...item.defaults, ...patch, setNumber };
  });
}

/** Letra de bloque para una posición (1 → A, 26 → Z, 27 → AA). */
export function blockLetter(order: number): string {
  let n = order;
  let letters = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

const trimOrUndefined = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Forma canónica del contenido: orden 1…n, bloques renombrados A, B…, textos recortados, excepciones
 * ordenadas y sin series que ya no existen. Se aplica antes de guardar.
 */
export function normalizeContent(content: SessionContent): SessionContent {
  const sorted = [...content.items].sort((a, b) => a.order - b.order);
  // Los bloques se conservan (los ejercicios de un mismo bloque, como A1 y A2, siguen juntos) y
  // se vuelven a nombrar por orden de aparición: A, B, C…
  const letters = new Map<string, string>();
  for (const item of sorted) {
    const key = item.block.trim() || `#${item.id}`;
    if (!letters.has(key)) letters.set(key, blockLetter(letters.size + 1));
  }
  const items = sorted.map((item, index) => {
    const order = index + 1;
    const clientNote = trimOrUndefined(item.clientNote);
    const privateNote = trimOrUndefined(item.privateNote);
    const variantName = trimOrUndefined(item.variantName);
    return {
      id: item.id,
      variantId: item.variantId,
      ...(variantName ? { variantName } : {}),
      order,
      block: letters.get(item.block.trim() || `#${item.id}`)!,
      blockMode: 'sequential' as const,
      sets: item.sets,
      defaults: normalizeTarget(item.defaults),
      perSet: item.perSet
        .filter((o) => o.setNumber >= 1 && o.setNumber <= item.sets)
        .sort((a, b) => a.setNumber - b.setNumber),
      ...(clientNote ? { clientNote } : {}),
      ...(privateNote ? { privateNote } : {}),
    };
  });
  const label = trimOrUndefined(content.label);
  const coachNote = trimOrUndefined(content.coachNote);
  return {
    schema: 1,
    plannedDate: content.plannedDate,
    dayOrder: content.dayOrder,
    ...(label ? { label } : {}),
    title: content.title.trim(),
    focus: content.focus.trim(),
    ...(content.estimatedMinutes !== undefined
      ? { estimatedMinutes: content.estimatedMinutes }
      : {}),
    ...(coachNote ? { coachNote } : {}),
    items,
  };
}

function normalizeTarget(target: SetTarget): SetTarget {
  const note = trimOrUndefined(target.note);
  return {
    reps: target.reps,
    load: target.load,
    effort: target.effort,
    restSeconds: target.restSeconds,
    ...(target.tempo ? { tempo: target.tempo } : {}),
    ...(note ? { note } : {}),
  };
}

/** JSON estable (claves ordenadas): sirve para comparar contenidos y detectar reintentos. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sameContent = (a: SessionContent, b: SessionContent) =>
  canonicalJson(normalizeContent(a)) === canonicalJson(normalizeContent(b));

function repsIssues(reps: RepTarget, path: string): Issue[] {
  const L = CONTENT_LIMITS;
  switch (reps.kind) {
    case 'fixed':
      return isInt(reps.reps, L.reps.min, L.reps.max)
        ? []
        : [issue(`${path}.reps`, 'Las repeticiones deben ser un entero de 1 a 100.')];
    case 'range':
      if (!isInt(reps.min, L.reps.min, L.reps.max) || !isInt(reps.max, L.reps.min, L.reps.max)) {
        return [issue(path, 'El rango debe ir de 1 a 100 repeticiones.')];
      }
      return reps.min < reps.max
        ? []
        : [issue(path, 'En el rango, el mínimo debe ser menor que el máximo.')];
    case 'seconds':
      return inRange(reps.seconds, L.seconds.min, L.seconds.max)
        ? []
        : [issue(`${path}.seconds`, 'El tiempo debe estar entre 1 y 3600 s.')];
    case 'meters':
      return inRange(reps.meters, L.meters.min, L.meters.max)
        ? []
        : [issue(`${path}.meters`, 'La distancia debe estar entre 1 y 10 000 m.')];
  }
}

function targetIssues(target: Partial<SetTarget>, reps: RepTarget, path: string): Issue[] {
  const issues: Issue[] = [];
  if (target.reps) issues.push(...repsIssues(target.reps, `${path}.reps`));
  if (target.load) issues.push(...loadIssues(target.load, `${path}.load`));
  if (target.effort) issues.push(...effortIssues(target.effort, reps, `${path}.effort`));
  if (
    target.restSeconds !== undefined &&
    !isInt(target.restSeconds, CONTENT_LIMITS.restSeconds.min, CONTENT_LIMITS.restSeconds.max)
  ) {
    issues.push(issue(`${path}.restSeconds`, 'El descanso debe estar entre 0 y 30 minutos.'));
  }
  if (target.note !== undefined && target.note.trim().length > CONTENT_LIMITS.setNote) {
    issues.push(issue(`${path}.note`, 'La observación no puede superar 300 caracteres.'));
  }
  return issues;
}

export interface ValidationContext {
  /** Si la variante existe y el entrenador puede usarla. */
  isUsableVariant: (variantId: string) => boolean;
}

/**
 * Validación al GUARDAR: tipos y rangos (si falla, no se guarda). Un borrador puede estar
 * incompleto (sin ejercicios o sin objetivo), pero no puede contener valores imposibles.
 */
export function contentIssues(content: SessionContent, context: ValidationContext): Issue[] {
  const L = CONTENT_LIMITS;
  const issues: Issue[] = [];
  if (!isIsoDate(content.plannedDate)) issues.push(issue('plannedDate', 'La fecha no es válida.'));
  if (!isInt(content.dayOrder, 1, 20))
    issues.push(issue('dayOrder', 'El orden en el día no es válido.'));
  if (!textWithin(content.title, 1, L.title)) {
    issues.push(issue('title', 'El título es obligatorio y no puede superar 80 caracteres.'));
  }
  if (content.focus.trim().length > L.focus) {
    issues.push(issue('focus', 'El objetivo no puede superar 120 caracteres.'));
  }
  if (content.label !== undefined && content.label.trim().length > L.label) {
    issues.push(issue('label', 'El contexto no puede superar 40 caracteres.'));
  }
  if (
    content.estimatedMinutes !== undefined &&
    !isInt(content.estimatedMinutes, L.estimatedMinutes.min, L.estimatedMinutes.max)
  ) {
    issues.push(issue('estimatedMinutes', 'La duración debe ser un entero de 5 a 300 minutos.'));
  }
  if (content.coachNote !== undefined && content.coachNote.trim().length > L.coachNote) {
    issues.push(issue('coachNote', 'La nota no puede superar 500 caracteres.'));
  }
  if (content.items.length > L.items) {
    issues.push(issue('items', 'Una sesión admite como mucho 30 ejercicios.'));
  }
  const ids = new Set<string>();
  const closedBlocks = new Set<string>();
  [...content.items]
    .sort((a, b) => a.order - b.order)
    .forEach((item, index, sorted) => {
      const previous = sorted[index - 1];
      if (previous && previous.block !== item.block) closedBlocks.add(previous.block);
      if (closedBlocks.has(item.block)) {
        issues.push(
          issue(`items.${index}.block`, 'Los ejercicios de un mismo bloque deben ir seguidos.'),
        );
      }
    });
  content.items.forEach((item, index) => {
    const path = `items.${index}`;
    if (!textWithin(item.id, 1, 80) || ids.has(item.id)) {
      issues.push(issue(`${path}.id`, 'Identificador de ejercicio no válido o repetido.'));
    }
    ids.add(item.id);
    if (!context.isUsableVariant(item.variantId)) {
      issues.push(issue(`${path}.variantId`, 'Este ejercicio no existe en tu biblioteca.'));
    }
    if (!isInt(item.sets, L.sets.min, L.sets.max)) {
      issues.push(issue(`${path}.sets`, 'Las series deben ser un entero de 1 a 50.'));
    }
    issues.push(...targetIssues(item.defaults, item.defaults.reps, `${path}.defaults`));
    const seen = new Set<number>();
    item.perSet.forEach((override, overrideIndex) => {
      const overridePath = `${path}.perSet.${overrideIndex}`;
      if (!isInt(override.setNumber, 1, item.sets) || seen.has(override.setNumber)) {
        issues.push(issue(overridePath, 'Excepción de una serie que no existe o repetida.'));
      }
      seen.add(override.setNumber);
      issues.push(...targetIssues(override, override.reps ?? item.defaults.reps, overridePath));
    });
    if (item.clientNote !== undefined && item.clientNote.trim().length > L.clientNote) {
      issues.push(issue(`${path}.clientNote`, 'La observación no puede superar 300 caracteres.'));
    }
    if (item.privateNote !== undefined && item.privateNote.trim().length > L.privateNote) {
      issues.push(issue(`${path}.privateNote`, 'La nota privada no puede superar 500 caracteres.'));
    }
  });
  return issues;
}

/** Validación al PUBLICAR: además de la de guardar, que la sesión esté completa. */
export function publishIssues(content: SessionContent, context: ValidationContext): Issue[] {
  const issues = contentIssues(content, context);
  if (!textWithin(content.focus, 1, CONTENT_LIMITS.focus)) {
    issues.push(issue('focus', 'Indica el objetivo de la sesión: el cliente lo ve en «Hoy».'));
  }
  if (content.estimatedMinutes === undefined) {
    issues.push(
      issue('estimatedMinutes', 'Indica la duración aproximada: el cliente la ve en «Hoy».'),
    );
  }
  if (content.items.length === 0) {
    issues.push(issue('items', 'Añade al menos un ejercicio.'));
  }
  content.items.forEach((item, index) => {
    resolveSets(item).forEach((set) => {
      if (set.load.kind === 'percent_1rm' && !set.load.resolution) {
        issues.push(
          issue(
            `items.${index}.sets.${set.setNumber}.load`,
            'El %1RM necesita un 1RM de referencia del cliente para este ejercicio.',
          ),
        );
      }
    });
  });
  return issues;
}

/** Avisos que no impiden publicar (EFFORT_AND_LOAD.md §4.2 y V1_SPEC §5.2). */
export function publishWarnings(content: SessionContent, today: IsoDate): Issue[] {
  const warnings: Issue[] = [];
  if (isIsoDate(content.plannedDate) && content.plannedDate < today) {
    warnings.push(
      issue('plannedDate', 'La fecha ya ha pasado: el cliente la verá como pendiente de otro día.'),
    );
  }
  content.items.forEach((item, index) => {
    const sets = resolveSets(item);
    sets.forEach((set) => {
      const path = `items.${index}.sets.${set.setNumber}`;
      const rir = set.effort.kind === 'rir' ? set.effort.rir : null;
      const maxRir = rir === null ? null : typeof rir === 'number' ? rir : rir.max;
      if (maxRir !== null && maxRir >= 5) {
        warnings.push(
          issue(path, 'RIR de 5 o más: la estimación es menos precisa lejos del fallo.'),
        );
      }
      const maxReps =
        set.reps.kind === 'fixed' ? set.reps.reps : set.reps.kind === 'range' ? set.reps.max : 0;
      if (rir !== null && maxReps > 12) {
        warnings.push(
          issue(path, 'RIR con más de 12 repeticiones: la estimación es menos precisa.'),
        );
      }
    });
    const kinds = new Set(sets.map((s) => canonicalJson(s.effort)));
    if (sets.length > 2 && kinds.size > 1) {
      const counts = new Map<string, number>();
      sets.forEach((s) =>
        counts.set(canonicalJson(s.effort), (counts.get(canonicalJson(s.effort)) ?? 0) + 1),
      );
      if ([...counts.values()].some((n) => n === 1)) {
        warnings.push(
          issue(
            `items.${index}`,
            'Una serie tiene un esfuerzo distinto a las demás: comprueba que es intencionado.',
          ),
        );
      }
    }
  });
  return warnings;
}

// ── Versiones: bloqueos y resumen de cambios ─────────────────────────────────

export interface LoggedSetRef {
  prescriptionId: string;
  setNumber: number;
}

const setKey = (prescriptionId: string, setNumber: number) => `${prescriptionId}#${setNumber}`;

/**
 * Bloqueos al editar una sesión publicada (P-88): lo ya registrado no se puede cambiar.
 * - Las series con registro conservan exactamente su prescripción.
 * - Un ejercicio con registros no se quita ni cambia de variante, y sus series no bajan de la
 *   última registrada.
 */
export function lockIssues(
  base: SessionContent,
  next: SessionContent,
  logged: readonly LoggedSetRef[],
): Issue[] {
  const issues: Issue[] = [];
  const loggedByItem = new Map<string, number[]>();
  logged.forEach((ref) =>
    loggedByItem.set(ref.prescriptionId, [
      ...(loggedByItem.get(ref.prescriptionId) ?? []),
      ref.setNumber,
    ]),
  );
  for (const [itemId, setNumbers] of loggedByItem) {
    const before = base.items.find((i) => i.id === itemId);
    if (!before) continue;
    const afterIndex = next.items.findIndex((i) => i.id === itemId);
    const name = before.variantName ?? before.variantId;
    if (afterIndex === -1) {
      issues.push(issue('items', `«${name}» tiene series registradas: no se puede quitar.`));
      continue;
    }
    const after = next.items[afterIndex]!;
    const path = `items.${afterIndex}`;
    if (after.variantId !== before.variantId) {
      issues.push(
        issue(
          `${path}.variantId`,
          `«${name}» tiene series registradas: no se puede cambiar el ejercicio.`,
        ),
      );
    }
    const highest = Math.max(...setNumbers);
    if (after.sets < highest) {
      issues.push(
        issue(
          `${path}.sets`,
          `«${name}» tiene registrada la serie ${highest}: no puede tener menos series.`,
        ),
      );
    }
    const beforeSets = new Map(resolveSets(before).map((s) => [s.setNumber, s]));
    const afterSets = new Map(resolveSets(after).map((s) => [s.setNumber, s]));
    for (const setNumber of setNumbers) {
      const a = beforeSets.get(setNumber);
      const b = afterSets.get(setNumber);
      if (a && b && canonicalJson(a) !== canonicalJson(b)) {
        issues.push(
          issue(
            `${path}.sets.${setNumber}`,
            `La serie ${setNumber} de «${name}» ya está registrada: no se cambia.`,
          ),
        );
      }
    }
  }
  return issues;
}

export const lockedSetKeys = (logged: readonly LoggedSetRef[]) =>
  new Set(logged.map((ref) => setKey(ref.prescriptionId, ref.setNumber)));

const setText = (set: SetTarget) =>
  [
    formatRepTarget(set.reps),
    describeLoad(set.load),
    describeEffort(set.effort),
    set.restSeconds > 0 ? `descanso ${formatSeconds(set.restSeconds)}` : 'sin descanso',
    set.tempo ? `tempo ${formatTempo(set.tempo)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** Resumen de cambios en lenguaje claro entre dos versiones (o entre la vigente y un borrador). */
export function changeSummary(previous: SessionContent, next: SessionContent): ContentChange[] {
  const changes: ContentChange[] = [];
  const field = (label: string, a: unknown, b: unknown) => {
    if (canonicalJson(a ?? null) !== canonicalJson(b ?? null)) {
      changes.push({ text: `${label}: ${String(a ?? '—')} → ${String(b ?? '—')}` });
    }
  };
  field('Fecha prevista', previous.plannedDate, next.plannedDate);
  field('Contexto', previous.label, next.label);
  field('Título', previous.title, next.title);
  field('Objetivo', previous.focus, next.focus);
  field('Duración (min)', previous.estimatedMinutes, next.estimatedMinutes);
  field('Nota para el cliente', previous.coachNote, next.coachNote);

  const name = (item: SessionItem) => item.variantName ?? item.variantId;
  for (const item of previous.items) {
    if (!next.items.some((i) => i.id === item.id)) {
      changes.push({ itemId: item.id, text: `Ejercicio retirado: ${name(item)}` });
    }
  }
  for (const item of next.items) {
    const before = previous.items.find((i) => i.id === item.id);
    if (!before) {
      changes.push({
        itemId: item.id,
        text: `Ejercicio añadido: ${name(item)} (${item.sets} series)`,
      });
      continue;
    }
    if (before.variantId !== item.variantId) {
      changes.push({ itemId: item.id, text: `${name(before)} → ${name(item)}` });
    }
    if (before.order !== item.order) {
      changes.push({
        itemId: item.id,
        text: `${name(item)}: posición ${before.order} → ${item.order}`,
      });
    }
    if (before.sets !== item.sets) {
      changes.push({
        itemId: item.id,
        text: `${name(item)}: ${before.sets} → ${item.sets} series`,
      });
    }
    const beforeSets = new Map(resolveSets(before).map((s) => [s.setNumber, s]));
    for (const set of resolveSets(item)) {
      const old = beforeSets.get(set.setNumber);
      if (
        old &&
        canonicalJson({ ...old, setNumber: 0 }) !== canonicalJson({ ...set, setNumber: 0 })
      ) {
        changes.push({
          itemId: item.id,
          setNumber: set.setNumber,
          text: `${name(item)}, serie ${set.setNumber}: ${setText(old)} → ${setText(set)}`,
        });
      }
    }
    if ((before.clientNote ?? '') !== (item.clientNote ?? '')) {
      changes.push({
        itemId: item.id,
        text: `${name(item)}: observación para el cliente cambiada`,
      });
    }
    if ((before.privateNote ?? '') !== (item.privateNote ?? '')) {
      changes.push({
        itemId: item.id,
        text: `${name(item)}: nota privada cambiada`,
        trainerOnly: true,
      });
    }
  }
  return changes;
}
