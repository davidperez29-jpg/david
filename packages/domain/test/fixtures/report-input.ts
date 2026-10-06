import type { ReportInput } from '../../src';

/** A complete period snapshot used by the report tests. */
export const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  generatedAt: '2026-10-04T10:00:00.000Z',
  period: { from: '2026-07-01', to: '2026-10-04' },
  organization: 'Centro Demo',
  trainers: ['Pablo Ibarra'],
  client: {
    name: 'Iker Arrieta',
    age: 22,
    sex: 'Hombre',
    modality: 'Híbrido',
    experience: 'Intermedio',
    sessionsPerWeek: 3,
    minutesPerSession: 60,
    since: '2026-04-01',
  },
  goals: [{ name: 'Rendimiento en deportes de equipo', primary: true, sport: 'Fútbol' }],
  screening: 'clear',
  assessments: [{ date: '2026-09-22', context: 'Reevaluación', tests: ['CMJ', 'Sprint 10 m'] }],
  results: [
    {
      test: 'CMJ',
      unit: 'cm',
      value: 35.93,
      date: '2026-09-22',
      reference: { label: 'Medio', source: 'futbolistas sub-23 (ref. verificada)' },
    },
  ],
  series: [
    {
      test: 'CMJ',
      unit: 'cm',
      points: [
        { date: '2026-06-16', value: 34.2 },
        { date: '2026-09-22', value: 35.93 },
      ],
      change: { from: 34.2, to: 35.93, delta: 1.73, label: 'Cambio posible', mdc95: 2.4 },
      note: null,
    },
  ],
  traits: [{ label: 'Fuerza relativa baja', value: true, basis: 'umbral del centro' }],
  needs: [{ label: 'Fuerza máxima', direction: 'desarrollar' }],
  plan: {
    name: 'Deporte de equipo · 3 días',
    status: 'Activo',
    startDate: '2026-09-21',
    endDate: '2026-12-13',
    weeks: 12,
    sessionsPerWeek: 3,
    currentWeek: 3,
    phase: 'Base',
    revisions: 2,
  },
  adjustments: [
    { title: 'Sentadilla: subir de 80 kg a 82,5 kg', status: 'Aceptada', date: '2026-10-03' },
  ],
  adherence: {
    last4: { planned: 6, done: 6, percent: 100 },
    last12: { planned: 6, done: 6, percent: 100 },
    weeks: [{ weekStart: '2026-09-21', planned: 3, done: 3, load: 1080 }],
  },
  feedback: {
    sessionsWithRpe: 6,
    avgRpe: 6.3,
    avgWellness: null,
    painReports: null,
    comments: [{ date: '2026-09-30', text: 'Bien, algo cargado de piernas.' }],
  },
  recommendations: [
    {
      text: 'P1 · Fuerza máxima: 2 sesiones/semana',
      status: 'Aceptada',
      evidence: [{ citation: 'Seitz LB et al. 2014', doi: '10.1007/s40279-014-0227-1' }],
    },
  ],
  trainerNotes: 'Mantener el trabajo de fuerza en semanas de dos partidos.',
  nextReassessment: { date: '2026-11-02', basis: 'cada 6 semanas desde la última evaluación' },
  ...over,
});
