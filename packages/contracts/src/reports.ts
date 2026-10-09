import { z } from 'zod';
import { STUDY_DESIGNS } from './science';
import { isoDate, optionalText } from './common';

// ── Reports and exports ───────────────────────────────────────────────────────

/** Kinds of a client's report (phase 6); the group «rendimiento» report has its own schema. */
export const CLIENT_REPORT_KINDS = [
  'technical',
  'client',
  'initial',
  'follow_up',
  'comparative',
  'final',
  'rtp',
] as const;

export const generateReportSchema = z
  .object({
    kind: z.enum(CLIENT_REPORT_KINDS).default('technical'),
    from: isoDate.optional(),
    to: isoDate.optional(),
    /** The trainer's own recommendations (section 10); the report never invents them. */
    trainerNotes: optionalText(3000),
    /** Comparative: assessments A and B (defaults: the two latest with tests in common). */
    a: z.uuid().optional(),
    b: z.uuid().optional(),
    reference: z.enum(['none', 'group', 'normative']).default('group'),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: 'La fecha inicial debe ser anterior a la final.',
    path: ['to'],
  })
  .refine((d) => ['comparative', 'rtp'].includes(d.kind) || (d.from && d.to), {
    message: 'Indica el periodo del informe.',
    path: ['from'],
  });

/** Rendimiento: a group assessment, with the people whose individual sheet is included. */
export const generateGroupReportSchema = z.object({
  date: isoDate,
  players: z.array(z.uuid()).max(40).optional(),
  trainerNotes: optionalText(3000),
});

/** Shares a report with the client's app (plain-language version) or stops sharing it. */
export const shareReportSchema = z.object({ shared: z.boolean() });

export const REPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export const EXPORT_ENTITIES = ['clients', 'assessments', 'plan', 'sessions', 'progress'] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

