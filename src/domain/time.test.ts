import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  isIsoDate,
  isoWeekKey,
  isoWeekday,
  startOfIsoWeek,
  todayInTimeZone,
} from './time';

describe('fechas de calendario', () => {
  it('valida fechas reales, incluidos los años bisiestos', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('4/11/2026')).toBe(false);
  });

  it('suma días cruzando meses, años y cambios de hora', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26'); // cambio de hora en España
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
  });

  it('calcula el día y el inicio de la semana ISO (lunes)', () => {
    expect(isoWeekday('2026-11-04')).toBe(3);
    expect(isoWeekday('2026-11-08')).toBe(7);
    expect(startOfIsoWeek('2026-11-08')).toBe('2026-11-02');
  });

  it('asigna la semana ISO según el jueves, también en los cambios de año', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2021-01-01')).toBe('2020-W53');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
    expect(isoWeekKey('2026-11-04')).toBe('2026-W45');
  });

  it('obtiene «hoy» en la zona horaria indicada', () => {
    const lateNightUtc = new Date('2026-11-04T23:30:00Z');
    expect(todayInTimeZone('Europe/Madrid', lateNightUtc)).toBe('2026-11-05');
    expect(todayInTimeZone('America/Mexico_City', lateNightUtc)).toBe('2026-11-04');
  });

  it('rechaza fechas mal formadas', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });
});

describe('formato de fechas en español', async () => {
  const { formatDate, formatRelativeDay, formatSeconds, formatClock } = await import('./format');

  it('formatea fechas sin depender de la zona horaria', () => {
    expect(formatDate('2026-11-04', 'long')).toBe('miércoles, 4 de noviembre');
    expect(formatDate('2026-11-04', 'short')).toBe('4 nov');
    expect(formatRelativeDay('2026-11-05', '2026-11-04')).toBe('Mañana');
  });

  it('formatea duraciones y cuentas atrás', () => {
    expect(formatSeconds(150)).toBe('2 min 30 s');
    expect(formatSeconds(45)).toBe('45 s');
    expect(formatClock(89.2)).toBe('1:30');
  });
});
