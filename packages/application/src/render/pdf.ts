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
      .text(pdfText(`${sec.number}. ${sec.title}`));
    doc
      .moveTo(M, doc.y + 2)
      .lineTo(M + width, doc.y + 2)
      .strokeColor(C.line)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);
    for (const b of sec.blocks) block(doc, b, width, ensure);
    doc.moveDown(0.6);
  }

  ensure(40);
  doc.moveDown(0.5).fillColor(C.muted).font('Helvetica').fontSize(8);
  for (const f of report.footer) doc.text(pdfText(f), { width });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
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
    doc.moveDown(0.2);
  }
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
  if (b.kind === 'chart') chart(doc, b, width, ensure);
}

function chart(
  doc: PDFKit.PDFDocument,
  b: Extract<ReportBlock, { kind: 'chart' }>,
  width: number,
  ensure: (h: number) => void,
) {
  const h = 110;
  ensure(h + 30);
  const top = doc.y;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(C.text)
    .text(pdfText(`${b.title} (${b.unit})`), M, top);
  const y0 = top + 14;
  const left = M + 40;
  const w = Math.min(width - 40, 360);
  const values = b.points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  min -= pad;
  max += pad;
  const px = (i: number) =>
    left + (b.points.length === 1 ? w / 2 : (i / (b.points.length - 1)) * w);
  const py = (v: number) => y0 + h - ((v - min) / (max - min)) * h;
  doc.strokeColor(C.line).lineWidth(0.5);
  doc
    .moveTo(left, y0)
    .lineTo(left, y0 + h)
    .lineTo(left + w, y0 + h)
    .stroke();
  doc.font('Helvetica').fontSize(7).fillColor(C.muted);
  doc.text((Math.round(max * 10) / 10).toLocaleString('es-ES'), M, y0 - 3, {
    width: 36,
    align: 'right',
  });
  doc.text((Math.round(min * 10) / 10).toLocaleString('es-ES'), M, y0 + h - 6, {
    width: 36,
    align: 'right',
  });
  doc.strokeColor(C.accent).lineWidth(1.5);
  b.points.forEach((p, i) =>
    i === 0 ? doc.moveTo(px(i), py(p.value)) : doc.lineTo(px(i), py(p.value)),
  );
  doc.stroke();
  b.points.forEach((p, i) => {
    doc.circle(px(i), py(p.value), 2.5).fillColor(C.accent).fill();
    doc
      .fillColor(C.muted)
      .fontSize(7)
      .text(reportDate(p.date), px(i) - 25, y0 + h + 3, {
        width: 50,
        align: 'center',
        lineBreak: false,
      });
  });
  doc.x = M;
  doc.y = y0 + h + 16;
  doc.moveDown(0.3);
}
