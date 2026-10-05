/**
 * The session table (restructure §10, docs/UX_FLOW.md §2.3): what each cell accepts and shows.
 * Pure functions: the grid parses what the trainer types (or pastes from Excel) into prescription
 * fields, and formats the prescription back into cell text. Validation of ranges stays in
 * validatePrescription; here only the notation is checked.
 */
import { normalizeName } from '../library/text';
import type { Prescription } from './prescription';

export type GridColumn = 'sets' | 'reps' | 'load' | 'rir' | 'rpe' | 'rest';

/** Columns of the table, in order. «exercise», «category» and «notes» are not prescription cells. */
export const GRID_COLUMNS = [
  { key: 'exercise', label: 'Ejercicio' },
  { key: 'category', label: 'Cat.' },
  { key: 'sets', label: 'Series' },
  { key: 'reps', label: 'Reps' },
  { key: 'load', label: 'Carga' },
  { key: 'rir', label: 'RIR' },
  { key: 'rpe', label: 'RPE' },
  { key: 'rest', label: 'Desc.' },
  { key: 'notes', label: 'Notas' },
] as const;
export type GridKey = (typeof GRID_COLUMNS)[number]['key'];

export type CellResult = { ok: true; patch: Prescription } | { ok: false; error: string };

const ok = (patch: Prescription): CellResult => ({ ok: true, patch });
const fail = (error: string): CellResult => ({ ok: false, error });

/** "8,5" → 8.5; null when it is not a plain number. */
function num(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** "6-8", "6–8", "6 a 8", "6/8" → [6, 8]; "8" → [8, 8]. */
function numRange(text: string): [number, number] | null {
  const t = text.trim();
  const one = num(t);
  if (one != null) return [one, one];
  const m = /^(\d+(?:[.,]\d+)?)\s*(?:-|–|—|a|\/)\s*(\d+(?:[.,]\d+)?)$/i.exec(t);
  if (!m) return null;
  const a = num(m[1]!);
  const b = num(m[2]!);
  return a != null && b != null ? [a, b] : null;
}

const isInt = (n: number) => Number.isInteger(n);

const lower = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** SERIES: a whole number. Empty clears it. */
export function parseSets(text: string): CellResult {
  if (!text.trim()) return ok({ sets: null });
  const n = num(text);
  if (n == null || !isInt(n)) return fail('Escribe un número de series, p. ej. 4.');
  return ok({ sets: n });
}

/** Seconds from "30", "30 s", "30\"", "1:30", "2 min", "2'", "2'30". */
function parseSeconds(text: string): number | null {
  const t = lower(text).replace(/\s+/g, ' ');
  let m = /^(\d+):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+)\s*'\s*(\d{1,2})\s*(?:"|''|s)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+(?:[.,]\d+)?)\s*(?:min|mins|minutos?|')$/.exec(t);
  if (m) return Math.round(Number(m[1]!.replace(',', '.')) * 60);
  m = /^(\d+)\s*(?:s|seg|segs|segundos?|"|'')?$/.exec(t);
  if (m) return Number(m[1]);
  return null;
}

const WORK_CLEAR: Prescription = {
  repsMin: null,
  repsMax: null,
  durationS: null,
  distanceM: null,
  contacts: null,
};

/**
 * REPS: repetitions ("8", "6-8"), time ("30 s", "1:00"), distance ("20 m") or contacts
 * ("10 contactos"). One kind replaces the others. Empty clears it.
 */
export function parseReps(text: string): CellResult {
  const t = lower(text);
  if (!t) return ok(WORK_CLEAR);
  const r = numRange(t);
  if (r) {
    if (!isInt(r[0]) || !isInt(r[1]))
      return fail('Las repeticiones son números enteros, p. ej. 8 o 6-8.');
    return ok({ ...WORK_CLEAR, repsMin: r[0], repsMax: r[1] });
  }
  let m = /^(\d+(?:[.,]\d+)?)\s*m(?:etros?)?$/.exec(t);
  if (m) return ok({ ...WORK_CLEAR, distanceM: Number(m[1]!.replace(',', '.')) });
  m = /^(\d+)\s*(?:contactos?|cont\.?|saltos?)$/.exec(t);
  if (m) return ok({ ...WORK_CLEAR, contacts: Number(m[1]) });
  if (/[a-z":']/.test(t)) {
    const s = parseSeconds(t);
    if (s != null && s > 0) return ok({ ...WORK_CLEAR, durationS: s });
  }
  return fail('Escribe repeticiones (8 o 6-8), tiempo (30 s), distancia (20 m) o contactos.');
}

/** Notes that the CARGA cell owns (so a new kg or % replaces them). */
const LOAD_NOTES: [RegExp, string][] = [
  [/^(?:pc|peso corporal|bw|bodyweight|autocarga|sin carga)$/, 'Peso corporal'],
  [/^(?:banda|goma|band)\b(.*)$/, 'Banda'],
];

/** True when an intensity note was written from the CARGA cell (band, bodyweight). */
export function isLoadNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const t = lower(note);
  return t === 'peso corporal' || t.startsWith('banda');
}

