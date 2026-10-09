/**
 * Programming engine: adjustment proposals from the client's response (§12.2, §12.7, §13.7).
 * Pure. Nothing here changes a plan: it returns candidates that are stored as recommendations,
 * and only the trainer's acceptance applies them to future, not-yet-performed sessions.
 * All rules are practical (level F) and configurable; RIR is self-reported.
 */
import type { Explanation } from '../decision/types';
import { roundLoad } from '../planning/prescription';
import { addDays, DEFAULT_DELOAD, isoWeekday, type DeloadPolicy } from '../planning/structure';
import {
  doubleProgression,
  estimateOneRm,
  rirAdjustment,
  velocityAdjustment,
  VELOCITY_MARGIN_MPS,
  type LoggedSet,
} from '../planning/progression';

export type AdjustmentKind =
  'load_progression' | 'deload_week' | 'volume_reduction' | 'substitution' | 'reschedule';

/** A future session of the active plan, for availability-based moves (restructure phase 15). */
export interface PlanSessionSlot {
  sessionId: string;
  date: string;
  weekIndex: number;
  /** First day of its plan week: a session only moves inside its week (A51). */
  weekStart: string;
  name: string | null;
  /** Has logs or attendance: never moved, but its day is taken. */
  recorded: boolean;
}

/** A future planned exercise (snapshot of its values when the proposal was made). */
export interface PlannedTarget {
  sessionExerciseId: string;
  sessionId: string;
  date: string;
  weekIndex: number;
  exerciseId: string;
  exerciseName: string;
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  rirMin: number | null;
  rirMax: number | null;
  loadKg: number | null;
}

export interface ExerciseHistory {
  exerciseId: string;
  exerciseName: string;
  /** Equipment slugs, to pick the load increment. */
  equipment: string[];
  /** The centre's own increment for this exercise (phase 13); null = default by equipment. */
  incrementKg?: number | null;
  /** Performed sessions of this exercise, oldest first; RIR assumed (not reported) excluded. */
  sessions: {
    date: string;
    target: {
      repsMin: number | null;
      repsMax: number | null;
      rirMin: number | null;
      rirMax: number | null;
      loadKg: number | null;
      /** Prescribed mean velocity (m/s), for velocity-based progression (phase 14). */
      velocityTargetMps?: number | null;
    };
    sets: LoggedSet[];
  }[];
}

export interface ProgrammingInput {
  today: string;
  /** Future planned exercises of the active plan (sessions without logs, date ≥ today). */
  upcoming: PlannedTarget[];
  history: ExerciseHistory[];
  /** Open monitoring alerts (Phase 8) that suggest adjusting the load. */
  signals: {
    srpeHigh: boolean;
    wellnessLow: boolean;
    adherenceLow: boolean;
    partialSessions: boolean;
  };
  /** Per-exercise pain (only with health-data consent), recent window. */
  pains: { exerciseId: string; exerciseName: string; date: string; intensity: number }[];
  painThreshold: number;
  /** Options per exercise: pre-approved alternatives first, then library substitutes. */
  substitutes: Record<string, { id: string; name: string }[]>;
  deload?: DeloadPolicy;
  /** ISO weekdays the client can train (Ficha → Disponibilidad); empty = not stated. */
  availableWeekdays?: number[];
  /** Sessions of the active plan from today on (recorded or not). */
  sessions?: PlanSessionSlot[];
}

export interface AdjustmentParams {
  fromKg?: number;
  toKg?: number;
  setsDelta?: number;
  rirDelta?: number;
  toExerciseId?: string | null;
  /** Session moves of a `reschedule` proposal. */
  moves?: { sessionId: string; from: string; to: string }[];
}

export interface AdjustmentCandidate {
  /** Stable key: the same situation is not proposed twice while pending or recently rejected. */
  key: string;
  kind: AdjustmentKind;
  title: string;
  params: AdjustmentParams;
  targets: PlannedTarget[];
  options?: { id: string; name: string }[];
  explanation: Explanation;
}

