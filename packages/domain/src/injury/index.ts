/**
 * Injury, readaptation and return to sport (restructure phase 7, docs/INJURY_MODULE.md).
 * LESIÓN → FASE → CRITERIOS → PROGRESIÓN → RETURN TO SPORT → RETURN TO PERFORMANCE.
 *
 * Pure rules. The software never diagnoses, never declares anyone fit («apto») and never moves a
 * case to the next phase by itself: the highest computed status is «Listo para valoración», the
 * trainer presses [Avanzar de fase] and the return-to-sport decision is recorded by a person.
 */
import type { BetterDirection } from '../assessment/aggregate';
import { interpretChange, type MeasurementError } from '../assessment/change';

export const BODY_REGIONS = {
  knee: 'Rodilla',
  hamstrings: 'Isquiosurales',
  adductors: 'Aductores / ingle',
  ankle: 'Tobillo',
  calf_achilles: 'Gemelo / Aquiles',
  quadriceps: 'Cuádriceps',
  hip: 'Cadera',
  lumbar: 'Columna lumbar',
  shoulder: 'Hombro',
  elbow: 'Codo',
  other: 'Otra',
} as const;
export type BodyRegion = keyof typeof BODY_REGIONS;

export const SIDES = {
  left: 'Izquierdo',
  right: 'Derecho',
  both: 'Ambos',
  none: 'No aplica',
} as const;

/**
 * Starting scaffold for a new protocol (§22): the 8 conceptual phases, never a universal protocol.
 * Each protocol removes, merges or renames phases and defines its own criteria.
 */
export const PHASE_SCAFFOLD = [
  'Control de síntomas y protección',
  'Movilidad y activación',
  'Fuerza básica',
  'Fuerza y capacidad de carga',
  'Potencia y pliometría',
  'Carrera, aceleración y cambios de dirección',
  'Tareas específicas del deporte',
  'Vuelta a la competición y al rendimiento',
] as const;

export type CriterionRole = 'entry' | 'success' | 'progression' | 'regression' | 'stop';
export const CRITERION_ROLES: Record<CriterionRole, string> = {
  entry: 'Entrada',
  success: 'Objetivo',
  progression: 'Progresión',
  regression: 'Regresión',
  stop: 'Parada',
};
export type CriterionEvidence = 'evidence' | 'consensus' | 'practical';
export const CRITERION_EVIDENCE: Record<CriterionEvidence, string> = {
  evidence: 'Con evidencia',
  consensus: 'Consenso de expertos',
  practical: 'Evidencia insuficiente / criterio práctico',
};

// ── Symptoms and safety alerts (§3) ───────────────────────────────────────────

export interface SymptomEntry {
  recordedOn: string;
  /** 0–10. */
  pain: number;
  worseThanBefore?: boolean;
  persistsNextDay?: boolean;
  functionLoss?: boolean;
  neurological?: boolean;
  swelling?: boolean;
  instability?: boolean;
  adverseReaction?: boolean;
}

export type SafetyAlertSeverity = 'review' | 'stop';
export interface SafetyAlert {
  kind:
    | 'pain_high'
    | 'worsening'
    | 'function_loss'
    | 'neurological'
    | 'swelling'
    | 'instability'
    | 'adverse_reaction';
  severity: SafetyAlertSeverity;
  message: string;
}

export const REVIEW = 'Revisar antes de progresar';
export const STOP_MESSAGE = 'Detener la progresión · Requiere valoración por profesional sanitario';

/**
 * Alerts raised by a symptom record. `painThreshold` comes from the protocol (default 5/10, a
 * practical criterion except where the protocol cites evidence, e.g. the pain-monitoring model
 * in Achilles tendinopathy). Worsening also compares with the previous record.
 */
export function symptomAlerts(
  s: SymptomEntry,
  previous: SymptomEntry | null,
  painThreshold = 5,
): SafetyAlert[] {
  const out: SafetyAlert[] = [];
  if (s.neurological)
    out.push({
      kind: 'neurological',
      severity: 'stop',
      message: `Síntomas neurológicos: ${STOP_MESSAGE}.`,
    });
  if (s.pain >= painThreshold)
    out.push({
      kind: 'pain_high',
      severity: 'review',
      message: `Dolor ${s.pain}/10 (umbral del protocolo ${painThreshold}/10): ${REVIEW}.`,
    });
  if (s.worseThanBefore || s.persistsNextDay || (previous && s.pain > previous.pain))
    out.push({
      kind: 'worsening',
      severity: 'review',
      message: `${s.persistsNextDay ? 'Síntomas que persisten al día siguiente' : 'Empeoramiento respecto al registro anterior'}: ${REVIEW}.`,
    });
  if (s.functionLoss)
    out.push({
      kind: 'function_loss',
      severity: 'review',
      message: `Pérdida importante de función: ${REVIEW} · Consultar con el profesional sanitario.`,
    });
  if (s.swelling)
    out.push({
      kind: 'swelling',
      severity: 'review',
      message: `Inflamación importante: ${REVIEW}.`,
    });
  if (s.instability)
    out.push({ kind: 'instability', severity: 'review', message: `Inestabilidad: ${REVIEW}.` });
  if (s.adverseReaction)
    out.push({
      kind: 'adverse_reaction',
      severity: 'review',
      message: `Reacción adversa a la sesión: ${REVIEW}.`,
    });
  return out;
}

