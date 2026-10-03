/**
 * Prescription (§12.4). RIR, RPE and effort character are three different representations that
 * are stored separately and never mixed. The client text is generated from the prescription.
 */
export interface Prescription {
  sets?: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  repsPerCluster?: number | null;
  intraClusterRestS?: number | null;
  durationS?: number | null;
  distanceM?: number | null;
  contacts?: number | null;
  loadKg?: number | null;
  loadPct1rm?: number | null;
  rirMin?: number | null;
  rirMax?: number | null;
  rpeTarget?: number | null;
  effortCharacter?: string | null;
  velocityTargetMps?: number | null;
  velocityLossPct?: number | null;
  tempo?: string | null;
  restS?: number | null;
  rom?: 'full' | 'partial_lengthened' | 'partial_shortened' | 'specified' | null;
  intensityNote?: string | null;
  chainLoadKg?: number | null;
}

export interface PrescriptionContext {
  /** exercise.supports_vbt (§12.6). */
  supportsVbt: boolean;
  /** Client experience: VBT is not offered to beginners without stable technique. */
  clientExperience?: 'none' | 'beginner' | 'intermediate' | 'advanced' | null;
}

export type PrescriptionIssues = Record<string, string[]>;

const TEMPO_RE = /^[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}-[0-9X]{1,2}$/;

/** Field-level validation mirroring the database checks plus the VBT rule (§12.6). */
export function validatePrescription(
  p: Prescription,
  ctx: PrescriptionContext,
): PrescriptionIssues {
  const issues: PrescriptionIssues = {};
  const add = (k: string, m: string) => (issues[k] ??= []).push(m);
  const range = (k: keyof Prescription, min: number, max: number) => {
    const v = p[k];
    if (typeof v === 'number' && (v < min || v > max)) add(k, `Debe estar entre ${min} y ${max}.`);
  };
  range('sets', 1, 20);
  range('repsMin', 1, 100);
  range('repsMax', 1, 100);
  range('rirMin', 0, 10);
  range('rirMax', 0, 10);
  range('loadPct1rm', 0, 110);
  range('velocityLossPct', 0, 60);
  range('restS', 0, 900);
  range('loadKg', 0, 1000);
  if (p.repsMin != null && p.repsMax != null && p.repsMin > p.repsMax)
    add('repsMax', 'El máximo de repeticiones no puede ser menor que el mínimo.');
  if (p.rirMin != null && p.rirMax != null && p.rirMin > p.rirMax)
    add('rirMax', 'El RIR máximo no puede ser menor que el mínimo.');
  if (
    p.rpeTarget != null &&
    (p.rpeTarget < 1 || p.rpeTarget > 10 || Math.round(p.rpeTarget * 2) !== p.rpeTarget * 2)
  ) {
    add('rpeTarget', 'RPE entre 1 y 10, en pasos de 0,5.');
  }
  if (p.tempo && !TEMPO_RE.test(p.tempo))
    add('tempo', 'Formato excéntrica-pausa-concéntrica-pausa, p. ej. 3-1-X-0.');
  const vbt = p.velocityTargetMps != null || p.velocityLossPct != null;
  if (vbt && !ctx.supportsVbt)
    add('velocityTargetMps', 'Este ejercicio no admite VBT (trayectoria no medible).');
  if (vbt && (ctx.clientExperience === 'none' || ctx.clientExperience === 'beginner')) {
    add(
      'velocityTargetMps',
      'VBT no se ofrece a principiantes sin técnica consolidada (criterio práctico, nivel F).',
    );
  }
  if ((p.rirMin != null || p.rirMax != null) && p.rpeTarget != null) {
    add('rpeTarget', 'Usa RIR o RPE, no ambos en la misma prescripción.');
  }
  return issues;
}

const fmt = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n);
const range = (a?: number | null, b?: number | null) =>
  a != null && b != null && a !== b
    ? `${fmt(a)}–${fmt(b)}`
    : a != null
      ? fmt(a)
      : b != null
        ? fmt(b)
        : null;
