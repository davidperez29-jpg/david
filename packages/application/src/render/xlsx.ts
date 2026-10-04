/**
 * XLSX writer/reader (exceljs). Text cells that could run as formulas are neutralized (§14,
 * CSV/XLSX injection); numbers stay numbers. Reading turns every cell into the string a CSV
 * would have, so imports validate both formats the same way.
 */
import ExcelJS from 'exceljs';
import { safeText, type Cell } from '@tp/domain';

export interface Sheet {
  name: string;
  rows: Cell[][];
  /** Row indexes (0-based) shown in bold, e.g. headers or section titles. */
  bold?: number[];
}

export async function toXlsx(sheets: Sheet[], createdAt: Date): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Plataforma de entrenamiento';
  wb.created = createdAt;
  wb.modified = createdAt;
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    for (const [i, r] of s.rows.entries()) {
      const row = ws.addRow(
        r.map((c) =>
          c == null
            ? null
            : typeof c === 'string'
              ? safeText(c)
              : typeof c === 'boolean'
                ? c
                  ? 'sí'
                  : 'no'
                : c,
        ),
      );
      if (s.bold?.includes(i)) row.font = { bold: true };
    }
    ws.columns.forEach((col) => {
      let max = 8;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        max = Math.max(max, Math.min(60, String(cell.value ?? '').length + 2));
      });
      col.width = max;
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v && typeof v.text === 'string') return v.text;
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('error' in v) return '';
  }
  return String(v);
}

/** First worksheet as rows of strings (blank rows dropped). */
export async function readXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value).trim());
    if (cells.some((x) => x !== '')) rows.push(cells);
  });
  return rows;
}
