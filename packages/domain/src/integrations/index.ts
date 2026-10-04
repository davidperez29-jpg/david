/**
 * External data (Phase 15, MASTER_SPECIFICATION §5 "Integraciones"): measurements from wearables,
 * apps and devices land in `external_measurements` through adapters. Pure validation here.
 *
 * The bounds below are technical plausibility limits to catch unit or typing errors (e.g. heart rate
 * in bpm, not a clinical range). They are not used to interpret anything.
 */
export interface MeasurementType {
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Physiological data: stored only with the client's health-data consent (art. 9 RGPD). */
  health: boolean;
}

export const MEASUREMENT_TYPES: Record<string, MeasurementType> = {
  resting_heart_rate: {
    label: 'Frecuencia cardiaca en reposo',
    unit: 'bpm',
    min: 20,
    max: 250,
    health: true,
  },
  hrv_rmssd: {
    label: 'Variabilidad de la frecuencia cardiaca (RMSSD)',
    unit: 'ms',
    min: 1,
    max: 500,
    health: true,
  },
  sleep_duration: { label: 'Duración del sueño', unit: 'h', min: 0, max: 24, health: true },
  steps: { label: 'Pasos', unit: 'pasos', min: 0, max: 200000, health: false },
  body_mass: { label: 'Masa corporal', unit: 'kg', min: 20, max: 400, health: false },
  session_duration: {
    label: 'Duración de la actividad',
    unit: 'min',
    min: 0,
    max: 1440,
    health: false,
  },
  distance: { label: 'Distancia', unit: 'km', min: 0, max: 1000, health: false },
  jump_height: { label: 'Altura de salto', unit: 'cm', min: 0, max: 150, health: false },
  mean_propulsive_velocity: {
    label: 'Velocidad media propulsiva',
    unit: 'm/s',
    min: 0,
    max: 5,
    health: false,
  },
};

export interface ExternalMeasurementInput {
  type: string;
  value: number;
  unit: string;
  measuredAt: string;
  device?: string | null;
  externalId?: string | null;
}

/** Errors per field for one measurement; empty object = valid. */
export function validateMeasurement(
  m: ExternalMeasurementInput,
  now: Date,
): Record<string, string> {
  const e: Record<string, string> = {};
  const t = MEASUREMENT_TYPES[m.type];
  if (!t) e.type = `Tipo no admitido: ${m.type}.`;
  else {
    if (m.unit !== t.unit) e.unit = `La unidad de ${t.label.toLowerCase()} es ${t.unit}.`;
    if (!Number.isFinite(m.value) || m.value < t.min || m.value > t.max)
      e.value = `Valor fuera de los límites técnicos (${t.min}–${t.max} ${t.unit}).`;
  }
  const at = Date.parse(m.measuredAt);
  if (Number.isNaN(at)) e.measuredAt = 'Fecha no válida.';
  else if (at > now.getTime() + 5 * 60_000) e.measuredAt = 'La fecha está en el futuro.';
  return e;
}
