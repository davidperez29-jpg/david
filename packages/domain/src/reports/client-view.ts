/**
 * The client's version of a shared report (pending 4 of Phase 15): the same frozen snapshot as the
 * trainer's report, told in plain language. No technical tables (MDC, internal load, engine
 * profile, evidence list): what was trained, how each test changed against its margin of error,
 * the plan, the trainer's message and the next assessment. Pure and deterministic, like
 * buildClientReport, so the screen and the PDF show exactly the same thing.
 */
import { VERDICT_LABELS, type ChangeVerdict } from '../assessment/change';
import { reportDate, type ClientReport, type ReportBlock, type ReportInput } from './report';

/** Plain-language verdicts: never a number without its meaning. */
export const PLAIN_VERDICT: Record<ChangeVerdict, string> = {
  probable_improvement: 'Has mejorado: el cambio supera el margen de error del test.',
  probable_decline: 'Ha bajado más que el margen de error. Lo comentaremos.',
  probable_change: 'Ha cambiado más que el margen de error.',
  possible_change:
    'Hay un cambio, pero está cerca del margen de error: lo confirmaremos en la próxima evaluación.',
  within_error: 'Sin cambios más allá del margen de error del test.',
  unknown_error: 'Mostramos la diferencia; este test no tiene un margen de error conocido.',
};

const verdictOf = (label: string) =>
  (Object.entries(VERDICT_LABELS) as [ChangeVerdict, string][]).find(([, l]) => l === label)?.[0];

const num = (n: number, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('es-ES');

export const CLIENT_REPORT_SECTIONS = [
  ['resumen', 'Tu periodo'],
  ['objetivos', 'Tus objetivos'],
  ['constancia', 'Lo que has entrenado'],
  ['progreso', 'Cómo vas'],
  ['plan', 'Tu plan'],
  ['mensaje', 'Mensaje de tu entrenador'],
  ['proxima', 'Próxima evaluación'],
] as const;

export function clientReportView(i: ReportInput): ClientReport {
  const s: Record<string, ReportBlock[]> = Object.fromEntries(
    CLIENT_REPORT_SECTIONS.map(([k]) => [k, []]),
  );
  const text = (k: string, t: string, tone?: 'muted' | 'warn') =>
    s[k]!.push(tone ? { kind: 'text', text: t, tone } : { kind: 'text', text: t });

  text(
    'resumen',
    `Este informe resume tu entrenamiento del ${reportDate(i.period.from)} al ${reportDate(i.period.to)}${i.trainers.length ? `, con ${i.trainers.join(' y ')}` : ''}.`,
  );
  if (i.screening === 'refer')
    text(
      'resumen',
      'Tu cuestionario de salud indica que antes de entrenar con cargas altas requiere valoración por profesional sanitario.',
      'warn',
    );

  if (!i.goals.length) text('objetivos', 'Aún no hay objetivos registrados.', 'muted');
  else
    s.objetivos!.push({
      kind: 'list',
      items: i.goals.map(
        (g) => `${g.name}${g.sport ? ` (${g.sport})` : ''}${g.primary ? ' · el principal' : ''}`,
      ),
    });

  const a4 = i.adherence.last4;
  const a12 = i.adherence.last12;
  if (!a12.planned) text('constancia', 'No había sesiones planificadas en este periodo.', 'muted');
  else {
    const items = [
      `Últimas 4 semanas: has hecho ${a4.done} de ${a4.planned} sesiones.`,
      `Últimas 12 semanas: has hecho ${a12.done} de ${a12.planned} sesiones.`,
    ];
    if (i.feedback.avgRpe != null)
      items.push(`Esfuerzo medio que nos has indicado: ${num(i.feedback.avgRpe, 1)} sobre 10.`);
    s.constancia!.push({ kind: 'list', items });
  }

  const withHistory = i.series.filter((x) => x.points.length >= 2);
  if (!withHistory.length)
    text(
      'progreso',
      i.results.length
        ? 'Para ver cómo cambias hace falta medir cada test al menos dos veces.'
        : 'Aún no hay evaluaciones en este periodo.',
      'muted',
    );
  for (const x of withHistory) {
    const first = x.points[0]!;
    const last = x.points.at(-1)!;
    const verdict = x.change ? verdictOf(x.change.label) : undefined;
    const meaning = x.note
      ? 'Las mediciones no son comparables entre sí, así que no sacamos conclusiones.'
      : verdict
        ? PLAIN_VERDICT[verdict]
        : '';
    s.progreso!.push({ kind: 'chart', title: x.test, unit: x.unit, points: x.points });
    text(
      'progreso',
      `${x.test}: de ${num(first.value)} ${x.unit} (${reportDate(first.date)}) a ${num(last.value)} ${x.unit} (${reportDate(last.date)}). ${meaning}`.trim(),
    );
  }

  if (!i.plan) text('plan', 'Ahora mismo no tienes un plan activo.', 'muted');
  else {
    const items = [
      `${i.plan.name}, del ${reportDate(i.plan.startDate)} al ${reportDate(i.plan.endDate)}.`,
    ];
    if (i.plan.currentWeek != null)
      items.push(
        `Vas por la semana ${i.plan.currentWeek} de ${i.plan.weeks}${i.plan.phase ? ` (${i.plan.phase.toLowerCase()})` : ''}.`,
      );
    if (i.plan.sessionsPerWeek) items.push(`${i.plan.sessionsPerWeek} sesiones por semana.`);
    const applied = i.adjustments.filter((x) => x.status !== 'Deshecha').length;
    if (applied)
      items.push(
        `Tu entrenador ha ajustado el plan ${applied === 1 ? 'una vez' : `${applied} veces`} según cómo has respondido.`,
      );
    s.plan!.push({ kind: 'list', items });
  }

  if (i.trainerNotes) text('mensaje', i.trainerNotes);
  else text('mensaje', 'Sin mensaje en este informe.', 'muted');

  text(
    'proxima',
    i.nextReassessment.date
      ? `Hacia el ${reportDate(i.nextReassessment.date)}.`
      : 'Tu entrenador te dirá la fecha.',
  );

  return {
    title: `Tu informe, ${i.client.name.split(' ')[0]}`,
    subtitle: `${i.organization} · ${reportDate(i.period.from)} – ${reportDate(i.period.to)}`,
    generatedAt: i.generatedAt,
    sections: CLIENT_REPORT_SECTIONS.map(([key, title], n) => ({
      number: n + 1,
      key,
      title,
      blocks: s[key]!,
    })),
    footer: [
      `Informe del ${reportDate(i.generatedAt)} compartido por tu entrenador.`,
      'Describe tu entrenamiento y su evolución; no es un diagnóstico. Si tienes dolor o dudas de salud, consulta con un profesional sanitario.',
    ],
  };
}