export interface ExerciseChange {
  /** Empty for a session change (`scheduledDate`), which uses `sessionId`. */
  sessionExerciseId: string;
  sessionId?: string;
  field: 'loadKg' | 'sets' | 'rirMin' | 'rirMax' | 'exerciseId' | 'scheduledDate';
  from: number | string | null;
  to: number | string | null;
}

const day = (iso: string) => iso.split('-').reverse().join('/');
const WEEKDAY = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const dayName = (iso: string) => `${WEEKDAY[isoWeekday(iso)]} ${day(iso)}`;
const kg = (n: number) => `${n.toLocaleString('es-ES')} kg`;
const mps = (n: number) => `${n.toFixed(2).replace('.', ',')} m/s`;

/** Smallest practical load jump by equipment (level F); a centre can set its own per exercise. */
export function loadIncrementFor(equipment: string[]): number {
  if (equipment.some((e) => e.includes('barbell') || e.includes('barra') || e === 'smith_machine'))
    return 2.5;
  if (equipment.some((e) => e.includes('dumbbell') || e.includes('mancuerna'))) return 2;
  if (equipment.some((e) => e.includes('machine') || e.includes('cable') || e.includes('polea')))
    return 2.5;
  return 1;
}

/**
 * Auto-apply only takes steps no larger than the platform's increment for the equipment
 * (restructure phase 18): a centre's larger increment, or a bigger velocity/RIR change, stays a
 * proposal for the trainer to decide.
 */
export function isStandardLoadStep(fromKg: number, toKg: number, equipment: string[]): boolean {
  return Math.abs(toKg - fromKg) <= loadIncrementFor(equipment) + 1e-9;
}

/**
 * Week-to-week load proposal for one exercise from its logged sessions: RIR adjustment over the
 * last 2 sessions first (it can go down as well), then double progression on the last session.
 */
export function proposeLoadChange(h: ExerciseHistory) {
  const last = h.sessions.at(-1);
  if (!last || last.target.loadKg == null) return null;
  const inc = h.incrementKg && h.incrementKg > 0 ? h.incrementKg : loadIncrementFor(h.equipment);
  // Velocity first (phase 14): when a target velocity is prescribed and velocity was measured,
  // it is the most direct sign of how heavy the load was for the person on the day.
  const vTarget = last.target.velocityTargetMps;
  if (vTarget != null) {
    const vel = h.sessions
      .map((s) => s.sets.map((x) => x.meanVelocityMps).filter((x): x is number => x != null))
      .filter((xs) => xs.length)
      .map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
    if (vel.length >= 2) {
      const r = velocityAdjustment(
        { velocityTargetMps: vTarget, loadKg: last.target.loadKg },
        vel,
        inc,
      );
      if (r.action !== 'hold') return { ...r, rule: 'velocity_target' as const, increment: inc };
    }
  }
  const rir = h.sessions
    .map((s) => s.sets.map((x) => x.rir).filter((x): x is number => x != null))
    .filter((xs) => xs.length)
    .map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
  if (last.target.rirMin != null && last.target.rirMax != null) {
    const r = rirAdjustment(
      { rirMin: last.target.rirMin, rirMax: last.target.rirMax, loadKg: last.target.loadKg },
      rir,
      inc,
    );
    if (r.action !== 'hold') return { ...r, rule: 'rir_adjustment' as const, increment: inc };
  }
  // Double progression needs a range of reps (6–8); fixed reps are progressed by RIR or by hand.
  if (
    last.target.repsMax != null &&
    last.target.repsMin != null &&
    last.target.repsMin < last.target.repsMax
  ) {
    const r = doubleProgression(
      { repsMax: last.target.repsMax, rirMin: last.target.rirMin, loadKg: last.target.loadKg },
      last.sets,
      inc,
    );
    if (r.action !== 'hold') return { ...r, rule: 'double_progression' as const, increment: inc };
  }
  return null;
}