// ── Criteria ─────────────────────────────────────────────────────────────────

export interface CriterionDef {
  id: string;
  role: CriterionRole;
  text: string;
  mandatory: boolean;
  /** Automatic when linked to a test: its value, or the limb symmetry index (LSI) of its sides. */
  auto: {
    testSlug: string;
    metric: 'value' | 'lsi';
    operator: '>=' | '<=';
    threshold: number;
  } | null;
}

/** Limb symmetry index: involved / uninvolved × 100 (for «higher is better» tests). */
export function lsi(involved: number, uninvolved: number, better: BetterDirection = 'higher') {
  if (!(involved > 0) || !(uninvolved > 0)) return null;
  return better === 'lower' ? (uninvolved / involved) * 100 : (involved / uninvolved) * 100;
}

export interface Measurement {
  /** Value of the test (sides: both), or the two sides. */
  value?: number | null;
  left?: number | null;
  right?: number | null;
  better: BetterDirection;
}

/**
 * Automatic check of a criterion from a measurement. `involvedSide` names the injured side for
 * the LSI. Returns null when the data needed is missing (never «met» by default).
 */
export function evaluateCriterion(
  c: CriterionDef,
  m: Measurement | null,
  involvedSide: 'left' | 'right' | 'both' | 'none',
): { met: boolean; value: number } | null {
  if (!c.auto || !m) return null;
  let v: number | null;
  if (c.auto.metric === 'value') v = m.value ?? null;
  else {
    if (m.left == null || m.right == null) return null;
    const [inv, unInv] =
      involvedSide === 'right'
        ? [m.right, m.left]
        : involvedSide === 'left'
          ? [m.left, m.right]
          : [Math.min(m.left, m.right), Math.max(m.left, m.right)];
    v = lsi(inv, unInv, m.better);
  }
  if (v == null || !Number.isFinite(v)) return null;
  const met = c.auto.operator === '>=' ? v >= c.auto.threshold : v <= c.auto.threshold;
  return { met, value: Math.round(v * 10) / 10 };
}

// ── Case status and phase advance (§4) ───────────────────────────────────────

export type CaseStatus =
  | 'not_started'
  | 'in_progress'
  | 'partial'
  | 'ready_for_assessment'
  | 'decision_pending'
  | 'closed';

/** Labels shown everywhere. There is deliberately no «apto». */
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  not_started: 'No iniciado',
  in_progress: 'En progreso',
  partial: 'Criterios parciales',
  ready_for_assessment: 'Listo para valoración',
  decision_pending: 'Decisión pendiente',
  closed: 'Cerrado',
};

export interface PhaseState {
  /** Index of the current phase (0-based), null when no phase was started. */
  phaseIndex: number | null;
  phasesCount: number;
  /** Mandatory progression criteria of the current phase: met or not (null = not checked). */
  mandatory: (boolean | null)[];
  /** Stop criteria of the current phase that are met (they block like an alert). */
  stopMet: number;
  openAlerts: number;
  decisionRequested: boolean;
  closed?: boolean;
}

export function canAdvance(s: PhaseState): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (s.closed) reasons.push('El caso está cerrado.');
  if (s.phaseIndex == null) reasons.push('Todavía no se ha iniciado ninguna fase.');
  else if (s.phaseIndex >= s.phasesCount - 1)
    reasons.push('Es la última fase: queda la valoración del equipo responsable.');
  if (s.openAlerts) reasons.push(`${s.openAlerts} alerta(s) de seguridad sin revisar: ${REVIEW}.`);
  if (s.stopMet) reasons.push('Hay un criterio de parada cumplido.');
  const pending = s.mandatory.filter((m) => m !== true).length;
  if (pending) reasons.push(`${pending} criterio(s) obligatorio(s) de progresión sin cumplir.`);
  return { allowed: reasons.length === 0, reasons };
}

