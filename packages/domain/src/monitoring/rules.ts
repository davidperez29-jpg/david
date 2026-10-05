/**
 * Monitoring alert rules (MASTER_SPECIFICATION §13.7). Rules are data: every threshold is a
 * configurable parameter (practical recommendations, evidence level F unless stated). Alerts
 * DESCRIBE what happened ("dolor 6/10 declarado en rodilla dos sesiones seguidas"); they never
 * diagnose. Red pain alerts carry the referral text.
 */
import { REFERRAL_TEXT } from '../clients/health';
import { addDays } from '../planning/structure';
import {
  adherence,
  dueSessions,
  wellnessScore,
  type AttendanceStatus,
  type ReadinessEntry,
} from './metrics';

export type AlertSeverity = 'green' | 'yellow' | 'red';

export interface RuleDefinition {
  key: string;
  name: string;
  description: string;
  /** Parameter → [default, label, min, max]. */
  parameters: Record<string, [number, string, number, number]>;
}

export const MONITORING_RULES: RuleDefinition[] = [
  {
    key: 'adherence_low',
    name: 'Adherencia baja',
    description: 'Porcentaje de sesiones realizadas sobre las planificadas en la ventana.',
    parameters: {
      windowDays: [28, 'Ventana (días)', 7, 90],
      yellowBelow: [80, '🟡 por debajo de (%)', 1, 100],
      redBelow: [60, '🔴 por debajo de (%)', 0, 100],
      minPlanned: [4, 'Mínimo de sesiones planificadas para evaluar', 1, 50],
    },
  },
  {
    key: 'missed_in_a_row',
    name: 'Sesiones no realizadas seguidas',
    description: 'Sesiones pasadas seguidas sin realizar y sin motivo indicado.',
    parameters: { count: [2, 'Sesiones seguidas', 1, 10] },
  },
  {
    key: 'partial_sessions',
    name: 'Sesiones incompletas',
    description: 'Sesiones registradas como parciales en la ventana.',
    parameters: {
      count: [3, 'Sesiones parciales', 1, 20],
      windowDays: [14, 'Ventana (días)', 7, 60],
    },
  },
  {
    key: 'srpe_high',
    name: 'RPE de sesión elevado',
    description:
      'RPE de la sesión por encima de lo previsto en varias sesiones seguidas. Sin RPE previsto, se compara con la mediana personal de las sesiones anteriores.',
    parameters: {
      delta: [2, 'Puntos por encima', 1, 5],
      sessions: [3, 'Sesiones seguidas', 2, 10],
    },
  },
  {
    key: 'rir_off_target',
    name: 'RIR distinto del objetivo',
    description:
      'RIR registrado fuera del rango objetivo en varias sesiones del mismo ejercicio: propuesta de ajuste de carga (no se aplica sola).',
    parameters: {
      delta: [2, 'Diferencia de RIR', 1, 5],
      sessions: [2, 'Sesiones', 2, 10],
      windowDays: [28, 'Ventana (días)', 7, 90],
    },
  },
  {
    key: 'performance_drop',
    name: 'Descenso de rendimiento',
    description: 'Un test empeora más que su error de medida (veredicto «empeoramiento probable»).',
    parameters: { windowDays: [42, 'Evaluaciones de los últimos (días)', 7, 365] },
  },
  {
    key: 'pain',
    name: 'Dolor o molestias',
    description:
      'Dolor declarado (solo con consentimiento de datos de salud). Rojo si es intenso o se repite en la misma zona en sesiones seguidas, con derivación a un profesional sanitario.',
    parameters: {
      yellowFrom: [4, '🟡 desde (0–10)', 1, 10],
      redFrom: [7, '🔴 desde (0–10)', 1, 10],
      consecutive: [2, '🔴 si se repite en sesiones seguidas', 2, 5],
      windowDays: [14, 'Ventana (días)', 7, 60],
    },
  },
  {
    key: 'wellness_low',
    name: 'Bienestar bajo',
    description: 'Puntuación de bienestar diario por debajo del umbral varios días seguidos.',
    parameters: { threshold: [4, 'Umbral (0–10)', 1, 9], days: [3, 'Días seguidos', 2, 14] },
  },
  {
    key: 'feedback_missing',
    name: 'Sesión sin valoración',
    description: 'Sesión completada sin RPE de la sesión: recordatorio.',
    parameters: { windowDays: [7, 'Ventana (días)', 1, 30] },
  },
  {
    key: 'reassessment_overdue',
    name: 'Reevaluación vencida',
    description: 'Semana de evaluación del plan ya pasada sin una evaluación registrada.',
    parameters: { graceDays: [3, 'Días de margen', 0, 30] },
  },
];