export const exportQuerySchema = z.object({
  entity: z.enum(EXPORT_ENTITIES),
  format: z.enum(['csv', 'xlsx']),
  clientId: z.uuid().optional(),
  planId: z.uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

// ── Imports (validated row by row before anything is written) ─────────────────

export const IMPORT_ENTITIES = [
  'clients',
  'exercises',
  'assessments',
  'references',
  'reference_values',
] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export const createImportSchema = z.object({
  entity: z.enum(IMPORT_ENTITIES),
  fileName: z.string().trim().min(1).max(200),
  /** Base64 of the CSV/XLSX file (2 MB max). */
  contentBase64: z.string().min(4).max(2_800_000),
});

export interface ImportColumn {
  /** Normalized header (lowercase, no accents, `_`). */
  key: string;
  /** Header as shown in templates. */
  header: string;
  required: boolean;
  example: string;
  help: string;
  aliases?: string[];
}

export const IMPORT_COLUMNS: Record<ImportEntity, ImportColumn[]> = {
  clients: [
    { key: 'nombre', header: 'Nombre', required: true, example: 'Ana', help: 'Nombre' },
    {
      key: 'apellidos',
      header: 'Apellidos',
      required: true,
      example: 'García López',
      help: 'Apellidos',
    },
    {
      key: 'fecha_nacimiento',
      header: 'Fecha nacimiento',
      required: true,
      example: '14/03/1995',
      help: 'dd/mm/aaaa o aaaa-mm-dd',
      aliases: ['fecha_de_nacimiento', 'nacimiento'],
    },
    {
      key: 'sexo',
      header: 'Sexo',
      required: false,
      example: 'mujer',
      help: 'mujer, hombre, otro o vacío',
    },
    {
      key: 'email',
      header: 'Email',
      required: false,
      example: 'ana@example.com',
      help: 'Se usa para detectar duplicados',
      aliases: ['correo', 'correo_electronico'],
    },
    { key: 'telefono', header: 'Teléfono', required: false, example: '600123123', help: '' },
    {
      key: 'modalidad',
      header: 'Modalidad',
      required: false,
      example: 'presencial',
      help: 'presencial, online o híbrido',
    },
    {
      key: 'experiencia',
      header: 'Experiencia',
      required: false,
      example: 'principiante',
      help: 'ninguna, principiante, intermedio o avanzado',
    },
    {
      key: 'sesiones_semana',
      header: 'Sesiones semana',
      required: false,
      example: '3',
      help: '1–14',
      aliases: ['sesiones_por_semana'],
    },
    {
      key: 'objetivo',
      header: 'Objetivo',
      required: false,
      example: 'Salud general',
      help: 'Nombre o clave del catálogo de objetivos',
    },
    {
      key: 'deporte',
      header: 'Deporte',
      required: false,
      example: '',
      help: 'Nombre o clave del catálogo de deportes',
    },
  ],
  exercises: [
    { key: 'nombre', header: 'Nombre', required: true, example: 'Sentadilla goblet', help: '' },
    {
      key: 'patron',
      header: 'Patrón',
      required: false,
      example: 'Dominante de rodilla',
      help: 'Nombre o clave del patrón de movimiento',
      aliases: ['patron_de_movimiento'],
    },
    {
      key: 'nivel',
      header: 'Nivel',
      required: false,
      example: 'principiante',
      help: 'principiante, intermedio o avanzado',
    },
    {
      key: 'region',
      header: 'Región',
      required: false,
      example: 'inferior',
      help: 'inferior, superior, tronco o cuerpo completo',
    },
    {
      key: 'material',
      header: 'Material',
      required: false,
      example: 'Kettlebell',
      help: 'Nombres o claves separados por |',
    },
    {
      key: 'descripcion_cliente',
      header: 'Descripción cliente',
      required: false,
      example: 'Sentadilla con peso al pecho.',
      help: 'Texto para el cliente',
    },
    {
      key: 'descripcion_entrenador',
      header: 'Descripción entrenador',
      required: false,
      example: '',
      help: '',
    },
  ],
  assessments: [
    {
      key: 'email_cliente',
      header: 'Email cliente',
      required: true,
      example: 'ana@example.com',
      help: 'Cliente existente (y asignado a ti)',
      aliases: ['email', 'cliente'],
    },
    {
      key: 'fecha',
      header: 'Fecha',
      required: true,
      example: '01/09/2026',
      help: 'dd/mm/aaaa o aaaa-mm-dd',
    },
    {
      key: 'test',
      header: 'Test',
      required: true,
      example: 'CMJ',
      help: 'Nombre o clave del test del catálogo',
    },
    {
      key: 'valor',
      header: 'Valor',
      required: true,
      example: '31,2',
      help: 'Un valor o intentos separados por | (30,1|31,4)',
      aliases: ['valores', 'intentos'],
    },
    {
      key: 'lado',
      header: 'Lado',
      required: false,
      example: '',
      help: 'vacío, izquierdo o derecho',
    },
    { key: 'contexto', header: 'Contexto', required: false, example: 'Reevaluación', help: '' },
  ],
  references: [
    {
      key: 'titulo',
      header: 'Título',
      required: true,
      example: 'Effects of resistance training…',
      help: '',
    },
    {
      key: 'autores',
      header: 'Autores',
      required: false,
      example: 'Smith J|Pérez L',
      help: 'Separados por |',
    },
    {
      key: 'anio',
      header: 'Año',
      required: false,
      example: '2021',
      help: '',
      aliases: ['ano', 'year'],
    },
    { key: 'revista', header: 'Revista', required: false, example: 'Sports Med', help: '' },
    {
      key: 'doi',
      header: 'DOI',
      required: false,
      example: '10.1007/s40279-021-01492-5',
      help: 'Empieza por 10.',
    },
    { key: 'pmid', header: 'PMID', required: false, example: '', help: 'Solo números' },
    { key: 'url', header: 'URL', required: false, example: '', help: '' },
    {
      key: 'diseno',
      header: 'Diseño',
      required: false,
      example: 'revisión sistemática',
      help: 'Tipo de estudio; vacío = opinión de experto',
    },
  ],
  // Normative reference values of the centre (restructure phase 16): one row per group.
  reference_values: [
    {
      key: 'test',
      header: 'Test',
      required: true,
      example: 'handgrip_strength',
      help: 'Nombre o clave del test del catálogo',
    },
    {
      key: 'variable',
      header: 'Variable',
      required: true,
      example: 'Fuerza de prensión (mano dominante)',
      help: 'Qué mide la referencia',
    },
    { key: 'unidad', header: 'Unidad', required: true, example: 'kg', help: 'kg, s, cm, W…' },
    {
      key: 'poblacion',
      header: 'Población',
      required: true,
      example: 'adults_general',
      help: 'Clave o nombre de la población del catálogo',
      aliases: ['population'],
    },
    { key: 'edad_min', header: 'Edad mín.', required: false, example: '30', help: 'Años' },
    { key: 'edad_max', header: 'Edad máx.', required: false, example: '39', help: 'Años' },
    {
      key: 'sexo',
      header: 'Sexo',
      required: false,
      example: 'mujer',
      help: 'mujer, hombre o mixto (vacío = mixto)',
    },
    { key: 'nivel', header: 'Nivel', required: false, example: '', help: 'p. ej. amateur, élite' },
    {
      key: 'deporte',
      header: 'Deporte',
      required: false,
      example: '',
      help: 'Clave del deporte; vacío = cualquiera',
    },
    { key: 'n', header: 'N', required: false, example: '250', help: 'Tamaño de la muestra' },
    {
      key: 'estadistico',
      header: 'Estadístico',
      required: true,
      example: 'media y DE',
      help: 'media y DE, mediana, percentiles o punto de corte',
      aliases: ['estadistica', 'tipo'],
    },
    { key: 'media', header: 'Media', required: false, example: '29,4', help: 'Con media y DE' },
    { key: 'de', header: 'DE', required: false, example: '5,1', help: 'Con media y DE' },
    { key: 'mediana', header: 'Mediana', required: false, example: '', help: 'Con mediana' },
    { key: 'q1', header: 'Q1', required: false, example: '', help: 'Percentil 25 (opcional)' },
    { key: 'q3', header: 'Q3', required: false, example: '', help: 'Percentil 75 (opcional)' },
    {
      key: 'percentiles',
      header: 'Percentiles',
      required: false,
      example: '',
      help: 'P10=21|P50=29|P90=37',
    },
    { key: 'corte', header: 'Corte', required: false, example: '', help: 'Con punto de corte' },
    {
      key: 'direccion',
      header: 'Dirección',
      required: false,
      example: '',
      help: 'por debajo o por encima (del corte)',
    },
    {
      key: 'significado',
      header: 'Significado',
      required: false,
      example: '',
      help: 'Qué indica superar el corte (descriptivo, nunca un diagnóstico)',
    },
    {
      key: 'metodo',
      header: 'Método',
      required: false,
      example: 'Dinamómetro Jamar, sentado, codo a 90°',
      help: 'Método o dispositivo de medida',
    },
    {
      key: 'fuente_doi',
      header: 'Fuente DOI',
      required: false,
      example: '10.1371/journal.pone.0113637',
      help: 'DOI de una fuente ya registrada (Ciencia o importación de referencias)',
      aliases: ['doi'],
    },
    {
      key: 'fuente_pmid',
      header: 'Fuente PMID',
      required: false,
      example: '',
      help: 'PMID de una fuente ya registrada (DOI o PMID obligatorio)',
      aliases: ['pmid'],
    },
    {
      key: 'condicion',
      header: 'Condición',
      required: false,
      example: '',
      help: 'Condiciones de medida (superficie, momento de la temporada…)',
    },
    {
      key: 'limitaciones',
      header: 'Limitaciones',
      required: false,
      example: '',
      help: 'Por qué puede no aplicar',
    },
    { key: 'notas', header: 'Notas', required: false, example: '', help: 'Aplicabilidad' },
  ],
};

// Value parsers shared by the row schemas (Spanish input → canonical values).
const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
const opt = <T extends z.ZodType>(t: T) =>
  z.preprocess((v) => (blank(v) ? undefined : typeof v === 'string' ? v.trim() : v), t.optional());

/** dd/mm/yyyy, d/m/yyyy or yyyy-mm-dd → yyyy-mm-dd (real calendar dates only). */
export const importDate = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const s = v.trim();
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    return m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : s;
  },
  z.iso.date({ error: 'Fecha no válida (dd/mm/aaaa o aaaa-mm-dd)' }),
);

