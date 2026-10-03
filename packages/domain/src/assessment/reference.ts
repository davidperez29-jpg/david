/**
 * Reference values and comparison (§11.6). A reference is used only when population, age, sex,
 * level/sport and measurement method match; z-scores only with applicable mean ± SD references.
 * Cut-offs (clinical screening thresholds) raise "Requiere valoración por profesional sanitario".
 */
import { REFERRAL_TEXT } from '../clients/health';

export interface ReferenceRow {
  id: string;
  populationName: string;
  populationSlug: string;
  ageMin: number | null;
  ageMax: number | null;
  sex: string | null;
  level: string | null;
  sport: string | null;
  statisticType: 'mean_sd' | 'median_iqr' | 'percentiles' | 'cutoff' | 'category_bands';
  values: Record<string, unknown>;
  measurementMethod: string | null;
  unit: string;
  sourceLabel: string;
}

export interface Subject {
  age: number | null;
  sex: 'female' | 'male' | 'other' | 'undisclosed' | null;
  sportSlug?: string | null;
  /** Population slugs the trainer considers the client part of (e.g. older_adults). */
  populations?: string[];
}

export interface ReferenceComparison {
  referenceId: string;
  applicable: boolean;
  reasons: string[];
  summary: string;
  zScore: number | null;
  band: string | null;
  flag: { message: string; criterion: string } | null;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function referenceApplicability(
  ref: ReferenceRow,
  who: Subject,
  method: string | null,
): { applicable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (who.age == null) reasons.push('Edad desconocida');
  else {
    if (ref.ageMin != null && who.age < ref.ageMin)
      reasons.push(`Edad fuera del rango de referencia (${ref.ageMin}–${ref.ageMax ?? '…'})`);
    if (ref.ageMax != null && who.age > ref.ageMax)
      reasons.push(`Edad fuera del rango de referencia (${ref.ageMin ?? '…'}–${ref.ageMax})`);
  }
  if (ref.sex && ref.sex !== 'mixed') {
    if (who.sex !== ref.sex)
      reasons.push(`Referencia para ${ref.sex === 'female' ? 'mujeres' : 'hombres'}`);
  }
  if (ref.sport && who.sportSlug !== ref.sport)
    reasons.push(`Referencia de otro deporte (${ref.sport})`);
  if (who.populations?.length && !who.populations.includes(ref.populationSlug)) {
    reasons.push(`Población distinta: ${ref.populationName}`);
  }
  if (
    ref.measurementMethod &&
    method &&
    !(
      norm(method).includes(norm(ref.measurementMethod)) ||
      norm(ref.measurementMethod).includes(norm(method))
    )
  ) {
    reasons.push(`Método de medida distinto (${ref.measurementMethod})`);
  }
  return { applicable: reasons.length === 0, reasons };
}

export function compareToReference(
  value: number,
  ref: ReferenceRow,
  who: Subject,
  method: string | null,
): ReferenceComparison {
  const { applicable, reasons } = referenceApplicability(ref, who, method);
  const v = ref.values;
  let zScore: number | null = null;
  let band: string | null = null;
  let flag: ReferenceComparison['flag'] = null;
  let summary: string;
  switch (ref.statisticType) {
    case 'mean_sd': {
      const m = num(v.mean);
      const s = num(v.sd);
      summary =
        m != null
          ? `Media de referencia ${m}${s != null ? ` ± ${s}` : ''} ${ref.unit}`
          : 'Referencia incompleta';
      if (applicable && m != null && s != null && s > 0 && v.normal !== false)
        zScore = Math.round(((value - m) / s) * 100) / 100;
      break;
    }
    case 'median_iqr': {
      summary = `Mediana de referencia ${num(v.median) ?? '—'} ${ref.unit}`;
      break;
    }
    case 'percentiles': {
      const ps = Object.entries(v)
        .map(([k, x]) => [Number(k.replace(/^p/, '')), num(x)] as const)
        .filter(([p, x]) => Number.isFinite(p) && x != null)
        .sort((a, b) => a[0] - b[0]);
      summary = `Percentiles de referencia: ${ps.map(([p, x]) => `P${p} ${x}`).join(' · ')} ${ref.unit}`;
      if (applicable && ps.length) {
        const below = ps.filter(([, x]) => value >= x!).pop();
        band = below ? `≥ P${below[0]}` : `< P${ps[0]![0]}`;
      }
      break;
    }
    case 'cutoff': {
      const c = num(v.cutoff);
      const dir = v.direction === 'above' ? 'above' : 'below';
      const meaning = typeof v.meaning === 'string' ? v.meaning : 'punto de corte';
      summary = `Punto de corte ${dir === 'below' ? '<' : '>'} ${c} ${ref.unit} (${meaning})`;
      const beyond = c != null && (dir === 'below' ? value < c : value > c);
      if (applicable && c != null)
        band = beyond ? `Más allá del punto de corte: ${meaning}` : 'Dentro del punto de corte';
      // Only clinical screening criteria (referral: true) raise the referral; they never diagnose.
      if (applicable && beyond && v.referral === true) {
        flag = { message: REFERRAL_TEXT, criterion: `${summary}. ${ref.sourceLabel}` };
      }
      break;
    }
    case 'category_bands': {
      summary = 'Bandas de referencia';
      break;
    }
  }
  return { referenceId: ref.id, applicable, reasons, summary, zScore, band, flag };
}

/** Symptoms that stop a test immediately (§11.7). Shown to staff during testing. */
export const STOP_SYMPTOMS = [
  'Dolor u opresión en el pecho',
  'Falta de aire desproporcionada',
  'Mareo, sensación de desmayo o desmayo',
  'Palpitaciones o latido irregular',
  'Dolor agudo, inestabilidad articular o caída',
] as const;