export interface RuleConfig {
  key: string;
  enabled: boolean;
  parameters: Record<string, number>;
}

/** Defaults merged with the organization's configuration (unknown keys and parameters ignored). */
export function resolveRules(overrides: Partial<RuleConfig>[] = []): RuleConfig[] {
  return MONITORING_RULES.map((def) => {
    const o = overrides.find((x) => x.key === def.key);
    const parameters: Record<string, number> = {};
    for (const [p, [dflt, , min, max]] of Object.entries(def.parameters)) {
      const v = o?.parameters?.[p];
      parameters[p] =
        typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : dflt;
    }
    return { key: def.key, enabled: o?.enabled ?? true, parameters };
  });
}

/** Validation for the rule editor: returns errors per `key.parameter`. */
export function validateRuleConfig(c: RuleConfig[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of c) {
    const def = MONITORING_RULES.find((d) => d.key === r.key);
    if (!def) {
      out[r.key] = ['Regla desconocida.'];
      continue;
    }
    for (const [p, v] of Object.entries(r.parameters)) {
      const spec = def.parameters[p];
      if (!spec) (out[`${r.key}.${p}`] ??= []).push('Parámetro desconocido.');
      else if (!Number.isFinite(v) || v < spec[2] || v > spec[3])
        (out[`${r.key}.${p}`] ??= []).push(`Entre ${spec[2]} y ${spec[3]}.`);
    }
    if (r.key === 'adherence_low' && r.parameters.redBelow! > r.parameters.yellowBelow!)
      (out['adherence_low.redBelow'] ??= []).push('Debe ser menor o igual que el umbral amarillo.');
    if (r.key === 'pain' && r.parameters.redFrom! < r.parameters.yellowFrom!)
      (out['pain.redFrom'] ??= []).push('Debe ser mayor o igual que el umbral amarillo.');
  }
  return out;
}

// ── Evaluation ────────────────────────────────────────────────────────────────

export interface MonitoredSession {
  id: string;
  date: string;
  title: string;
  status: AttendanceStatus | null;
  reasonCode: string | null;
  sessionRpe: number | null;
  targetRpe: number | null;
}
export interface MonitoredSet {
  sessionId: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  rir: number | null;
  rirMin: number | null;
  rirMax: number | null;
}
export interface MonitoredPain {
  date: string;
  sessionId: string | null;
  /** Body region or exercise the client named. */
  where: string;
  intensity: number;
}
export interface MonitoredDecline {
  testId: string;
  testName: string;
  date: string;
}
export interface MonitoredReassessment {
  id: string;
  weekIndex: number;
  /** Last day of the assessment week. */
  dueDate: string;
  assessed: boolean;
}

export interface MonitoringInput {
  today: string;
  /** Published sessions of the client's plans, any date. */
  sessions: MonitoredSession[];
  sets: MonitoredSet[];
  /** Only present when the client consented to health data. */
  pains: MonitoredPain[];
  readiness: ReadinessEntry[];
  declines: MonitoredDecline[];
  reassessments: MonitoredReassessment[];
}

export interface AlertCandidate {
  ruleKey: string;
  /** Stable key: the same situation updates one alert instead of creating many. */
  key: string;
  severity: AlertSeverity;
  message: string;
  data: Record<string, unknown>;
}

const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type Evaluator = (i: MonitoringInput, p: Record<string, number>) => AlertCandidate[];