const decimal = z.preprocess(
  (v) => (typeof v === 'string' ? Number(v.trim().replace(/\s/g, '').replace(',', '.')) : v),
  z.number({ error: 'Número no válido' }).finite(),
);

const mapped = <T extends string>(map: Record<string, T>, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (map[norm(v)] ?? v) : v),
    z.enum(Object.values(map) as [T, ...T[]], { error: `${label} no válido` }),
  );

const SEX_MAP = {
  mujer: 'female',
  femenino: 'female',
  f: 'female',
  hombre: 'male',
  masculino: 'male',
  m: 'male',
  h: 'male',
  otro: 'other',
  'no indica': 'undisclosed',
  female: 'female',
  male: 'male',
  other: 'other',
} as const;
const MODALITY_MAP = {
  presencial: 'in_person',
  online: 'online',
  hibrido: 'hybrid',
  hibrida: 'hybrid',
} as const;
const EXPERIENCE_MAP = {
  ninguna: 'none',
  principiante: 'beginner',
  intermedio: 'intermediate',
  intermedia: 'intermediate',
  avanzado: 'advanced',
  avanzada: 'advanced',
} as const;
const LEVEL_MAP = {
  principiante: 'beginner',
  intermedio: 'intermediate',
  avanzado: 'advanced',
} as const;
const REGION_MAP = {
  inferior: 'lower',
  'tren inferior': 'lower',
  superior: 'upper',
  'tren superior': 'upper',
  tronco: 'trunk',
  core: 'trunk',
  'cuerpo completo': 'full_body',
} as const;
const SIDE_MAP = {
  izquierdo: 'left',
  izquierda: 'left',
  izq: 'left',
  derecho: 'right',
  derecha: 'right',
  der: 'right',
  ambos: 'both',
  bilateral: 'both',
} as const;
const DESIGN_MAP: Record<string, (typeof STUDY_DESIGNS)[number]> = {
  ...Object.fromEntries(STUDY_DESIGNS.map((d) => [d, d])),
  guia: 'guideline',
  'guia de practica clinica': 'guideline',
  posicionamiento: 'position_stand',
  consenso: 'consensus',
  'revision paraguas': 'umbrella_review',
  'revision sistematica': 'systematic_review',
  metaanalisis: 'meta_analysis',
  'meta-analisis': 'meta_analysis',
  'ensayo aleatorizado': 'rct',
  eca: 'rct',
  'ensayo no aleatorizado': 'non_randomized_trial',
  cohortes: 'cohort',
  transversal: 'cross_sectional',
  'serie de casos': 'case_series',
  mecanistico: 'mechanistic',
  'revision narrativa': 'narrative_review',
  'opinion de experto': 'expert_opinion',
  libro: 'book',
  web: 'website',
};