/** The changes a proposal makes, recomputed from its targets and (possibly edited) parameters. */
export function changesFor(
  kind: AdjustmentKind,
  params: AdjustmentParams,
  targets: PlannedTarget[],
): ExerciseChange[] {
  const out: ExerciseChange[] = [];
  if (kind === 'reschedule')
    return (params.moves ?? [])
      .filter((m) => m.to !== m.from)
      .map((m) => ({
        sessionExerciseId: '',
        sessionId: m.sessionId,
        field: 'scheduledDate' as const,
        from: m.from,
        to: m.to,
      }));
  for (const t of targets) {
    if (kind === 'load_progression' && t.loadKg != null && params.toKg != null) {
      const delta = params.toKg - (params.fromKg ?? t.loadKg);
      const to = roundLoad(t.loadKg + delta, 0.5);
      if (to !== t.loadKg)
        out.push({ sessionExerciseId: t.sessionExerciseId, field: 'loadKg', from: t.loadKg, to });
    }
    if (kind === 'deload_week') {
      const setsDelta = params.setsDelta ?? DEFAULT_DELOAD.setsDelta;
      const rirDelta = params.rirDelta ?? DEFAULT_DELOAD.rirDelta;
      if (t.sets != null && setsDelta) {
        const to = Math.max(1, t.sets + setsDelta);
        if (to !== t.sets)
          out.push({ sessionExerciseId: t.sessionExerciseId, field: 'sets', from: t.sets, to });
      }
      if (rirDelta) {
        if (t.rirMin != null)
          out.push({
            sessionExerciseId: t.sessionExerciseId,
            field: 'rirMin',
            from: t.rirMin,
            to: Math.min(10, t.rirMin + rirDelta),
          });
        if (t.rirMax != null)
          out.push({
            sessionExerciseId: t.sessionExerciseId,
            field: 'rirMax',
            from: t.rirMax,
            to: Math.min(10, t.rirMax + rirDelta),
          });
      }
    }
    if (kind === 'volume_reduction' && t.sets != null && t.sets >= 3) {
      const to = Math.max(2, t.sets + (params.setsDelta ?? -1));
      if (to !== t.sets)
        out.push({ sessionExerciseId: t.sessionExerciseId, field: 'sets', from: t.sets, to });
    }
    if (kind === 'substitution' && params.toExerciseId && params.toExerciseId !== t.exerciseId)
      out.push({
        sessionExerciseId: t.sessionExerciseId,
        field: 'exerciseId',
        from: t.exerciseId,
        to: params.toExerciseId,
      });
  }
  return out;
}

const practical = (
  proposal: string,
  data: string[],
  interpretation: string[],
  ruleKey: string,
  limitations: string[],
  confidence: Explanation['confidence'] = 'low',
): Explanation => ({
  proposal,
  data,
  interpretation,
  rules: [{ key: ruleKey, version: 1 }],
  evidence: [],
  applicability: [],
  limitations,
  confidence,
});

/** The first week whose sessions are all still ahead, excluding planned deload/taper weeks. */
function nextWeek(input: ProgrammingInput) {
  const weeks = [...new Set(input.upcoming.map((t) => t.weekIndex))].sort((a, b) => a - b);
  for (const w of weeks) {
    const ts = input.upcoming.filter((t) => t.weekIndex === w);
    if (ts.every((t) => t.date > input.today)) return { weekIndex: w, targets: ts };
  }
  return null;
}