const LOAD_CLEAR: Prescription = { loadKg: null, loadPct1rm: null };

/**
 * CARGA: kilos ("80", "80 kg", "82,5kg"), % of 1RM ("75 %", "75%1RM"), effort ("RPE 8", "@8"),
 * a band ("banda roja") or bodyweight ("PC", "peso corporal"). One kind replaces the others; the
 * band/bodyweight note is only cleared when it came from this cell. Empty clears the load.
 */
export function parseLoad(text: string, current: Prescription = {}): CellResult {
  const t = lower(text);
  const clearNote = isLoadNote(current.intensityNote) ? { intensityNote: null } : {};
  if (!t) return ok({ ...LOAD_CLEAR, ...clearNote });
  let m = /^(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?)?$/.exec(t);
  if (m) return ok({ ...LOAD_CLEAR, ...clearNote, loadKg: Number(m[1]!.replace(',', '.')) });
  m = /^(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s*)?(?:1\s*rm|rm)?$/.exec(t);
  if (m) return ok({ ...LOAD_CLEAR, ...clearNote, loadPct1rm: Number(m[1]!.replace(',', '.')) });
  m = /^(?:rpe\s*|@\s*)(\d+(?:[.,]\d+)?)$/.exec(t);
  if (m)
    return ok({
      ...LOAD_CLEAR,
      ...clearNote,
      rpeTarget: Number(m[1]!.replace(',', '.')),
      rirMin: null,
      rirMax: null,
    });
  for (const [re, label] of LOAD_NOTES) {
    const b = re.exec(t);
    if (!b) continue;
    const rest = label === 'Banda' ? text.trim().replace(/^\S+\s*/, '') : '';
    return ok({ ...LOAD_CLEAR, intensityNote: rest ? `Banda ${rest}` : label });
  }
  return fail('Escribe kg (80), % de 1RM (75 %), RPE 8, «banda roja» o «PC» (peso corporal).');
}

/** RIR: "2" or "1-2" (0–10). Setting RIR clears RPE: use one or the other. Empty clears it. */
export function parseRir(text: string): CellResult {
  if (!text.trim()) return ok({ rirMin: null, rirMax: null });
  const r = numRange(text);
  if (!r || !isInt(r[0]) || !isInt(r[1])) return fail('Escribe el RIR, p. ej. 2 o 1-2.');
  return ok({ rirMin: r[0], rirMax: r[1], rpeTarget: null });
}

/** RPE: 1–10 in steps of 0,5. Setting RPE clears RIR: use one or the other. Empty clears it. */
export function parseRpe(text: string): CellResult {
  if (!text.trim()) return ok({ rpeTarget: null });
  const n = num(text.replace(/^\s*(?:rpe|@)\s*/i, ''));
  if (n == null) return fail('Escribe el RPE, p. ej. 8 u 8,5.');
  return ok({ rpeTarget: n, rirMin: null, rirMax: null });
}

/** DESC.: rest between sets, "90", "90 s", "2:30", "2 min", "2'30". Empty clears it. */
export function parseRest(text: string): CellResult {
  if (!text.trim()) return ok({ restS: null });
  const s = parseSeconds(text);
  if (s == null) return fail('Escribe el descanso en segundos (90) o minutos (2:30, 2 min).');
  return ok({ restS: s });
}

export function parseCell(col: GridColumn, text: string, current: Prescription = {}): CellResult {
  switch (col) {
    case 'sets':
      return parseSets(text);
    case 'reps':
      return parseReps(text);
    case 'load':
      return parseLoad(text, current);
    case 'rir':
      return parseRir(text);
    case 'rpe':
      return parseRpe(text);
    case 'rest':
      return parseRest(text);
  }
}

const dec = (n: number) => String(n).replace('.', ',');
const span = (a?: number | null, b?: number | null) =>
  a != null && b != null && a !== b
    ? `${dec(a)}-${dec(b)}`
    : a != null
      ? dec(a)
      : b != null
        ? dec(b)
        : '';
const clock = (s: number) =>
  s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Cell text for a prescription: what the grid shows and what editing starts from. */