export function caseStatus(s: PhaseState): CaseStatus {
  if (s.closed) return 'closed';
  if (s.phaseIndex == null) return 'not_started';
  const allMet = s.mandatory.length > 0 && s.mandatory.every((m) => m === true);
  const someMet = s.mandatory.some((m) => m === true);
  const last = s.phaseIndex >= s.phasesCount - 1;
  if (last && allMet && !s.openAlerts && !s.stopMet)
    return s.decisionRequested ? 'decision_pending' : 'ready_for_assessment';
  if (someMet && !allMet) return 'partial';
  return 'in_progress';
}

// ── Return-to-play checklist (§28) ────────────────────────────────────────────

export const RTP_ITEMS = {
  clinical: 'Criterios clínicos recibidos',
  load_tolerance: 'Tolerancia a carga',
  rom: 'ROM',
  strength: 'Fuerza',
  functional: 'Capacidad funcional',
  specific_tasks: 'Tareas específicas',
  running: 'Carrera',
  acceleration: 'Aceleración',
  deceleration: 'Desaceleración',
  cod: 'Cambio de dirección',
  sport_exposure: 'Exposición deportiva',
  full_training: 'Entrenamiento completo',
  athlete_feedback: 'Feedback del deportista',
  team_assessment: 'Valoración del equipo responsable',
} as const;
export type RtpItem = keyof typeof RTP_ITEMS;
export type RtpItemStatus = 'met' | 'pending' | 'not_applicable';

/**
 * The checklist from the criteria tagged with an item: met when all its criteria are met, pending
 * otherwise, «no aplica» when the protocol has no criterion for it. «Valoración del equipo»
 * is met only by a recorded decision.
 */
export function rtpChecklist(
  criteria: { item: RtpItem | null; met: boolean | null }[],
  decisionRecorded: boolean,
): { item: RtpItem; label: string; status: RtpItemStatus }[] {
  return (Object.keys(RTP_ITEMS) as RtpItem[]).map((item) => {
    if (item === 'team_assessment')
      return { item, label: RTP_ITEMS[item], status: decisionRecorded ? 'met' : 'pending' };
    const cs = criteria.filter((c) => c.item === item);
    const status: RtpItemStatus = !cs.length
      ? 'not_applicable'
      : cs.every((c) => c.met === true)
        ? 'met'
        : 'pending';
    return { item, label: RTP_ITEMS[item], status };
  });
}

// ── Return-to-sport decisions (human) ────────────────────────────────────────

export const RTP_STAGES = {
  return_to_participation: 'Vuelta a la participación',
  return_to_sport: 'Vuelta al deporte',
  return_to_performance: 'Vuelta al rendimiento',
} as const;
export type RtpStage = keyof typeof RTP_STAGES;
export const RTP_OUTCOMES = {
  authorized: 'Autorizada por el equipo responsable',
  not_yet: 'Todavía no',
  deferred: 'Aplazada hasta nueva valoración',
} as const;
export type RtpOutcome = keyof typeof RTP_OUTCOMES;

export function decisionText(d: {
  stage: RtpStage;
  outcome: RtpOutcome;
  decidedBy: string;
  role: string;
  decidedOn: string;
}): string {
  return `${RTP_STAGES[d.stage]}: ${RTP_OUTCOMES[d.outcome].toLowerCase()} (${d.decidedBy}, ${d.role}, ${d.decidedOn.split('-').reverse().join('/')}).`;
}

// ── Readaptation comparison (§25–§26) ────────────────────────────────────────

export type Reading = 'improves' | 'worsens' | 'stable' | 'no_data';
export const READING_LABELS: Record<Reading, string> = {
  improves: 'Mejora',
  worsens: 'Empeora',
  stable: 'Se mantiene',
  no_data: 'Sin datos',
};

/**
 * Reading of one variable between A and B: improves / worsens when the change exceeds the
 * measurement error (MDC) if known; within the error it stays; missing data is «sin datos».
 * Without a known error the direction is shown and flagged (`errorKnown: false`).
 */
export function readChange(
  a: number | null,
  b: number | null,
  better: BetterDirection,
  error: MeasurementError | null,
): { reading: Reading; delta: number | null; deltaPercent: number | null; errorKnown: boolean } {
  if (a == null || b == null)
    return { reading: 'no_data', delta: null, deltaPercent: null, errorKnown: !!error };
  const c = interpretChange(a, b, better, error);
  let reading: Reading;
  if (!error)
    reading =
      c.delta === 0 || better === 'target_range'
        ? 'stable'
        : c.delta > 0 === (better === 'higher')
          ? 'improves'
          : 'worsens';
  else if (c.verdict === 'probable_improvement') reading = 'improves';
  else if (c.verdict === 'probable_decline') reading = 'worsens';
  else reading = 'stable';
  return { reading, delta: c.delta, deltaPercent: c.deltaPercent, errorKnown: !!error };
}