const EVALUATORS: Record<string, Evaluator> = {
  adherence_low(i, p) {
    const from = addDays(i.today, -(p.windowDays! - 1));
    const a = adherence(dueSessions(i.sessions, i.today), from, i.today);
    if (a.percent == null || a.planned < p.minPlanned!) return [];
    const severity: AlertSeverity | null =
      a.percent < p.redBelow! ? 'red' : a.percent < p.yellowBelow! ? 'yellow' : null;
    if (!severity) return [];
    return [
      {
        ruleKey: 'adherence_low',
        key: 'adherence_low',
        severity,
        message: `Adherencia del ${a.percent.toLocaleString('es-ES')} % en los últimos ${p.windowDays} días (${a.done} de ${a.planned} sesiones).`,
        data: { ...a, windowDays: p.windowDays },
      },
    ];
  },

  missed_in_a_row(i, p) {
    // Past sessions, most recent first; today's session is still open.
    const past = i.sessions
      .filter(
        (s) =>
          s.date < i.today && s.status !== 'rescheduled' && s.status !== 'cancelled_by_trainer',
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const run: MonitoredSession[] = [];
    for (const s of past) {
      const missedNoReason = s.status == null || (s.status === 'missed' && !s.reasonCode);
      if (!missedNoReason) break;
      run.push(s);
    }
    if (run.length < p.count!) return [];
    return [
      {
        ruleKey: 'missed_in_a_row',
        key: `missed_in_a_row:${run[run.length - 1]!.id}`,
        severity: 'yellow',
        message: `${run.length} sesiones seguidas sin realizar y sin motivo (la última, ${fmt(run[0]!.date)}).`,
        data: { sessions: run.map((s) => ({ id: s.id, date: s.date })) },
      },
    ];
  },

  partial_sessions(i, p) {
    const from = addDays(i.today, -(p.windowDays! - 1));
    const partial = i.sessions.filter(
      (s) => s.status === 'partial' && s.date >= from && s.date <= i.today,
    );
    if (partial.length < p.count!) return [];
    return [
      {
        ruleKey: 'partial_sessions',
        key: 'partial_sessions',
        severity: 'yellow',
        message: `${partial.length} sesiones incompletas en los últimos ${p.windowDays} días.`,
        data: { sessions: partial.map((s) => ({ id: s.id, date: s.date })) },
      },
    ];
  },

  srpe_high(i, p) {
    const rated = i.sessions
      .filter(
        (s) =>
          s.sessionRpe != null &&
          s.date <= i.today &&
          (s.status === 'completed' || s.status === 'partial'),
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const n = p.sessions!;
    if (rated.length < n) return [];
    const last = rated.slice(-n);
    const before = rated
      .slice(0, -n)
      .slice(-6)
      .map((s) => s.sessionRpe!);
    const baseline = before.length >= 3 ? median(before) : null;
    const over = last.every((s) => {
      const target = s.targetRpe ?? baseline;
      return target != null && s.sessionRpe! >= target + p.delta!;
    });
    if (!over) return [];
    const usesTarget = last.every((s) => s.targetRpe != null);
    return [
      {
        ruleKey: 'srpe_high',
        key: 'srpe_high',
        severity: 'yellow',
        message: `RPE de la sesión ${last.map((s) => s.sessionRpe).join(', ')} en las últimas ${n} sesiones: ${p.delta} o más puntos por encima de ${usesTarget ? 'lo previsto' : `su mediana habitual (${baseline})`}.`,
        data: {
          sessions: last.map((s) => ({
            id: s.id,
            date: s.date,
            sessionRpe: s.sessionRpe,
            targetRpe: s.targetRpe,
          })),
          baseline,
        },
      },
    ];
  },

  rir_off_target(i, p) {
    const from = addDays(i.today, -(p.windowDays! - 1));
    const sets = i.sets.filter(
      (s) => s.date >= from && s.rir != null && (s.rirMin != null || s.rirMax != null),
    );
    const byExercise = new Map<string, MonitoredSet[]>();
    for (const s of sets)
      byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
    const out: AlertCandidate[] = [];
    for (const [exerciseId, xs] of byExercise) {
      const perSession = new Map<string, MonitoredSet[]>();
      for (const s of xs) perSession.set(s.sessionId, [...(perSession.get(s.sessionId) ?? []), s]);
      const verdicts = [...perSession.values()].map((ss) => {
        const avg = ss.reduce((a, s) => a + s.rir!, 0) / ss.length;
        const lo = ss[0]!.rirMin ?? ss[0]!.rirMax!;
        const hi = ss[0]!.rirMax ?? ss[0]!.rirMin!;
        return {
          avg,
          lo,
          hi,
          dir: avg >= hi + p.delta! ? 'easy' : avg <= lo - p.delta! ? 'hard' : null,
        };
      });
      for (const dir of ['easy', 'hard'] as const) {
        const hits = verdicts.filter((v) => v.dir === dir);
        if (hits.length < p.sessions!) continue;
        const avg = Math.round((hits.reduce((a, v) => a + v.avg, 0) / hits.length) * 10) / 10;
        out.push({
          ruleKey: 'rir_off_target',
          key: `rir_off_target:${exerciseId}:${dir}`,
          severity: 'green',
          message: `${xs[0]!.exerciseName}: RIR registrado ${avg.toLocaleString('es-ES')} frente a un objetivo de ${hits[0]!.lo}–${hits[0]!.hi} en ${hits.length} sesiones. Propuesta: valorar ${dir === 'easy' ? 'subir' : 'bajar'} la carga.`,
          data: { exerciseId, direction: dir, sessions: hits.length, averageRir: avg },
        });
      }
    }
    return out;
  },

  performance_drop(i, p) {
    const from = addDays(i.today, -p.windowDays!);
    return i.declines
      .filter((d) => d.date >= from)
      .map((d) => ({
        ruleKey: 'performance_drop',
        key: `performance_drop:${d.testId}:${d.date}`,
        severity: 'yellow' as const,
        message: `${d.testName}: empeoramiento probable (mayor que el error de medida) en la evaluación del ${fmt(d.date)}.`,
        data: { ...d },
      }));
  },

  pain(i, p) {
    const from = addDays(i.today, -(p.windowDays! - 1));
    const recent = i.pains.filter(
      (x) => x.date >= from && x.date <= i.today && x.intensity >= p.yellowFrom!,
    );
    if (!recent.length) return [];
    // Attended sessions, newest first, to detect repetition in consecutive sessions.
    const attended = i.sessions
      .filter((s) => s.status === 'completed' || s.status === 'partial')
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((s) => s.id);
    const regions = new Map<string, MonitoredPain[]>();
    for (const x of recent) regions.set(norm(x.where), [...(regions.get(norm(x.where)) ?? []), x]);
    const out: AlertCandidate[] = [];
    for (const [region, xs] of regions) {
      const worst = xs.reduce((a, b) => (b.intensity > a.intensity ? b : a));
      const sessionsWithPain = new Set(xs.map((x) => x.sessionId).filter(Boolean));
      const lastK = attended.slice(0, p.consecutive!);
      const repeated =
        lastK.length === p.consecutive! && lastK.every((id) => sessionsWithPain.has(id));
      const red = worst.intensity >= p.redFrom! || repeated;
      out.push({
        ruleKey: 'pain',
        key: `pain:${region}`,
        severity: red ? 'red' : 'yellow',
        message: `Dolor ${worst.intensity}/10 declarado en ${worst.where} (${fmt(worst.date)})${repeated ? `, en ${p.consecutive} sesiones seguidas` : ''}.${red ? ` ${REFERRAL_TEXT}` : ' Valorar sustituir el ejercicio.'}`,
        data: {
          where: worst.where,
          intensity: worst.intensity,
          date: worst.date,
          repeated,
          referral: red,
        },
      });
    }
    return out;
  },

  wellness_low(i, p) {
    const days = [...i.readiness].sort((a, b) => (a.date < b.date ? 1 : -1));
    const run: { date: string; score: number }[] = [];
    let expected = days[0]?.date;
    for (const r of days) {
      const score = wellnessScore(r);
      if (score == null || score >= p.threshold! || r.date !== expected) break;
      run.push({ date: r.date, score });
      expected = addDays(r.date, -1);
    }
    if (run.length < p.days! || run[0]!.date < addDays(i.today, -1)) return [];
    const mean = Math.round((run.reduce((a, x) => a + x.score, 0) / run.length) * 10) / 10;
    return [
      {
        ruleKey: 'wellness_low',
        key: 'wellness_low',
        severity: 'yellow',
        message: `Bienestar bajo ${run.length} días seguidos (media ${mean.toLocaleString('es-ES')}/10).`,
        data: { days: run },
      },
    ];
  },

  feedback_missing(i, p) {
    const from = addDays(i.today, -(p.windowDays! - 1));
    return i.sessions
      .filter(
        (s) =>
          s.status === 'completed' && s.sessionRpe == null && s.date >= from && s.date <= i.today,
      )
      .map((s) => ({
        ruleKey: 'feedback_missing',
        key: `feedback_missing:${s.id}`,
        severity: 'green' as const,
        message: `Sesión «${s.title}» del ${fmt(s.date)} completada sin RPE de la sesión.`,
        data: { sessionId: s.id, date: s.date },
      }));
  },

  reassessment_overdue(i, p) {
    return i.reassessments
      .filter((r) => !r.assessed && addDays(r.dueDate, p.graceDays!) < i.today)
      .map((r) => ({
        ruleKey: 'reassessment_overdue',
        key: `reassessment_overdue:${r.id}`,
        severity: 'yellow' as const,
        message: `Reevaluación prevista en la semana ${r.weekIndex} (hasta el ${fmt(r.dueDate)}) sin evaluación registrada.`,
        data: { ...r },
      }));
  },
};

/** Runs every enabled rule. Pure: same input, same alerts. */
export function evaluateAlerts(input: MonitoringInput, rules: RuleConfig[]): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const r of rules) {
    if (!r.enabled) continue;
    const fn = EVALUATORS[r.key];
    if (fn) out.push(...fn(input, r.parameters));
  }
  const rank = { red: 0, yellow: 1, green: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
