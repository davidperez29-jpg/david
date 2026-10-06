/**
 * Client report → PDF (pdfkit, no browser on the server). Reproducible: the document dates come
 * from the report snapshot, so the same snapshot always yields the same bytes. Standard PDF fonts
 * (WinAnsi): characters outside that set are transliterated or replaced.
 */
import PDFDocument from 'pdfkit';
import { reportDate, type ClientReport, type ReportBlock } from '@tp/domain';

const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const TRANSLIT: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '≥': '>=',
  '≤': '<=',
  '≈': '~',
  '−': '-',
  '✓': 'sí',
  '🟢': '',
  '🟡': '',
  '🔴': '',
};
export function pdfText(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 256 || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else out += TRANSLIT[ch] ?? '?';
  }
  return out;
}

const C = {
  text: '#1f2933',
  muted: '#5f6b76',
  accent: '#0f766e',
  warn: '#b45309',
  line: '#d5dbe0',
};
const M = 50;

export async function reportPdf(report: ClientReport): Promise<Buffer> {
  const when = new Date(report.generatedAt);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: M, bottom: M + 20, left: M, right: M },
    bufferPages: true,
    info: {
      Title: pdfText(report.title),
      Subject: pdfText(report.subtitle),
      Creator: 'Plataforma de entrenamiento',
      Producer: 'Plataforma de entrenamiento',
      CreationDate: when,
      ModDate: when,
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));
  const width = doc.page.width - 2 * M;
  const bottom = () => doc.page.height - M - 20;
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
  };

  doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(20).text(pdfText(report.title));
  doc
    .moveDown(0.2)
    .fillColor(C.muted)
    .font('Helvetica')
    .fontSize(10)
    .text(pdfText(report.subtitle));
  doc.moveDown(1);

  for (const sec of report.sections) {
    ensure(40);
    doc
      .fillColor(C.accent)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(pdfText(`${sec.number}. ${sec.title}`), M, doc.y, { width });
    doc
      .moveTo(M, doc.y + 2)
      .lineTo(M + width, doc.y + 2)
      .strokeColor(C.line)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);
    // Consecutive charts are drawn as a compact two-column grid.
    for (let i = 0; i < sec.blocks.length; i++) {
      const b = sec.blocks[i]!;
      if (b.kind !== 'chart') {
        block(doc, b, width, ensure);
        continue;
      }
      const run: Extract<ReportBlock, { kind: 'chart' }>[] = [];
      while (sec.blocks[i]?.kind === 'chart')
        run.push(sec.blocks[i++] as Extract<ReportBlock, { kind: 'chart' }>);
      i--;
      chartGrid(doc, run, width, ensure);
    }
    doc.x = M;
    doc.moveDown(0.6);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // The page footer sits inside the bottom margin: lift it, or pdfkit would add a page.
    doc.page.margins.bottom = 0;
    if (i === range.count - 1)
      report.footer.forEach((f, k) =>
        doc
          .fillColor(C.muted)
          .font('Helvetica')
          .fontSize(7)
          .text(pdfText(f), M, doc.page.height - M - 24 + k * 9, { width, lineBreak: false }),
      );
    doc
      .fillColor(C.muted)
      .fontSize(8)
      .text(
        pdfText(
          `${report.title} · ${reportDate(report.generatedAt)} · Página ${i + 1} de ${range.count}`,
        ),
        M,
        doc.page.height - M,
        { width, align: 'center', lineBreak: false },
      );
  }
  doc.end();
  return done;
}