/** Every adjustment the client's recent response suggests. Deterministic order. */
export function proposeAdjustments(input: ProgrammingInput): AdjustmentCandidate[] {
  const out: AdjustmentCandidate[] = [];
  const horizon = (d: string) => d <= addDays(input.today, 14);

  // 1. Week-to-week load (per exercise).
  for (const h of [...input.history].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))) {
    const r = proposeLoadChange(h);
    if (!r || r.fromKg == null || r.toKg == null) continue;
    const targets = input.upcoming.filter(
      (t) => t.exerciseId === h.exerciseId && t.loadKg != null && horizon(t.date),
    );
    if (!targets.length) continue;
    const last = h.sessions.at(-1)!;
    const e1rm = estimateOneRm(last.sets);
    const up = r.action === 'increase_load';
    out.push({
      key: `load:${h.exerciseId}:${last.date}`,
      kind: 'load_progression',
      title: `${h.exerciseName}: ${up ? 'subir' : 'bajar'} de ${kg(r.fromKg)} a ${kg(r.toKg)}`,
      params: { fromKg: r.fromKg, toKg: r.toKg },
      targets,
      explanation: practical(
        `${up ? 'Subir' : 'Bajar'} ${kg(Math.abs(r.toKg - r.fromKg))} en ${h.exerciseName} en las próximas ${targets.length} sesiones.`,
        [
          `Última sesión (${day(last.date)}): ${last.sets.map((s) => `${s.reps}${s.loadKg != null ? ` × ${kg(s.loadKg)}` : ''}${s.rir != null ? ` @RIR ${s.rir}` : ''}${s.meanVelocityMps != null ? ` a ${mps(s.meanVelocityMps)}` : ''}`).join(', ')}.`,
          `Objetivo: ${last.target.repsMin ?? '?'}–${last.target.repsMax ?? '?'} repeticiones${last.target.rirMin != null ? ` @RIR ${last.target.rirMin}–${last.target.rirMax}` : ''}${last.target.velocityTargetMps != null ? ` a ${mps(last.target.velocityTargetMps)}` : ''} con ${kg(last.target.loadKg!)}.`,
          `Sesiones registradas de este ejercicio: ${h.sessions.length}.`,
          ...(e1rm
            ? [
                `1RM estimado (orientativo): ${kg(e1rm.kg)}, de ${kg(e1rm.loadKg)} con ${e1rm.repsToFailure} repeticiones hasta el fallo (hechas + RIR).`,
              ]
            : []),
        ],
        [r.reason],
        r.rule === 'velocity_target'
          ? 'progression.velocity_target'
          : r.rule === 'rir_adjustment'
            ? 'progression.rir_adjustment'
            : 'progression.double_progression',
        [
          ...(r.rule === 'velocity_target'
            ? [
                'La velocidad refleja bien la carga relativa en press de banca; en otros ejercicios y con otros sensores la precisión varía: revisa que el sensor y la técnica sean los de siempre.',
                `Margen práctico (nivel F): se cambia la carga solo si la velocidad se aleja más de ${mps(VELOCITY_MARGIN_MPS)} del objetivo en 2 sesiones seguidas.`,
              ]
            : []),
          ...(e1rm
            ? [
                'El 1RM estimado es orientativo: ecuación práctica (nivel F), solo con series de hasta 10 repeticiones hasta el fallo y RIR informado; no sustituye a un 1RM medido.',
              ]
            : []),
          h.incrementKg
            ? `Regla práctica (nivel F) de los cuadernos de entrenamiento; incremento del centro para este ejercicio: ${kg(h.incrementKg)}.`
            : 'Regla práctica (nivel F) de los cuadernos de entrenamiento; el incremento depende del material.',
          'El RIR es autoinformado y menos preciso lejos del fallo.',
          'Se aplica sobre la carga planificada de cada sesión (respeta la progresión ya prevista).',
        ],
      ),
    });
  }

  // 2. Response: deload (load signals) or volume reduction (adherence signals) for next week.
  const nw = nextWeek(input);
  const policy = input.deload ?? DEFAULT_DELOAD;
  if (nw && (input.signals.srpeHigh || input.signals.wellnessLow)) {
    const why = [
      ...(input.signals.srpeHigh
        ? [
            'RPE de la sesión por encima de lo previsto en varias sesiones seguidas (alerta abierta).',
          ]
        : []),
      ...(input.signals.wellnessLow
        ? ['Bienestar diario bajo varios días seguidos (alerta abierta).']
        : []),
    ];
    out.push({
      key: `deload:${nw.weekIndex}`,
      kind: 'deload_week',
      title: `Semana ${nw.weekIndex} como descarga (${policy.setsDelta} serie, RIR +${policy.rirDelta})`,
      params: { setsDelta: policy.setsDelta, rirDelta: policy.rirDelta },
      targets: nw.targets,
      explanation: practical(
        `Convertir la semana ${nw.weekIndex} en semana de descarga.`,
        why,
        ['La respuesta reciente sugiere bajar la carga una semana antes de seguir progresando.'],
        'progression.response_deload',
        [
          'Descarga práctica (nivel F): −1 serie y RIR +2 por defecto, configurable.',
          'El consenso sobre la descarga está pendiente de verificar [REQUIERE VERIFICACIÓN].',
          'Conviene preguntar al cliente por sueño, estrés o trabajo antes de decidir.',
        ],
      ),
    });
  } else if (nw && (input.signals.adherenceLow || input.signals.partialSessions)) {
    const why = [
      ...(input.signals.adherenceLow
        ? ['Adherencia por debajo del umbral del centro (alerta abierta).']
        : []),
      ...(input.signals.partialSessions
        ? ['Varias sesiones registradas como parciales (alerta abierta).']
        : []),
    ];
    const targets = nw.targets.filter((t) => (t.sets ?? 0) >= 3);
    if (targets.length)
      out.push({
        key: `volume:${nw.weekIndex}`,
        kind: 'volume_reduction',
        title: `Semana ${nw.weekIndex}: una serie menos en los ejercicios de 3 o más series`,
        params: { setsDelta: -1 },
        targets,
        explanation: practical(
          `Reducir el volumen de la semana ${nw.weekIndex} para que las sesiones sean más fáciles de completar.`,
          why,
          ['Sesiones más cortas y asumibles antes de volver al volumen previsto.'],
          'progression.response_volume',
          [
            'Regla práctica (nivel F).',
            'La adherencia depende de muchos factores: conviene preguntar al cliente el motivo.',
          ],
        ),
      });
  }

  // 3. Availability: sessions planned on days the client cannot train (restructure phase 15).
  out.push(...proposeReschedules(input));

  // 4. Per-exercise pain → substitution with pre-approved alternatives or library substitutes.
  const painBy = new Map<string, ProgrammingInput['pains']>();
  for (const p of input.pains.filter((x) => x.intensity >= input.painThreshold))
    painBy.set(p.exerciseId, [...(painBy.get(p.exerciseId) ?? []), p]);
  for (const [exerciseId, ps] of [...painBy].sort(([a], [b]) => a.localeCompare(b))) {
    const targets = input.upcoming.filter((t) => t.exerciseId === exerciseId);
    const options = (input.substitutes[exerciseId] ?? []).filter((o) => o.id !== exerciseId);
    if (!targets.length || !options.length) continue;
    const last = [...ps].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
    out.push({
      key: `substitution:${exerciseId}:${last.date}`,
      kind: 'substitution',
      title: `Sustituir ${last.exerciseName} por ${options[0]!.name}`,
      params: { toExerciseId: options[0]!.id },
      targets,
      options,
      explanation: practical(
        `Sustituir ${last.exerciseName} en las ${targets.length} sesiones previstas mientras haya molestias.`,
        ps.map(
          (p) => `Molestias declaradas en ${p.exerciseName} el ${day(p.date)}: ${p.intensity}/10.`,
        ),
        [
          'Cambiar el ejercicio por una alternativa del mismo patrón mientras se resuelven las molestias.',
          'No es un diagnóstico. Si las molestias persisten o aumentan: requiere valoración por profesional sanitario.',
        ],
        'progression.pain_substitution',
        [
          'Las alternativas preaprobadas por el entrenador van primero.',
          'El dolor es autoinformado.',
        ],
      ),
    });
  }
  return out;
}