const seconds = (s: number) =>
  s >= 60 && s % 60 === 0 ? `${s / 60} min` : s >= 90 ? `${fmt(s / 60)} min` : `${s} s`;

/** Compact notation for the trainer: "4×8–10 @ RIR 1–2 · 75 % 1RM · 2 min". */
export function prescriptionShort(p: Prescription): string {
  const parts: string[] = [];
  const reps = range(p.repsMin, p.repsMax);
  const work =
    reps ??
    (p.durationS
      ? seconds(p.durationS)
      : p.distanceM
        ? `${fmt(p.distanceM)} m`
        : p.contacts
          ? `${p.contacts} contactos`
          : null);
  if (p.sets && work) parts.push(`${p.sets}×${work}`);
  else if (p.sets) parts.push(`${p.sets} series`);
  else if (work) parts.push(work);
  const rir = range(p.rirMin, p.rirMax);
  if (rir) parts.push(`@ RIR ${rir}`);
  if (p.rpeTarget != null) parts.push(`@ RPE ${fmt(p.rpeTarget)}`);
  if (p.loadKg != null) parts.push(`${fmt(p.loadKg)} kg`);
  if (p.loadPct1rm != null) parts.push(`${fmt(p.loadPct1rm)} % 1RM`);
  if (p.velocityLossPct != null) parts.push(`pérdida de velocidad ≤ ${p.velocityLossPct} %`);
  if (p.tempo) parts.push(`tempo ${p.tempo}`);
  if (p.restS != null) parts.push(`descanso ${seconds(p.restS)}`);
  return parts.join(' · ');
}

/** Plain-language text for the client (§12.4): "4 series de 8 dejando aproximadamente 2 repeticiones en reserva". */
export function prescriptionForClient(p: Prescription): string {
  const out: string[] = [];
  const reps = range(p.repsMin, p.repsMax);
  const series = p.sets ? `${p.sets} ${p.sets === 1 ? 'serie' : 'series'}` : null;
  if (series && reps) out.push(`${series} de ${reps} repeticiones`);
  else if (series && p.durationS) out.push(`${series} de ${seconds(p.durationS)}`);
  else if (series && p.distanceM) out.push(`${series} de ${fmt(p.distanceM)} m`);
  else if (series && p.contacts) out.push(`${series} de ${p.contacts} saltos`);
  else if (series) out.push(series);
  else if (reps) out.push(`${reps} repeticiones`);
  else if (p.durationS) out.push(seconds(p.durationS));
  else if (p.distanceM) out.push(`${fmt(p.distanceM)} m`);
  const rir = range(p.rirMin, p.rirMax);
  if (rir)
    out.push(
      `dejando aproximadamente ${rir} ${rir === '1' ? 'repetición' : 'repeticiones'} en reserva`,
    );
  if (p.rpeTarget != null) out.push(`con un esfuerzo de ${fmt(p.rpeTarget)} sobre 10`);
  if (p.effortCharacter) out.push(`(${p.effortCharacter})`);
  if (p.loadKg != null) out.push(`con ${fmt(p.loadKg)} kg`);
  if (p.velocityLossPct != null) out.push('parando cuando la velocidad baje claramente');
  if (p.tempo) out.push(`a ritmo ${p.tempo}`);
  if (p.restS != null) out.push(`y descansando ${seconds(p.restS)} entre series`);
  const text = out.join(' ');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) + '.' : '';
}

/** Rounds a load to the nearest available increment (e.g. 2.5 kg for barbells). */
export function roundLoad(kg: number, increment = 2.5): number {
  return Math.max(0, Math.round(kg / increment) * increment);
}

/** %1RM → kg from a measured 1RM (no estimation equation involved). */
export function loadFromPct(pct: number, oneRm: number, increment = 2.5): number {
  return roundLoad((pct / 100) * oneRm, increment);
}