const STATISTIC_MAP = {
  'media y de': 'mean_sd',
  'media de': 'mean_sd',
  media_de: 'mean_sd',
  mean_sd: 'mean_sd',
  media: 'mean_sd',
  mediana: 'median_iqr',
  'mediana y ric': 'median_iqr',
  median_iqr: 'median_iqr',
  percentiles: 'percentiles',
  'punto de corte': 'cutoff',
  corte: 'cutoff',
  cutoff: 'cutoff',
} as const;
const REF_SEX_MAP = {
  mujer: 'female',
  mujeres: 'female',
  femenino: 'female',
  hombre: 'male',
  hombres: 'male',
  masculino: 'male',
  mixto: 'mixed',
  ambos: 'mixed',
  todos: 'mixed',
} as const;
const DIRECTION_MAP = {
  'por debajo': 'below',
  debajo: 'below',
  menor: 'below',
  below: 'below',
  'por encima': 'above',
  encima: 'above',
  mayor: 'above',
  above: 'above',
} as const;
/** «P10=21|P50=29|P90=37» → { p10: 21, p50: 29, p90: 37 }. */
const percentileList = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    // Bounded input and a linear pattern on trimmed parts (no backtracking on long blanks).
    if (v.length > 500) return null;
    const out: Record<string, number> = {};
    for (const part of v
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean)) {
      const m = /^p?\s*(\d{1,2})\s*[=:]\s*(-?\d+(?:[.,]\d+)?)$/i.exec(part);
      if (!m) return null;
      out[`p${Number(m[1])}`] = Number(m[2]!.replace(',', '.'));
    }
    return out;
  },
  z
    .record(z.string(), z.number().finite(), { error: 'Formato: P10=21|P50=29|P90=37' })
    .refine((r) => Object.keys(r).length >= 2, 'Al menos 2 percentiles'),
);
const ageNum = z.coerce.number().int('Número entero').min(0).max(120);

