/**
 * CSV for exports and imports (§14: CSV injection). Pure.
 * - Export: `;` separator and decimal comma (Spanish Excel), UTF-8 BOM, RFC 4180 quoting, and any
 *   text cell starting with = + - @ (or tab/CR) is prefixed with `'` so spreadsheets never run it
 *   as a formula. Numbers stay numbers.
 * - Import: RFC 4180 parser with `;`/`,` auto-detection, BOM stripping and quoted newlines.
 */
export type Cell = string | number | boolean | null | undefined;

const DANGEROUS = /^[=+\-@\t\r]/;

/** Neutralizes spreadsheet formulas in text cells (CSV/XLSX export). */
export function safeText(v: string): string {
  return DANGEROUS.test(v) ? `'${v}` : v;
}

function formatCell(v: Cell, decimal: ',' | '.'): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', decimal) : '';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return safeText(v);
}

export function toCsv(
  rows: Cell[][],
  opts: { separator?: ';' | ','; decimal?: ',' | '.'; bom?: boolean } = {},
): string {
  const sep = opts.separator ?? ';';
  const dec = opts.decimal ?? (sep === ';' ? ',' : '.');
  const body = rows
    .map((r) =>
      r
        .map((c) => {
          const s = formatCell(c, dec);
          return /[";\n\r,]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(sep),
    )
    .join('\r\n');
  return ((opts.bom ?? true) ? '﻿' : '') + body + '\r\n';
}

/** Detects the separator from the header line (outside quotes). */
function detectSeparator(text: string): ';' | ',' | '\t' {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => first.split(ch).length - 1;
  const c = { ';': count(';'), ',': count(','), '\t': count('\t') };
  return (Object.entries(c).sort((a, b) => b[1] - a[1])[0]![0] as ';' | ',' | '\t') ?? ';';
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const sep = detectSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Blank lines are not rows.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Header row + data rows → records keyed by normalized header (accents/case/spaces ignored). */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function rowsToRecords(rows: string[][]): {
  headers: string[];
  records: Record<string, string>[];
} {
  const [head, ...data] = rows;
  const headers = (head ?? []).map(normalizeHeader);
  return {
    headers,
    records: data.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))),
  };
}