export function formatCell(col: GridColumn, p: Prescription): string {
  switch (col) {
    case 'sets':
      return p.sets != null ? String(p.sets) : '';
    case 'reps':
      if (p.repsMin != null || p.repsMax != null) return span(p.repsMin, p.repsMax);
      if (p.durationS != null) return clock(p.durationS);
      if (p.distanceM != null) return `${dec(p.distanceM)} m`;
      if (p.contacts != null) return `${p.contacts} contactos`;
      return '';
    case 'load':
      if (p.loadKg != null) return `${dec(p.loadKg)} kg`;
      if (p.loadPct1rm != null) return `${dec(p.loadPct1rm)} %`;
      if (isLoadNote(p.intensityNote)) return p.intensityNote!;
      if (p.rpeTarget != null) return `RPE ${dec(p.rpeTarget)}`;
      return '';
    case 'rir':
      return span(p.rirMin, p.rirMax);
    case 'rpe':
      return p.rpeTarget != null ? dec(p.rpeTarget) : '';
    case 'rest':
      return p.restS != null ? clock(p.restS) : '';
  }
}

// ── Pasting from Excel / Google Sheets ───────────────────────────────────────

export interface PastedRow {
  /** 1-based line of the pasted text (for messages). */
  line: number;
  exercise: string;
  prescription: Prescription;
  notes: string | null;
  /** Cells that could not be read, by column. */
  errors: Partial<Record<GridColumn, string>>;
}

const HEADER: Record<string, GridKey> = {
  ejercicio: 'exercise',
  ejercicios: 'exercise',
  exercise: 'exercise',
  nombre: 'exercise',
  cat: 'category',
  categoria: 'category',
  category: 'category',
  series: 'sets',
  sets: 'sets',
  reps: 'reps',
  repeticiones: 'reps',
  rep: 'reps',
  carga: 'load',
  peso: 'load',
  kg: 'load',
  load: 'load',
  rir: 'rir',
  rpe: 'rpe',
  desc: 'rest',
  descanso: 'rest',
  rest: 'rest',
  notas: 'notes',
  nota: 'notes',
  observaciones: 'notes',
  notes: 'notes',
};

/** «DESC.» → rest, «Carga (kg)» → load: exact header names first, then known prefixes. */
function headerKey(cell: string): GridKey | null {
  const t = lower(cell).replace(/[^a-z]/g, '');
  if (!t) return null;
  if (HEADER[t]) return HEADER[t];
  const prefix = Object.keys(HEADER).find((k) => k.length >= 3 && t.startsWith(k));
  return prefix ? HEADER[prefix]! : null;
}

/**
 * Text copied from a spreadsheet (one row per line, cells separated by tabs) → rows of the
 * session table. A first row with known headers (EJERCICIO, SERIES, REPS…) maps the columns;
 * otherwise the order of the table is assumed (exercise, category, sets, reps, load, RIR, RPE,
 * rest, notes), or (exercise, sets, reps, load, …) when the second column holds a number.
 * Empty lines are skipped; at most 200 rows.
 */
const SHORT_LAYOUT: GridKey[] = ['exercise', 'sets', 'reps', 'load', 'rir', 'rpe', 'rest', 'notes'];
const FULL_LAYOUT: GridKey[] = GRID_COLUMNS.map((c) => c.key);

function readRow(cells: string[], line: number, columns: (GridKey | null)[]): PastedRow {
  const row: PastedRow = { line, exercise: '', prescription: {}, notes: null, errors: {} };
  cells.forEach((raw, i) => {
    const col = columns[i];
    const cell = raw.trim();
    if (!col || !cell) return;
    if (col === 'exercise') row.exercise = cell;
    else if (col === 'notes') row.notes = cell;
    else if (col !== 'category') {
      const r = parseCell(col, cell, row.prescription);
      if (r.ok) row.prescription = { ...row.prescription, ...r.patch };
      else row.errors[col] = r.error;
    }
  });
  return row;
}

/**
 * Text copied from a spreadsheet (one row per line, cells separated by tabs) → rows of the
 * session table. A first row with known headers (EJERCICIO, SERIES, REPS…) maps the columns.
 * Without headers, the order of the table is assumed, with or without the category column
 * (whichever reads more cells without errors). Empty lines are skipped; at most `max` rows.
 */