function block(
  doc: PDFKit.PDFDocument,
  b: ReportBlock,
  width: number,
  ensure: (h: number) => void,
) {
  doc.font('Helvetica').fontSize(10).fillColor(C.text);
  if (b.kind === 'text') {
    const t = pdfText(b.text);
    ensure(doc.heightOfString(t, { width }) + 6);
    doc
      .fillColor(b.tone === 'warn' ? C.warn : b.tone === 'muted' ? C.muted : C.text)
      .text(t, M, doc.y, { width });
    doc.moveDown(0.3);
  }
  if (b.kind === 'list') {
    for (const it of b.items) {
      const t = pdfText(it);
      ensure(doc.heightOfString(t, { width: width - 12 }) + 4);
      const y = doc.y;
      doc.text('•', M, y, { width: 10 });
      doc.text(t, M + 12, y, { width: width - 12 });
      doc.moveDown(0.15);
    }
    doc.x = M;
    doc.moveDown(0.2);
  }
  if (b.kind === 'radar') radarPdf(doc, b, width, ensure);
  if (b.kind === 'table') {
    const n = b.columns.length;
    // First column a bit wider when it holds labels (2-column key/value tables).
    const widths = n === 2 ? [width * 0.32, width * 0.68] : Array<number>(n).fill(width / n);
    const row = (cells: (string | number | null)[], bold: boolean) => {
      const texts = cells.map((c) =>
        pdfText(c == null ? '—' : typeof c === 'number' ? c.toLocaleString('es-ES') : c),
      );
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      const h =
        Math.max(...texts.map((t, i) => doc.heightOfString(t, { width: widths[i]! - 6 }))) + 6;
      ensure(h);
      const y = doc.y;
      let x = M;
      texts.forEach((t, i) => {
        doc.fillColor(bold ? C.muted : C.text).text(t, x + 3, y + 3, { width: widths[i]! - 6 });
        x += widths[i]!;
      });
      doc
        .moveTo(M, y + h)
        .lineTo(M + width, y + h)
        .strokeColor(C.line)
        .lineWidth(0.5)
        .stroke();
      doc.y = y + h;
    };
    row(b.columns, true);
    for (const r of b.rows) row(r, false);
    doc.x = M;
    doc.moveDown(0.5);
  }
}

const tick = (v: number, range: number) =>
  (Math.round(v * (range < 1 ? 100 : 10)) / (range < 1 ? 100 : 10)).toLocaleString('es-ES');

function chartGrid(
  doc: PDFKit.PDFDocument,
  charts: Extract<ReportBlock, { kind: 'chart' }>[],
  width: number,
  ensure: (h: number) => void,
) {
  const gap = 16;
  const cw = (width - gap) / 2;
  const h = 56;
  const cell = h + 34;
  for (let i = 0; i < charts.length; i += 2) {
    ensure(cell);
    const top = doc.y;
    charts.slice(i, i + 2).forEach((b, j) => chart(doc, b, M + j * (cw + gap), top, cw, h));
    doc.x = M;
    doc.y = top + cell;
  }
  doc.moveDown(0.3);
}

function chart(
  doc: PDFKit.PDFDocument,
  b: Extract<ReportBlock, { kind: 'chart' }>,
  x0: number,
  top: number,
  cw: number,
  h: number,
) {
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(C.text)
    .text(pdfText(`${b.title} (${b.unit})`), x0, top, {
      width: cw,
      height: 10,
      ellipsis: true,
      lineBreak: false,
    });
  const y0 = top + 14;
  const left = x0 + 30;
  const w = cw - 40;
  const values = b.points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= Math.abs(min) * 0.1 || 1;
    max += Math.abs(max) * 0.1 || 1;
  }
  const pad = (max - min) * 0.1;
  min -= pad;
  max += pad;
  const range = max - min;
  const px = (i: number) =>
    left + (b.points.length === 1 ? w / 2 : (i / (b.points.length - 1)) * w);
  const py = (v: number) => y0 + h - ((v - min) / range) * h;
  doc.strokeColor(C.line).lineWidth(0.5);
  doc
    .moveTo(left, y0)
    .lineTo(left, y0 + h)
    .lineTo(left + w, y0 + h)
    .stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor(C.muted);
  doc.text(tick(max, range), x0, y0 - 2, { width: 27, align: 'right', lineBreak: false });
  doc.text(tick(min, range), x0, y0 + h - 5, { width: 27, align: 'right', lineBreak: false });
  doc.strokeColor(C.accent).lineWidth(1.4);
  b.points.forEach((p, i) =>
    i === 0 ? doc.moveTo(px(i), py(p.value)) : doc.lineTo(px(i), py(p.value)),
  );
  doc.stroke();
  b.points.forEach((p, i) => {
    doc.circle(px(i), py(p.value), 2).fillColor(C.accent).fill();
    doc
      .fillColor(C.muted)
      .fontSize(6.5)
      .text(reportDate(p.date), px(i) - 24, y0 + h + 3, {
        width: 48,
        align: 'center',
        lineBreak: false,
      });
  });
}