export const importRowSchemas = {
  clients: z.object({
    nombre: z.string().trim().min(1, 'Obligatorio').max(80),
    apellidos: z.string().trim().min(1, 'Obligatorio').max(120),
    fecha_nacimiento: importDate,
    sexo: opt(mapped(SEX_MAP, 'Sexo')),
    email: opt(
      z
        .email('Email no válido')
        .max(254)
        .transform((e) => e.toLowerCase()),
    ),
    telefono: opt(z.string().max(30)),
    modalidad: opt(mapped(MODALITY_MAP, 'Modalidad')),
    experiencia: opt(mapped(EXPERIENCE_MAP, 'Experiencia')),
    sesiones_semana: opt(z.coerce.number().int('Número entero').min(1).max(14)),
    objetivo: opt(z.string().max(120)),
    deporte: opt(z.string().max(120)),
  }),
  exercises: z.object({
    nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
    patron: opt(z.string().max(120)),
    nivel: opt(mapped(LEVEL_MAP, 'Nivel')),
    region: opt(mapped(REGION_MAP, 'Región')),
    material: opt(z.string().max(500)),
    descripcion_cliente: opt(z.string().max(600)),
    descripcion_entrenador: opt(z.string().max(4000)),
  }),
  assessments: z.object({
    email_cliente: z.email('Email no válido').transform((e) => e.toLowerCase()),
    fecha: importDate,
    test: z.string().trim().min(1, 'Obligatorio').max(120),
    valor: z.preprocess(
      (v) => (typeof v === 'string' ? v.split('|').filter((x) => x.trim() !== '') : v),
      z.array(decimal).min(1, 'Obligatorio').max(10),
    ),
    lado: opt(mapped(SIDE_MAP, 'Lado')),
    contexto: opt(z.string().max(200)),
  }),
  references: z.object({
    titulo: z.string().trim().min(5, 'Mínimo 5 caracteres').max(500),
    autores: z.preprocess(
      (v) =>
        typeof v === 'string'
          ? v
              .split('|')
              .map((x) => x.trim())
              .filter(Boolean)
          : v,
      z.array(z.string().max(120)).max(60),
    ),
    anio: opt(z.coerce.number().int().min(1900).max(2100)),
    revista: opt(z.string().max(200)),
    doi: opt(z.string().regex(/^10\.[0-9]{4,9}\/\S+$/, 'DOI no válido (debe empezar por 10.)')),
    pmid: opt(z.string().regex(/^[0-9]{1,9}$/, 'PMID no válido')),
    url: opt(z.url('URL no válida').max(500)),
    diseno: opt(mapped(DESIGN_MAP, 'Diseño')),
  }),
  reference_values: z
    .object({
      test: z.string().trim().min(1, 'Obligatorio').max(120),
      variable: z.string().trim().min(2, 'Obligatorio').max(200),
      unidad: z.string().trim().min(1, 'Obligatorio').max(30),
      poblacion: z.string().trim().min(1, 'Obligatorio').max(120),
      edad_min: opt(ageNum),
      edad_max: opt(ageNum),
      sexo: opt(mapped(REF_SEX_MAP, 'Sexo')),
      nivel: opt(z.string().max(80)),
      deporte: opt(z.string().max(120)),
      n: opt(z.coerce.number().int('Número entero').min(1).max(10_000_000)),
      estadistico: mapped(STATISTIC_MAP, 'Estadístico'),
      media: opt(decimal),
      de: opt(decimal),
      mediana: opt(decimal),
      q1: opt(decimal),
      q3: opt(decimal),
      percentiles: opt(percentileList),
      corte: opt(decimal),
      direccion: opt(mapped(DIRECTION_MAP, 'Dirección')),
      significado: opt(z.string().max(300)),
      metodo: opt(z.string().max(300)),
      fuente_doi: opt(
        z
          .string()
          .regex(/^10\.[0-9]{4,9}\/\S+$/, 'DOI no válido (debe empezar por 10.)')
          .transform((d) => d.toLowerCase()),
      ),
      fuente_pmid: opt(z.string().regex(/^[0-9]{1,9}$/, 'PMID no válido')),
      condicion: opt(z.string().max(500)),
      limitaciones: opt(z.string().max(1000)),
      notas: opt(z.string().max(1000)),
    })
    .superRefine((d, c) => {
      const need = (path: string, message: string) =>
        c.addIssue({ code: 'custom', path: [path], message });
      if (d.edad_min != null && d.edad_max != null && d.edad_min > d.edad_max)
        need('edad_max', 'Debe ser mayor o igual que la edad mínima');
      if (!d.fuente_doi && !d.fuente_pmid)
        need('fuente_doi', 'Indica el DOI o el PMID de la fuente');
      if (d.estadistico === 'mean_sd') {
        if (d.media == null) need('media', 'Obligatoria con media y DE');
        if (d.de == null) need('de', 'Obligatoria con media y DE');
        else if (d.de <= 0) need('de', 'Debe ser mayor que 0');
      }
      if (d.estadistico === 'median_iqr' && d.mediana == null)
        need('mediana', 'Obligatoria con mediana');
      if (d.estadistico === 'percentiles' && !d.percentiles)
        need('percentiles', 'Obligatorios con percentiles');
      if (d.estadistico === 'cutoff') {
        if (d.corte == null) need('corte', 'Obligatorio con punto de corte');
        if (!d.direccion) need('direccion', 'Indica por debajo o por encima');
        if (!d.significado) need('significado', 'Indica qué significa superarlo');
      }
    }),
} as const;

export type ImportRow<E extends ImportEntity> = z.infer<(typeof importRowSchemas)[E]>;
