/**
 * Client report (encargo §34): 1 datos · 2 objetivos · 3 evaluación · 4 resultados · 5 evolución ·
 * 6 interpretación · 7 planificación · 8 adherencia · 9 feedback · 10 recomendaciones ·
 * 11 próxima reevaluación.
 *
 * Pure and deterministic: the application gathers a snapshot (ReportInput), this module turns it
 * into sections made of neutral blocks (text, list, table, chart) that every renderer (screen,
 * PDF, XLSX, CSV) draws the same way. Same snapshot → same report → same hash. It describes and
 * interprets measured change against measurement error; it never diagnoses.
 */
export interface ReportInput {
  generatedAt: string;
  period: { from: string; to: string };
  organization: string;
  trainers: string[];
  client: {
    name: string;
    age: number | null;
    sex: string;
    modality: string;
    experience: string | null;
    sessionsPerWeek: number | null;
    minutesPerSession: number | null;
    since: string | null;
  };
  goals: { name: string; primary: boolean; sport: string | null }[];
  screening: 'clear' | 'refer' | 'unknown' | 'not_consented';
  assessments: { date: string; context: string | null; tests: string[] }[];
  results: {
    test: string;
    unit: string;
    value: number;
    date: string;
    reference: { label: string; source: string } | null;
  }[];
  series: {
    test: string;
    unit: string;
    points: { date: string; value: number }[];
    change: { from: number; to: number; delta: number; label: string; mdc95: number | null } | null;
    note: string | null;
  }[];
  traits: { label: string; value: boolean | null; basis: string }[];
  needs: { label: string; direction: string }[];
  plan: {
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    weeks: number;
    sessionsPerWeek: number | null;
    currentWeek: number | null;
    phase: string | null;
    revisions: number;
  } | null;
  adjustments: { title: string; status: string; date: string }[];
  adherence: {
    last4: { planned: number; done: number; percent: number | null };
    last12: { planned: number; done: number; percent: number | null };
    weeks: { weekStart: string; planned: number; done: number; load: number }[];
  };
  feedback: {
    sessionsWithRpe: number;
    avgRpe: number | null;
    avgWellness: number | null;
    /** null: no health-data consent, so pain is not shown at all. */
    painReports: number | null;
    comments: { date: string; text: string }[];
  };
  recommendations: {
    text: string;
    status: string;
    evidence: { citation: string; doi: string | null }[];
  }[];
  trainerNotes: string | null;
  nextReassessment: { date: string | null; basis: string };
}

export type ReportBlock =
  | { kind: 'text'; text: string; tone?: 'muted' | 'warn' }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; columns: string[]; rows: (string | number | null)[][] }
  | { kind: 'chart'; title: string; unit: string; points: { date: string; value: number }[] };

export interface ReportSection {
  number: number;
  key: string;
  title: string;
  blocks: ReportBlock[];
}

export interface ClientReport {
  title: string;
  subtitle: string;
  generatedAt: string;
  sections: ReportSection[];
  footer: string[];
}

export const REPORT_SECTIONS = [
  ['datos', 'Datos'],
  ['objetivos', 'Objetivos'],
  ['evaluacion', 'Evaluación'],
  ['resultados', 'Resultados'],
  ['evolucion', 'Evolución'],
  ['interpretacion', 'Interpretación'],
  ['planificacion', 'Planificación'],
  ['adherencia', 'Adherencia'],
  ['feedback', 'Feedback'],
  ['recomendaciones', 'Recomendaciones'],
  ['reevaluacion', 'Próxima reevaluación'],
] as const;

export const reportDate = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';
const num = (n: number | null, d = 1) =>
  n == null ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('es-ES');
const pct = (n: number | null) => (n == null ? 'sin sesiones planificadas' : `${num(n)} %`);