export function parseSessionTsv(text: string, max = 200): PastedRow[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l, i) => ({ cells: l.split('\t'), line: i + 1 }))
    .filter((l) => l.cells.some((c) => c.trim() !== ''));
  if (!lines.length) return [];
  const first = lines[0]!.cells.map(headerKey);
  if (first.filter(Boolean).length >= 2 && first.includes('exercise')) {
    return lines.slice(1, max + 1).map((l) => readRow(l.cells, l.line, first));
  }
  const rows = lines.slice(0, max);
  const errors = (layout: GridKey[]) =>
    rows
      .slice(0, 20)
      .reduce((n, l) => n + Object.keys(readRow(l.cells, l.line, layout).errors).length, 0);
  const layout = errors(FULL_LAYOUT) < errors(SHORT_LAYOUT) ? FULL_LAYOUT : SHORT_LAYOUT;
  return rows.map((l) => readRow(l.cells, l.line, layout));
}

/** Rows of the table → text to paste in Excel (tab-separated, with the header row). */
export function toSessionTsv(
  rows: {
    exercise: string;
    category?: string | null;
    prescription: Prescription;
    notes?: string | null;
  }[],
): string {
  const head = GRID_COLUMNS.map((c) => c.label.toUpperCase()).join('\t');
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  const body = rows.map((r) =>
    [
      clean(r.exercise),
      clean(r.category ?? ''),
      ...(['sets', 'reps', 'load', 'rir', 'rpe', 'rest'] as const).map((c) =>
        formatCell(c, r.prescription),
      ),
      clean(r.notes ?? ''),
    ].join('\t'),
  );
  return [head, ...body].join('\n');
}

// ── Recognizing exercises by name ────────────────────────────────────────────

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

interface Grams {
  grams: Map<string, number>;
  size: number;
}
const grams = (normalized: string): Grams => {
  const g = bigrams(normalized);
  return { grams: g, size: [...g.values()].reduce((s, n) => s + n, 0) };
};

function dice(a: Grams, b: Grams): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const [g, n] of a.grams) inter += Math.min(n, b.grams.get(g) ?? 0);
  return (2 * inter) / (a.size + b.size);
}

/** Dice coefficient on character bigrams (0–1): tolerant to typos and word order changes. */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return dice(grams(x), grams(y));
}

export interface NamedExercise {
  id: string;
  name: string;
  altNames?: string[];
  /** Published exercises win ties against drafts. */
  published?: boolean;
}

export interface NameMatch {
  /** Chosen automatically: exact name or alias, or a clear best match. */
  match: { id: string; name: string } | null;
  /** Best candidates (for the trainer to choose when there is no match). */
  candidates: { id: string; name: string; score: number }[];
}

const AUTO = 0.82;
const MARGIN = 0.08;

/**
 * Prepares the exercises once and returns a function that finds the exercise a pasted name refers
 * to. Exact matches (ignoring case, accents and punctuation) on the name or an alias win;
 * otherwise the most similar name is accepted only when it is clearly better than the next one.
 * Never guesses between close candidates.
 */
export function exerciseNameMatcher(exercises: NamedExercise[]): (query: string) => NameMatch {
  const prepared = exercises.map((e) => {
    const names = [e.name, ...(e.altNames ?? [])].map(normalizeName).filter(Boolean);
    return {
      id: e.id,
      name: e.name,
      published: e.published ?? true,
      names: new Set(names),
      grams: names.map(grams),
    };
  });
  return (query) => {
    const q = normalizeName(query);
    if (!q) return { match: null, candidates: [] };
    const qg = grams(q);
    const scored = prepared
      .map((e) => {
        const exact = e.names.has(q);
        const score = exact ? 1 : Math.max(0, ...e.grams.map((g) => dice(qg, g)));
        return { id: e.id, name: e.name, score, exact, published: e.published };
      })
      .sort((a, b) => b.score - a.score || Number(b.published) - Number(a.published));
    const candidates = scored.slice(0, 5).map(({ id, name, score }) => ({
      id,
      name,
      score: Math.round(score * 100) / 100,
    }));
    const exact = scored.filter((x) => x.exact);
    if (exact.length) {
      const pick = exact.find((x) => x.published) ?? exact[0]!;
      const tied = exact.filter((x) => x.published === pick.published).length;
      return { match: tied === 1 ? { id: pick.id, name: pick.name } : null, candidates };
    }
    const [best, next] = scored;
    if (best && best.score >= AUTO && (!next || best.score - next.score >= MARGIN))
      return { match: { id: best.id, name: best.name }, candidates };
    return { match: null, candidates };
  };
}

/** One-off version of exerciseNameMatcher. */
export function matchExerciseName(query: string, exercises: NamedExercise[]): NameMatch {
  return exerciseNameMatcher(exercises)(query);
}
