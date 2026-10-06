/**
 * Report kinds (restructure phase 6, docs/REPORT_SYSTEM.md §1): técnico, para cliente, inicial,
 * seguimiento, comparativo, final, rendimiento (grupo) and readaptación/RTP. Each one is a pure
 * function of a frozen snapshot that returns the same block model (text, list, table, chart,
 * radar), so screen, PDF, XLSX and CSV draw it the same way and it reproduces byte for byte.
 * Strengths and points to improve are generated from the band of each score, so the text can
 * never contradict the number. Nothing here diagnoses or declares anyone fit.
 */
import { bandOf, BAND_LABELS, type Band } from '../assessment/group';
import type { Scale } from '../assessment/normalize';
import { clientReportView } from './client-view';
import {
  buildClientReport,
  reportDate,
  type RadarBlock,
  type Report,
  type ReportBlock,
  type ReportInput,
  type ReportSection,
} from './report';

export const REPORT_KINDS = {
  technical: {
    label: 'Técnico',
    audience: 'Equipo',
    description:
      'Todo: datos, resultados, referencias, evolución, interpretación, plan, adherencia, feedback y recomendaciones.',
  },
  client: {
    label: 'Para el cliente',
    audience: 'Cliente',
    description: 'Lenguaje sencillo, sin tablas técnicas.',
  },
  initial: {
    label: 'Inicial',
    audience: 'Equipo y cliente',
    description:
      'Punto de partida: resultados, perfil, fortalezas, aspectos a mejorar y plan propuesto.',
  },
  follow_up: {
    label: 'Seguimiento',
    audience: 'Equipo y cliente',
    description: 'Un periodo: adherencia, feedback, cambios y ajustes del plan.',
  },
  comparative: {
    label: 'Comparativo',
    audience: 'Equipo',
    description:
      'Evaluación A frente a B (y frente a una referencia): tabla, cambio real, radar y evolución.',
  },
  final: {
    label: 'Final',
    audience: 'Equipo y cliente',
    description: 'Cierre de un programa: inicio frente a final, objetivos y continuidad.',
  },
  performance: {
    label: 'Rendimiento (grupo)',
    audience: 'Equipo / club',
    description:
      'Una evaluación de grupo: resumen, Z frente al grupo con bandas y ficha con radar de cada persona elegida.',
  },
  rtp: {
    label: 'Readaptación / vuelta a la competición',
    audience: 'Equipo responsable',
    description: 'Lesión declarada, síntomas y tests antes y después. Nunca dice «apto».',
  },
} as const;
export type ReportKind = keyof typeof REPORT_KINDS;

// ── Shared pieces ─────────────────────────────────────────────────────────────