/**
 * Radar as vectors (phase 6): same rules as the screen. Rings on the scale, the neutral ring
 * thicker, A dashed grey and B solid accent with a light fill, gaps where a dimension has no
 * data, axis labels and a legend. Values outside the range are clipped (real ones in the table).
 */
function radarPdf(
  doc: PDFKit.PDFDocument,
  b: Extract<ReportBlock, { kind: 'radar' }>,
  width: number,
  ensure: (h: number) => void,
) {
  const size = 230;
  const R = 78;
  ensure(size + 40);
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(C.text)
    .text(pdfText(b.title), M, doc.y, { width });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(C.muted)
    .text(pdfText(b.scaleLabel), M, doc.y, { width });
  const top = doc.y + 4;
  const cx = M + width / 2;
  const cy = top + size / 2;
  const n = b.axes.length;
  const [lo, hi] = b.range;
  const rad = (v: number) => (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pt = (i: number, r: number): [number, number] => [
    cx + Math.cos(ang(i)) * r * R,
    cy + Math.sin(ang(i)) * r * R,
  ];
  const step = hi - lo > 10 ? 25 : 1;
  for (let v = lo; v <= hi + 1e-9; v += step) {
    const neutral = Math.abs(v - b.neutral) < 1e-9;
    b.axes.forEach((_, i) => {
      const [x, y] = pt(i, rad(v));
      if (i === 0) doc.moveTo(x, y);
      else doc.lineTo(x, y);
    });
    doc
      .closePath()
      .lineWidth(neutral ? 1.2 : 0.4)
      .strokeColor(neutral ? C.muted : C.line)
      .stroke();
  }
  b.axes.forEach((a, i) => {
    const [x, y] = pt(i, 1);
    doc.moveTo(cx, cy).lineTo(x, y).lineWidth(0.4).strokeColor(C.line).stroke();
    const [lx, ly] = pt(i, 1.22);
    const w = 90;
    const align = Math.abs(lx - cx) < 6 ? 'center' : lx > cx ? 'left' : 'right';
    const x0 = align === 'center' ? lx - w / 2 : align === 'left' ? lx : lx - w;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(C.text)
      .text(pdfText(a), x0, ly - 4, { width: w, align });
  });
  for (const l of b.layers) {
    const color = l.variant === 'current' ? C.accent : C.muted;
    const all = l.values.every((v) => v != null);
    if (all && l.variant === 'current') {
      l.values.forEach((v, i) => {
        const [x, y] = pt(i, rad(v!));
        if (i === 0) doc.moveTo(x, y);
        else doc.lineTo(x, y);
      });
      doc.closePath().fillOpacity(0.15).fillColor(color).fill().fillOpacity(1);
    }
    // Outline segments only between consecutive axes that both have a value.
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (n < 3 && j === 0) continue;
      const a = l.values[i];
      const c = l.values[j];
      if (a == null || c == null) continue;
      const [x1, y1] = pt(i, rad(a));
      const [x2, y2] = pt(j, rad(c));
      doc.moveTo(x1, y1).lineTo(x2, y2);
      if (l.variant === 'previous') doc.dash(4, { space: 3 });
      doc.lineWidth(1.5).strokeColor(color).stroke().undash();
    }
    l.values.forEach((v, i) => {
      if (v == null) return;
      const [x, y] = pt(i, rad(v));
      doc.circle(x, y, 2.5).fillColor(color).fill();
    });
  }
  // Legend.
  let lx = M;
  const ly = top + size + 4;
  for (const [label, color, dashed, w] of [
    ...b.layers.map(
      (l) =>
        [
          l.label,
          l.variant === 'current' ? C.accent : C.muted,
          l.variant === 'previous',
          1.5,
        ] as const,
    ),
    [b.neutralLabel, C.muted, false, 1.2] as const,
  ]) {
    doc.moveTo(lx, ly + 4).lineTo(lx + 18, ly + 4);
    if (dashed) doc.dash(4, { space: 3 });
    doc.lineWidth(w).strokeColor(color).stroke().undash();
    const t = pdfText(label);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.muted)
      .text(t, lx + 22, ly, { lineBreak: false });
    lx += 22 + doc.widthOfString(t) + 14;
  }
  doc.x = M;
  doc.y = ly + 16;
}