/** How far ahead availability moves are proposed (the same window as load progressions). */
export const RESCHEDULE_HORIZON_DAYS = 14;

/**
 * Sessions planned on a weekday the client cannot train → move each one, inside its own plan week,
 * to the nearest free day the client can (later day on a tie). Never today or a past day, never a
 * recorded session, never onto a day that already has a session. Sessions that do not fit are
 * listed for the trainer (frequency is their decision: the engine never deletes a session).
 */
export function proposeReschedules(input: ProgrammingInput): AdjustmentCandidate[] {
  const avail = new Set(input.availableWeekdays ?? []);
  const all = input.sessions ?? [];
  if (!avail.size || !all.length) return [];
  const until = addDays(input.today, RESCHEDULE_HORIZON_DAYS);
  const availKey = [...avail].sort((a, b) => a - b).join('');
  const days = [...avail]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY[d])
    .join(', ');
  const out: AdjustmentCandidate[] = [];
  const weeks = [...new Set(all.map((x) => x.weekIndex))].sort((a, b) => a - b);
  for (const w of weeks) {
    const inWeek = all.filter((x) => x.weekIndex === w);
    const misplaced = inWeek
      .filter(
        (x) =>
          !x.recorded && x.date > input.today && x.date <= until && !avail.has(isoWeekday(x.date)),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!misplaced.length) continue;
    const moving = new Set(misplaced.map((x) => x.sessionId));
    const busy = new Set(inWeek.filter((x) => !moving.has(x.sessionId)).map((x) => x.date));
    const start = inWeek[0]!.weekStart;
    const free = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter(
      (d) => d > input.today && avail.has(isoWeekday(d)) && !busy.has(d),
    );
    const moves: { sessionId: string; from: string; to: string }[] = [];
    const unplaced: PlanSessionSlot[] = [];
    for (const x of misplaced) {
      const dist = (d: string) => Math.abs(Date.parse(d) - Date.parse(x.date));
      const best = [...free].sort((a, b) => dist(a) - dist(b) || b.localeCompare(a))[0];
      if (!best) {
        unplaced.push(x);
        continue;
      }
      free.splice(free.indexOf(best), 1);
      moves.push({ sessionId: x.sessionId, from: x.date, to: best });
    }
    if (!moves.length) continue;
    const label = (x: { sessionId: string }) => {
      const n = all.find((y) => y.sessionId === x.sessionId)?.name;
      return n ? `«${n}»` : 'Sesión';
    };
    const ids = new Set(moves.map((m) => m.sessionId));
    out.push({
      key: `schedule:${w}:${availKey}`,
      kind: 'reschedule',
      title: `Semana ${w}: ${
        moves.length === 1 ? 'mover 1 sesión' : `mover ${moves.length} sesiones`
      } a días disponibles`,
      params: { moves },
      targets: input.upcoming.filter((t) => ids.has(t.sessionId)),
      explanation: practical(
        `Pasar ${moves.length === 1 ? 'la sesión' : `las ${moves.length} sesiones`} de la semana ${w} que caen en días sin disponibilidad a días en los que el cliente sí puede entrenar.`,
        [
          `Disponibilidad del cliente: ${days}.`,
          ...moves.map((m) => `${label(m)}: ${dayName(m.from)} → ${dayName(m.to)}.`),
          ...unplaced.map(
            (x) => `${label(x)} del ${dayName(x.date)}: no cabe en ningún día libre de esa semana.`,
          ),
        ],
        [
          'Las sesiones previstas en días que el cliente no puede entrenar probablemente no se harán.',
          ...(unplaced.length
            ? [
                'La semana tiene más sesiones que días disponibles: decide si se reduce la frecuencia o se juntan sesiones (el motor nunca borra sesiones).',
              ]
            : []),
        ],
        'schedule.availability',
        [
          'Regla práctica (nivel F): el día más cercano dentro de la misma semana del plan.',
          'La disponibilidad es la de la ficha del cliente; si ha cambiado, actualízala.',
          'Revisa el orden si quedan sesiones exigentes en días seguidos.',
          'Solo se mueven sesiones sin registro y nunca a hoy ni a un día pasado.',
        ],
      ),
    });
  }
  return out;
}