const num = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('es-ES');
const signed = (n: number | null | undefined, d = 2) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${num(n, d)}`;

/** Band of a score: Z scales and percentile (±1 SD ≈ P16/P84); none for % of reference. */
export function bandForScore(score: number | null, scale: Scale): Band | null {
  if (score == null) return null;
  if (scale === 'z_group' || scale === 'z_reference') return bandOf(score);
  if (scale === 'percentile')
    return score > 84.1 ? 'destacado' : score < 15.9 ? 'a_mejorar' : 'en_la_media';
  return null;
}

export function scoreText(score: number | null, scale: Scale): string {
  if (score == null) return '—';
  if (scale === 'percentile') return `P${Math.round(score)}`;
  if (scale === 'percent_reference') return `${num(score, 0)} %`;
  return `Z ${signed(score)}`;
}

/** Strengths and points to improve, written from the band of each score. */
export function strengthsAndImprovements(
  items: { name: string; score: number | null }[],
  scale: Scale,
  basis: string,
): { strengths: string[]; improve: string[] } {
  const strengths: string[] = [];
  const improve: string[] = [];
  for (const it of items) {
    const b = bandForScore(it.score, scale);
    const line = `${it.name}: ${BAND_LABELS[b ?? 'en_la_media'].toLowerCase()} (${scoreText(it.score, scale)} frente a ${basis}).`;
    if (b === 'destacado') strengths.push(line);
    if (b === 'a_mejorar') improve.push(line);
  }
  return { strengths, improve };
}

const section = (
  number: number,
  key: string,
  title: string,
  blocks: ReportBlock[],
): ReportSection => ({
  number,
  key,
  title,
  blocks,
});
const muted = (text: string): ReportBlock => ({ kind: 'text', text, tone: 'muted' });
const numbered = (list: [string, string, ReportBlock[]][]) =>
  list.map(([key, title, blocks], i) =>
    section(i + 1, key, title, blocks.length ? blocks : [muted('Sin datos.')]),
  );

const FOOTER = (generatedAt: string) => [
  `Generado el ${reportDate(generatedAt)}. Los datos de salud solo se incluyen con consentimiento.`,
  'Este informe describe el entrenamiento y su evolución; no es un diagnóstico.',
];

/** Snapshot of a comparison (A/B on one basis), frozen inside the report. */
export interface ComparisonData {
  a: { date: string } | null;
  b: { date: string };
  /** null: «sin referencia» — only raw values and change, no scores or radar. */
  scale: { key: Scale; label: string; neutral: number; range: [number, number] } | null;
  basisLabel: string | null;
  neutralLabel: string;
  dimensions: { name: string; scoreA: number | null; scoreB: number | null }[];
  items: {
    name: string;
    unit: string;
    direction: string;
    rawA: number | null;
    rawB: number | null;
    scoreA: number | null;
    scoreB: number | null;
    basis: string | null;
    change: {
      delta: number;
      deltaPercent: number | null;
      label: string;
      mdc95: number | null;
    } | null;
  }[];
  notes: string[];
}

function radarOf(c: ComparisonData, title: string): RadarBlock | null {
  if (!c.scale) return null;
  const dims = c.dimensions.filter((d) => d.scoreA != null || d.scoreB != null);
  if (dims.length < 3) return null;
  const layers: RadarBlock['layers'] = [];
  if (c.a && dims.some((d) => d.scoreA != null))
    layers.push({
      label: `A · ${reportDate(c.a.date)}`,
      values: dims.map((d) => d.scoreA),
      variant: 'previous',
    });
  layers.push({
    label: `B · ${reportDate(c.b.date)}`,
    values: dims.map((d) => d.scoreB),
    variant: 'current',
  });
  return {
    kind: 'radar',
    title,
    scaleLabel: `${c.scale.label}${c.basisLabel ? ` · ${c.basisLabel}` : ''}`,
    neutral: c.scale.neutral,
    neutralLabel: c.neutralLabel,
    range: c.scale.range,
    axes: dims.map((d) => d.name),
    layers,
  };
}

function comparisonBlocks(c: ComparisonData): ReportBlock[] {
  const out: ReportBlock[] = [];
  const radar = radarOf(c, 'Radar por dimensiones (hacia fuera es mejor)');
  if (radar) out.push(radar);
  else if (c.scale) out.push(muted('Menos de 3 dimensiones con datos: no se dibuja el radar.'));
  if (c.scale)
    out.push({
      kind: 'table',
      columns: ['Dimensión', 'A', 'B'],
      rows: c.dimensions.map((d) => [
        d.name,
        scoreText(d.scoreA, c.scale!.key),
        scoreText(d.scoreB, c.scale!.key),
      ]),
    });
  out.push({
    kind: 'table',
    columns: c.scale
      ? ['Test', 'A', 'B', 'Cambio', '¿Cambio real?', 'Puntuación A -> B']
      : ['Test', 'A', 'B', 'Cambio', '¿Cambio real?'],
    rows: c.items.map((i) => [
      `${i.name} (${i.unit})`,
      num(i.rawA),
      num(i.rawB),
      i.change
        ? `${signed(i.change.delta)} ${i.unit}${i.change.deltaPercent != null ? ` (${signed(i.change.deltaPercent, 1)} %)` : ''}`
        : '—',
      i.change?.label ?? '—',
      ...(c.scale
        ? [`${scoreText(i.scoreA, c.scale.key)} -> ${scoreText(i.scoreB, c.scale.key)}`]
        : []),
    ]),
  });
  for (const n of c.notes) out.push({ kind: 'text', text: n, tone: 'warn' });
  return out;
}

function interpretation(c: ComparisonData): ReportBlock[] {
  const lines: string[] = [];
  for (const i of c.items)
    if (i.change)
      lines.push(
        `${i.name}: ${i.change.label.toLowerCase()} (${signed(i.change.delta)} ${i.unit}${i.change.mdc95 != null ? `; cambio mínimo detectable ${num(i.change.mdc95)} ${i.unit}` : ''}).`,
      );
  const out: ReportBlock[] = lines.length ? [{ kind: 'list', items: lines }] : [];
  if (c.scale) {
    const sw = strengthsAndImprovements(
      c.items.map((i) => ({ name: i.name, score: i.scoreB })),
      c.scale.key,
      c.basisLabel ?? 'la base elegida',
    );
    if (sw.strengths.length)
      out.push({ kind: 'text', text: 'Destaca en:' }, { kind: 'list', items: sw.strengths });
    if (sw.improve.length)
      out.push({ kind: 'text', text: 'Aspectos a mejorar:' }, { kind: 'list', items: sw.improve });
  }
  out.push(
    muted('Los cambios se comparan con el error de medida de cada test. No es un diagnóstico.'),
  );
  return out;
}

const pick = (r: Report, key: string) => r.sections.find((s) => s.key === key)?.blocks ?? [];

// ── Client kinds built on the period snapshot (ReportInput) ───────────────────

export interface PeriodSnapshot {
  input: ReportInput;
  /** A/B comparison inside the period (initial: B = first assessment; final: first → last). */
  comparison: ComparisonData | null;
  goals?: { name: string; status: string }[];
}

export function buildInitialReport(s: PeriodSnapshot): Report {
  const t = buildClientReport(s.input);
  const c = s.comparison;
  const sw =
    c?.scale != null
      ? strengthsAndImprovements(
          c.items.map((i) => ({ name: i.name, score: i.scoreB })),
          c.scale.key,
          c.basisLabel ?? 'la base elegida',
        )
      : null;
  const radar = c ? radarOf(c, 'Perfil de partida') : null;
  return {
    title: `Informe inicial de ${s.input.client.name}`,
    subtitle: t.subtitle,
    generatedAt: s.input.generatedAt,
    sections: numbered([
      ['datos', 'Datos', pick(t, 'datos')],
      ['objetivos', 'Objetivos', pick(t, 'objetivos')],
      ['evaluacion', 'Evaluación inicial', [...pick(t, 'evaluacion'), ...pick(t, 'resultados')]],
      [
        'perfil',
        'Perfil de partida',
        radar
          ? [radar]
          : [muted('Sin base de comparación suficiente para un perfil (referencia o grupo).')],
      ],
      [
        'fortalezas',
        'Fortalezas y aspectos a mejorar',
        sw
          ? [
              ...(sw.strengths.length
                ? [
                    { kind: 'text', text: 'Fortalezas:' } as ReportBlock,
                    { kind: 'list', items: sw.strengths } as ReportBlock,
                  ]
                : []),
              ...(sw.improve.length
                ? [
                    { kind: 'text', text: 'Aspectos a mejorar:' } as ReportBlock,
                    { kind: 'list', items: sw.improve } as ReportBlock,
                  ]
                : []),
              ...(!sw.strengths.length && !sw.improve.length
                ? [muted('Todos los resultados están en la media de la base elegida.')]
                : []),
              muted(
                'Se generan de la banda de cada resultado (Z > +1 destacado, Z < −1 a mejorar).',
              ),
            ]
          : [muted('Sin base de comparación: se valorarán con la reevaluación.')],
      ],
      ['plan', 'Plan propuesto', pick(t, 'planificacion')],
      ['recomendaciones', 'Recomendaciones', pick(t, 'recomendaciones')],
      ['reevaluacion', 'Próxima reevaluación', pick(t, 'reevaluacion')],
    ]),
    footer: FOOTER(s.input.generatedAt),
  };
}

export function buildFollowUpReport(s: PeriodSnapshot): Report {
  const t = buildClientReport(s.input);
  return {
    title: `Informe de seguimiento de ${s.input.client.name}`,
    subtitle: t.subtitle,
    generatedAt: s.input.generatedAt,
    sections: numbered([
      ['datos', 'Datos', pick(t, 'datos')],
      ['adherencia', 'Adherencia', pick(t, 'adherencia')],
      ['feedback', 'Feedback', pick(t, 'feedback')],
      [
        'cambios',
        'Cambios desde la evaluación anterior',
        s.comparison ? comparisonBlocks(s.comparison) : pick(t, 'evolucion'),
      ],
      [
        'interpretacion',
        'Interpretación',
        s.comparison ? interpretation(s.comparison) : pick(t, 'interpretacion'),
      ],
      ['ajustes', 'Plan y ajustes', pick(t, 'planificacion')],
      ['recomendaciones', 'Recomendaciones', pick(t, 'recomendaciones')],
      ['reevaluacion', 'Próxima reevaluación', pick(t, 'reevaluacion')],
    ]),
    footer: FOOTER(s.input.generatedAt),
  };
}

const GOAL_STATUS: Record<string, string> = {
  active: 'En curso',
  achieved: 'Conseguido',
  dropped: 'Abandonado',
};

export function buildFinalReport(s: PeriodSnapshot): Report {
  const t = buildClientReport(s.input);
  return {
    title: `Informe final de ${s.input.client.name}`,
    subtitle: t.subtitle,
    generatedAt: s.input.generatedAt,
    sections: numbered([
      ['datos', 'Datos', pick(t, 'datos')],
      [
        'objetivos',
        'Objetivos',
        s.goals?.length
          ? [
              {
                kind: 'table',
                columns: ['Objetivo', 'Estado'],
                rows: s.goals.map((g) => [g.name, GOAL_STATUS[g.status] ?? g.status]),
              },
            ]
          : pick(t, 'objetivos'),
      ],
      [
        'inicio_final',
        'Inicio frente a final',
        s.comparison
          ? comparisonBlocks(s.comparison)
          : [muted('Hace falta una evaluación al inicio y otra al final.')],
      ],
      ['evolucion', 'Evolución', pick(t, 'evolucion')],
      [
        'interpretacion',
        'Interpretación',
        s.comparison ? interpretation(s.comparison) : pick(t, 'interpretacion'),
      ],
      ['adherencia', 'Adherencia del programa', pick(t, 'adherencia')],
      ['continuidad', 'Recomendaciones de continuidad', pick(t, 'recomendaciones')],
    ]),
    footer: FOOTER(s.input.generatedAt),
  };
}

// ── Comparative ──────────────────────────────────────────────────────────────

export interface ComparativeSnapshot {
  generatedAt: string;
  organization: string;
  client: { name: string };
  reference: 'none' | 'group' | 'normative';
  comparison: ComparisonData;
  series: { test: string; unit: string; points: { date: string; value: number }[] }[];
  trainerNotes: string | null;
}

const REFERENCE_LABEL: Record<ComparativeSnapshot['reference'], string> = {
  none: 'Sin referencia',
  group: 'Media del grupo',
  normative: 'Referencia normativa',
};

export function buildComparativeReport(s: ComparativeSnapshot): Report {
  const c = s.comparison;
  return {
    title: `Informe comparativo de ${s.client.name}`,
    subtitle: `${s.organization} · ${c.a ? `${reportDate(c.a.date)} frente a ` : ''}${reportDate(c.b.date)}`,
    generatedAt: s.generatedAt,
    sections: numbered([
      [
        'comparacion',
        'Qué se compara',
        [
          {
            kind: 'table',
            columns: ['Campo', 'Valor'],
            rows: [
              ['Cliente', s.client.name],
              ['Evaluación A', c.a ? reportDate(c.a.date) : '—'],
              ['Evaluación B', reportDate(c.b.date)],
              ['Referencia', REFERENCE_LABEL[s.reference]],
              ['Escala', c.scale ? c.scale.label : 'Valores reales, sin escala común'],
              ['Base', c.basisLabel ?? '—'],
            ],
          },
        ],
      ],
      ['resultados', 'Resultados A y B', comparisonBlocks(c)],
      [
        'evolucion',
        'Evolución',
        s.series
          .filter((x) => x.points.length >= 2)
          .map(
            (x) =>
              ({ kind: 'chart', title: x.test, unit: x.unit, points: x.points }) as ReportBlock,
          ),
      ],
      ['interpretacion', 'Interpretación', interpretation(c)],
      [
        'observaciones',
        'Observaciones',
        s.trainerNotes ? [{ kind: 'text', text: s.trainerNotes }] : [],
      ],
    ]),
    footer: FOOTER(s.generatedAt),
  };
}

// ── Performance (group) ──────────────────────────────────────────────────────

export interface PerformanceSnapshot {
  generatedAt: string;
  organization: string;
  group: { name: string; date: string; members: string[]; missing: string[] };
  rows: {
    name: string;
    unit: string;
    direction: string;
    n: number;
    mean: number | null;
    sd: number | null;
    max: number | null;
    min: number | null;
    best: number | null;
    worst: number | null;
    reference: string | null;
    z: (number | null)[];
    values: (number | null)[];
    flags: (string | null)[];
  }[];
  /** Selected people: radar of dimensions (Z against the group) and strengths. */
  players: {
    name: string;
    dimensions: { name: string; score: number | null }[];
    items: { name: string; score: number | null }[];
  }[];
  trainerNotes: string | null;
}

export function buildPerformanceReport(s: PerformanceSnapshot): Report {
  const g = s.group;
  const name = (i: number | null) => (i == null ? '—' : (g.members[i] ?? '—'));
  const compared = s.rows.filter((r) => r.direction !== 'target_range' && r.n > 0);
  const players: [string, string, ReportBlock[]][] = s.players.map((p, k) => {
    const dims = p.dimensions.filter((d) => d.score != null);
    const sw = strengthsAndImprovements(p.items, 'z_group', `el grupo (${g.name})`);
    const blocks: ReportBlock[] = [];
    if (dims.length >= 3)
      blocks.push({
        kind: 'radar',
        title: `Perfil de ${p.name}`,
        scaleLabel: `Z frente al grupo · ${g.name}`,
        neutral: 0,
        neutralLabel: 'Media del grupo',
        range: [-3, 3],
        axes: dims.map((d) => d.name),
        layers: [
          { label: reportDate(g.date), values: dims.map((d) => d.score), variant: 'current' },
        ],
      });
    blocks.push({
      kind: 'table',
      columns: ['Dimensión', 'Z frente al grupo'],
      rows: p.dimensions.map((d) => [d.name, scoreText(d.score, 'z_group')]),
    });
    if (sw.strengths.length)
      blocks.push({ kind: 'text', text: 'Destaca en:' }, { kind: 'list', items: sw.strengths });
    if (sw.improve.length)
      blocks.push(
        { kind: 'text', text: 'Aspectos a mejorar:' },
        { kind: 'list', items: sw.improve },
      );
    return [`persona_${k + 1}`, p.name, blocks];
  });
  const notes: ReportBlock[] = [
    muted(
      'DT: desviación típica muestral (n − 1). Z: distancia a la media del grupo en desviaciones típicas, con el signo corregido (positivo es mejor). Bandas: Z > +1 destacado, −1 a +1 en la media, Z < −1 a mejorar.',
    ),
    muted(
      'Compara dentro de este grupo, no con la población. Asimetría: orientativa, no predice lesiones.',
    ),
  ];
  if (g.members.length < 5)
    notes.unshift({
      kind: 'text',
      tone: 'warn',
      text: `Grupo pequeño (${g.members.length}): la media y la Z cambian mucho con una sola persona.`,
    });
  if (s.trainerNotes) notes.unshift({ kind: 'text', text: s.trainerNotes });
  const bandName = (z: number | null) => {
    const b = bandOf(z);
    return b ? BAND_LABELS[b] : '';
  };
  return {
    title: `Informe de rendimiento · ${g.name}`,
    subtitle: `${s.organization} · Evaluación del ${reportDate(g.date)} · ${g.members.length} personas`,
    generatedAt: s.generatedAt,
    sections: numbered([
      [
        'grupo',
        'Grupo',
        [
          {
            kind: 'list',
            items: [
              `Personas evaluadas: ${g.members.join(', ')}.`,
              ...(g.missing.length ? [`Sin evaluación ese día: ${g.missing.join(', ')}.`] : []),
            ],
          },
        ],
      ],
      [
        'resumen',
        'Resumen del grupo',
        [
          {
            kind: 'table',
            columns: ['Prueba', 'N', 'Media', 'Referencia', 'DT', 'Máx.', 'Mín.', 'Mejor', 'Peor'],
            rows: s.rows.map((r) => [
              `${r.name} (${r.unit})`,
              r.n,
              num(r.mean),
              r.reference ?? '—',
              num(r.sd),
              num(r.max),
              num(r.min),
              r.direction === 'target_range' ? 'Descriptivo' : name(r.best),
              r.direction === 'target_range' ? '' : name(r.worst),
            ]),
          },
        ],
      ],
      [
        'z',
        'Z frente al grupo',
        [
          {
            kind: 'table',
            columns: ['Persona', ...compared.map((r) => r.name)],
            rows: g.members.map((m, i) => [
              m,
              ...compared.map((r) =>
                r.values[i] == null
                  ? '—'
                  : `${num(r.values[i])}${r.z[i] != null ? ` · Z ${signed(r.z[i])} ${bandName(r.z[i])}` : ''}${r.flags[i] ? ' · confirmar medición' : ''}`,
              ),
            ]),
          },
        ],
      ],
      ...players,
      ['notas', 'Notas', notes],
    ]),
    footer: FOOTER(s.generatedAt),
  };
}

// ── Readaptación / RTP ───────────────────────────────────────────────────────

export interface RtpSnapshot {
  generatedAt: string;
  organization: string;
  client: { name: string };
  consent: boolean;
  injury: {
    type: string;
    region: string | null;
    declaredOn: string;
    status: string;
    cleared: boolean;
  } | null;
  pain: { date: string; intensity: number; region: string }[];
  comparison: ComparisonData | null;
  trainerNotes: string | null;
}

export const RTP_MAX_STATUS = 'Listo para valoración';

export function buildRtpReport(s: RtpSnapshot): Report {
  const injury: ReportBlock[] = !s.consent
    ? [
        {
          kind: 'text',
          tone: 'warn',
          text: 'Sin consentimiento para datos de salud: no se muestran la lesión ni los síntomas.',
        },
      ]
    : s.injury
      ? [
          {
            kind: 'table',
            columns: ['Campo', 'Valor'],
            rows: [
              ['Tipo', s.injury.type],
              ['Zona', s.injury.region ?? '—'],
              ['Declarada el', reportDate(s.injury.declaredOn)],
              ['Situación declarada', s.injury.status],
              ['Valoración profesional registrada', s.injury.cleared ? 'Sí' : 'No'],
            ],
          },
        ]
      : [muted('Sin lesión declarada.')];
  const regions = [...new Set(s.pain.map((p) => p.region))];
  const pain: ReportBlock[] = !s.consent
    ? [muted('No se muestran (sin consentimiento).')]
    : s.pain.length
      ? regions.map(
          (r) =>
            ({
              kind: 'chart',
              title: `Molestia declarada (0–10) · ${r}`,
              unit: '/10',
              points: s.pain
                .filter((p) => p.region === r)
                .map((p) => ({ date: p.date, value: p.intensity })),
            }) as ReportBlock,
        )
      : [muted('Sin molestias registradas en el periodo.')];
  return {
    title: `Informe de readaptación de ${s.client.name}`,
    subtitle: `${s.organization} · ${reportDate(s.generatedAt)}`,
    generatedAt: s.generatedAt,
    sections: numbered([
      ['lesion', 'Lesión declarada', injury],
      ['sintomas', 'Síntomas', pain],
      [
        'tests',
        'Tests: antes de la lesión frente a ahora',
        s.comparison
          ? comparisonBlocks(s.comparison)
          : [muted('Hace falta una evaluación anterior a la lesión y otra reciente.')],
      ],
      [
        'estado',
        'Estado',
        [
          {
            kind: 'text',
            text: `El estado máximo que emite la plataforma es «${RTP_MAX_STATUS}». La decisión de volver a entrenar sin restricciones o a competir la toma y registra el profesional responsable.`,
          },
          muted(
            'Las fases, los criterios de progresión y su evidencia se gestionan en el módulo de readaptación.',
          ),
        ],
      ],
      [
        'observaciones',
        'Observaciones',
        s.trainerNotes ? [{ kind: 'text', text: s.trainerNotes }] : [],
      ],
    ]),
    footer: [
      `Generado el ${reportDate(s.generatedAt)}. Datos de salud solo con consentimiento.`,
      'No es un diagnóstico ni una autorización para competir.',
    ],
  };
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/** Rebuilds any report from its stored type and frozen snapshot. */
export function buildReport(type: string, snapshot: unknown): Report {
  switch (type) {
    case 'client_report':
    case 'technical':
      return buildClientReport(snapshot as ReportInput);
    case 'client':
      return clientReportView(snapshot as ReportInput);
    case 'initial':
      return buildInitialReport(snapshot as PeriodSnapshot);
    case 'follow_up':
      return buildFollowUpReport(snapshot as PeriodSnapshot);
    case 'final':
      return buildFinalReport(snapshot as PeriodSnapshot);
    case 'comparative':
      return buildComparativeReport(snapshot as ComparativeSnapshot);
    case 'performance':
      return buildPerformanceReport(snapshot as PerformanceSnapshot);
    case 'rtp':
      return buildRtpReport(snapshot as RtpSnapshot);
    default:
      throw new Error(`Tipo de informe desconocido: ${type}`);
  }
}

/** The period snapshot inside a stored report, for the client's plain-language version. */
export function periodInputOf(type: string, snapshot: unknown): ReportInput | null {
  if (type === 'client_report' || type === 'technical' || type === 'client')
    return snapshot as ReportInput;
  if (type === 'initial' || type === 'follow_up' || type === 'final')
    return (snapshot as PeriodSnapshot).input;
  return null;
}
