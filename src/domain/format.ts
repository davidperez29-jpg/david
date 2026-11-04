/** Formato numérico en español (coma decimal, punto de millares). */
export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(value);
}

/** Duración en segundos como texto breve: «45 s», «2 min», «1 min 30 s». */
export function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    throw new RangeError('La duración debe ser un número no negativo.');
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes === 0) return `${seconds} s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} s`;
}

/** Cuenta atrás «m:ss». */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

type DateStyle = 'long' | 'dayMonth' | 'short' | 'weekday' | 'weekdayShort';

const DATE_FORMATS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  dayMonth: { day: 'numeric', month: 'long' },
  short: { day: 'numeric', month: 'short' },
  weekday: { weekday: 'long' },
  weekdayShort: { weekday: 'short' },
};

/**
 * Fecha de calendario (AAAA-MM-DD) en español. Se interpreta en UTC para que el día mostrado
 * no cambie según la zona horaria del navegador.
 */
export function formatDate(date: string, style: DateStyle = 'dayMonth'): string {
  return new Intl.DateTimeFormat('es-ES', { ...DATE_FORMATS[style], timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
    .replace('.', '');
}

/** «Hoy», «Mañana», «Ayer» o la fecha corta. */
export function formatRelativeDay(date: string, today: string): string {
  const diff = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return formatDate(date, 'long');
}