export function buildClientReport(i: ReportInput): ClientReport {
  const s: Record<string, ReportBlock[]> = Object.fromEntries(
    REPORT_SECTIONS.map(([k]) => [k, []]),
  );
  const text = (k: string, t: string, tone?: 'muted' | 'warn') =>
    s[k]!.push(tone ? { kind: 'text', text: t, tone } : { kind: 'text', text: t });

  // 1. Datos
  s.datos!.push({
    kind: 'table',
    columns: ['Campo', 'Valor'],
    rows: [
      ['Cliente', i.client.name],
      ['Edad', i.client.age == null ? '—' : `${i.client.age} años`],
      ['Sexo', i.client.sex],
      ['Modalidad', i.client.modality],
      ['Experiencia', i.client.experience ?? '—'],
      [
        'Disponibilidad',
        i.client.sessionsPerWeek == null
          ? '—'
          : `${i.client.sessionsPerWeek} sesiones/semana${i.client.minutesPerSession ? ` de ${i.client.minutesPerSession} min` : ''}`,
      ],
      ['Cliente desde', reportDate(i.client.since)],
      ['Entrenador/a', i.trainers.join(', ') || '—'],
      ['Periodo del informe', `${reportDate(i.period.from)} – ${reportDate(i.period.to)}`],
    ],
  });

  // 2. Objetivos
  if (!i.goals.length) text('objetivos', 'Sin objetivos registrados.', 'muted');
  else
    s.objetivos!.push({
      kind: 'list',
      items: i.goals.map(
        (g) =>
          `${g.primary ? 'Principal' : 'Secundario'}: ${g.name}${g.sport ? ` (${g.sport})` : ''}`,
      ),
    });

  // 3. Evaluación
  const screening = {
    clear: 'Cribado previo sin limitaciones declaradas.',
    refer:
      'Cribado previo positivo: requiere valoración por profesional sanitario antes de cargas altas.',
    unknown: 'Sin cribado previo registrado.',
    not_consented: 'Datos de salud no incluidos (sin consentimiento).',
  }[i.screening];
  text('evaluacion', screening, i.screening === 'refer' ? 'warn' : undefined);
  if (!i.assessments.length) text('evaluacion', 'Sin evaluaciones en el periodo.', 'muted');
  else
    s.evaluacion!.push({
      kind: 'table',
      columns: ['Fecha', 'Contexto', 'Tests'],
      rows: i.assessments.map((a) => [reportDate(a.date), a.context ?? '—', a.tests.join(', ')]),
    });

  // 4. Resultados
  if (!i.results.length) text('resultados', 'Sin resultados registrados.', 'muted');
  else
    s.resultados!.push({
      kind: 'table',
      columns: ['Test', 'Valor', 'Fecha', 'Referencia aplicable'],
      rows: i.results.map((r) => [
        r.test,
        `${num(r.value, 2)} ${r.unit}`,
        reportDate(r.date),
        r.reference ? `${r.reference.label} (${r.reference.source})` : 'Sin referencia aplicable',
      ]),
    });

  // 5. Evolución
  const withHistory = i.series.filter((x) => x.points.length >= 2);
  if (!withHistory.length)
    text(
      'evolucion',
      'Se necesitan al menos dos mediciones de un test para mostrar la evolución.',
      'muted',
    );
  for (const x of withHistory)
    s.evolucion!.push({ kind: 'chart', title: x.test, unit: x.unit, points: x.points });
  if (withHistory.length)
    s.evolucion!.push({
      kind: 'table',
      columns: ['Test', 'Primera', 'Última', 'Cambio', 'Cambio mínimo detectable (MDC95)'],
      rows: withHistory.map((x) => [
        x.test,
        `${num(x.points[0]!.value, 2)} ${x.unit}`,
        `${num(x.points.at(-1)!.value, 2)} ${x.unit}`,
        x.change ? `${x.change.delta > 0 ? '+' : ''}${num(x.change.delta, 2)} ${x.unit}` : '—',
        x.change?.mdc95 != null ? `${num(x.change.mdc95, 2)} ${x.unit}` : 'desconocido',
      ]),
    });

  // 6. Interpretación: change against measurement error, applicable references, engine profile.
  const interp: string[] = [];
  for (const x of withHistory) {
    if (x.note) interp.push(`${x.test}: ${x.note}`);
    else if (x.change)
      interp.push(
        `${x.test}: ${x.change.label.toLowerCase()} (${x.change.delta > 0 ? '+' : ''}${num(x.change.delta, 2)} ${x.unit}${x.change.mdc95 != null ? `; el error de medida permite detectar cambios desde ${num(x.change.mdc95, 2)} ${x.unit}` : '; sin error de medida conocido no se emite veredicto'}).`,
      );
  }
  for (const r of i.results.filter((x) => x.reference))
    interp.push(`${r.test}: ${r.reference!.label.toLowerCase()} frente a ${r.reference!.source}.`);
  for (const t of i.traits.filter((x) => x.value != null))
    interp.push(`${t.label}: ${t.value ? 'sí' : 'no'} (${t.basis}).`);
  if (interp.length) s.interpretacion!.push({ kind: 'list', items: interp });
  else text('interpretacion', 'Sin datos suficientes para interpretar cambios.', 'muted');
  if (i.needs.length)
    s.interpretacion!.push({
      kind: 'table',
      columns: ['Cualidad', 'Dirección propuesta'],
      rows: i.needs.map((n) => [n.label, n.direction]),
    });
  text(
    'interpretacion',
    'Los cambios se interpretan frente al error de medida del test. No es un diagnóstico.',
    'muted',
  );

  // 7. Planificación
  if (!i.plan) text('planificacion', 'Sin plan activo.', 'muted');
  else
    s.planificacion!.push({
      kind: 'table',
      columns: ['Campo', 'Valor'],
      rows: [
        ['Plan', i.plan.name],
        ['Estado', i.plan.status],
        ['Fechas', `${reportDate(i.plan.startDate)} – ${reportDate(i.plan.endDate)}`],
        [
          'Semana actual',
          i.plan.currentWeek == null ? '—' : `${i.plan.currentWeek} de ${i.plan.weeks}`,
        ],
        ['Fase', i.plan.phase ?? '—'],
        ['Sesiones por semana', i.plan.sessionsPerWeek ?? '—'],
        ['Revisiones del plan', i.plan.revisions],
      ],
    });
  if (i.adjustments.length)
    s.planificacion!.push({
      kind: 'table',
      columns: ['Ajuste del periodo', 'Decisión', 'Fecha'],
      rows: i.adjustments.map((a) => [a.title, a.status, reportDate(a.date)]),
    });

  // 8. Adherencia
  s.adherencia!.push({
    kind: 'list',
    items: [
      `Últimas 4 semanas: ${pct(i.adherence.last4.percent)} (${i.adherence.last4.done} de ${i.adherence.last4.planned} sesiones).`,
      `Últimas 12 semanas: ${pct(i.adherence.last12.percent)} (${i.adherence.last12.done} de ${i.adherence.last12.planned} sesiones).`,
    ],
  });
  const weeks = i.adherence.weeks.filter((w) => w.planned > 0 || w.load > 0);
  if (weeks.length)
    s.adherencia!.push({
      kind: 'table',
      columns: ['Semana', 'Realizadas', 'Carga interna (UA)'],
      rows: weeks.map((w) => [reportDate(w.weekStart), `${w.done}/${w.planned}`, w.load]),
    });

  // 9. Feedback
  const fb = [
    `Sesiones con RPE de la sesión: ${i.feedback.sessionsWithRpe} (media ${num(i.feedback.avgRpe)}).`,
    `Bienestar diario medio: ${i.feedback.avgWellness == null ? 'sin registros' : `${num(i.feedback.avgWellness)} / 10`}.`,
  ];
  if (i.feedback.painReports != null)
    fb.push(`Sesiones con molestias declaradas: ${i.feedback.painReports}.`);
  s.feedback!.push({ kind: 'list', items: fb });
  if (i.feedback.comments.length)
    s.feedback!.push({
      kind: 'table',
      columns: ['Fecha', 'Comentario del cliente'],
      rows: i.feedback.comments.map((c) => [reportDate(c.date), c.text]),
    });

  // 10. Recomendaciones: only what the trainer accepted, plus the trainer's own notes.
  if (i.trainerNotes) text('recomendaciones', i.trainerNotes);
  if (i.recommendations.length)
    s.recomendaciones!.push({
      kind: 'list',
      items: i.recommendations.map((r) => `${r.text} (${r.status})`),
    });
  const evidence = [
    ...new Map(
      i.recommendations.flatMap((r) => r.evidence).map((e) => [e.doi ?? e.citation, e]),
    ).values(),
  ];
  if (evidence.length)
    s.recomendaciones!.push({
      kind: 'list',
      items: evidence.map((e) => `${e.citation}${e.doi ? ` · https://doi.org/${e.doi}` : ''}`),
    });
  if (!i.trainerNotes && !i.recommendations.length)
    text('recomendaciones', 'Sin recomendaciones aceptadas en el periodo.', 'muted');

  // 11. Próxima reevaluación
  text(
    'reevaluacion',
    i.nextReassessment.date
      ? `${reportDate(i.nextReassessment.date)} (${i.nextReassessment.basis}).`
      : i.nextReassessment.basis,
  );

  return {
    title: `Informe de ${i.client.name}`,
    subtitle: `${i.organization} · ${reportDate(i.period.from)} – ${reportDate(i.period.to)}`,
    generatedAt: i.generatedAt,
    sections: REPORT_SECTIONS.map(([key, title], n) => ({
      number: n + 1,
      key,
      title,
      blocks: s[key]!,
    })),
    footer: [
      `Generado el ${reportDate(i.generatedAt)}. Los datos de salud solo se incluyen con consentimiento.`,
      'Este informe describe el entrenamiento y su evolución; no es un diagnóstico.',
    ],
  };
}

/** Stable JSON (sorted keys) for hashing a snapshot. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v ?? null);
}

/** Flattens a report into rows (Sección · Bloque · columns…) for CSV/XLSX. */
export function reportRows(r: ClientReport): (string | number | null)[][] {
  const out: (string | number | null)[][] = [[r.title], [r.subtitle], []];
  for (const sec of r.sections) {
    out.push([`${sec.number}. ${sec.title}`]);
    for (const b of sec.blocks) {
      if (b.kind === 'text') out.push(['', b.text]);
      if (b.kind === 'list') for (const it of b.items) out.push(['', it]);
      if (b.kind === 'table') {
        out.push(['', ...b.columns]);
        for (const row of b.rows) out.push(['', ...row]);
      }
      if (b.kind === 'chart') {
        out.push(['', `${b.title} (${b.unit})`]);
        for (const p of b.points) out.push(['', reportDate(p.date), p.value]);
      }
    }
    out.push([]);
  }
  for (const f of r.footer) out.push([f]);
  return out;
}
