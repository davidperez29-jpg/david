/**
 * Report language rules (restructure phase 6, docs/REPORT_SYSTEM.md §5; SCIENCE_SYSTEM.md §3).
 * - Never «previene / evita lesiones» (or «reduce el riesgo de lesión») unless the evidence
 *   behind it measured injury incidence; a change in a risk factor is not prevention.
 * - Never «apto», «alta deportiva» or «alta médica»: the platform's maximum is «Listo para
 *   valoración»; the decision belongs to the responsible professional.
 * - No diagnoses or promises («diagnóstico de», «padece», «cura», «garantiza»).
 * The engine's own texts follow these rules (tested); the trainer's free text is checked when a
 * report is generated, with the reason, so it can be rewritten.
 */
import type { Report } from './report';

export interface LanguageIssue {
  phrase: string;
  rule: 'prevention' | 'aptitude' | 'diagnosis';
  message: string;
}

const PREVENTION = [
  /\b(previene[n]?|prevenir|prevención de|evita[n]?|evitar|elimina[n]?)\b[^.;:]{0,40}?\blesi[oó]n(es)?\b/giu,
  /\breduce[n]?\s+(el|la|los|las)\s+(riesgo|incidencia|n[uú]mero)s?\s+de\s+lesi[oó]n(es)?\b/giu,
  /\blibre de lesiones\b/giu,
];
const APTITUDE = [/\b(apt[oa]s?)\b/giu, /\balta\s+(deportiva|m[eé]dica|competitiva)\b/giu];
const DIAGNOSIS = [
  /\bdiagn[oó]stico\s+de\b/giu,
  /\b(padece|sufre)\s+(un|una)\b/giu,
  /\b(cura[n]?|garantiza[n]?)\b/giu,
];

const MESSAGES: Record<LanguageIssue['rule'], string> = {
  prevention:
    'Solo puede decirse que algo previene lesiones si la evidencia midió la incidencia de lesiones; si mide un factor de riesgo, di qué factor mejora.',
  aptitude:
    'La plataforma no declara a nadie apto ni da el alta: como mucho «Listo para valoración». La decisión es del profesional responsable.',
  diagnosis: 'Un informe de entrenamiento no diagnostica ni promete resultados.',
};

/** Problems of one text; `incidenceEvidence` allows prevention claims backed by incidence data. */
export function languageIssues(
  text: string,
  opts: { incidenceEvidence?: boolean } = {},
): LanguageIssue[] {
  const out: LanguageIssue[] = [];
  const scan = (res: RegExp[], rule: LanguageIssue['rule']) => {
    for (const re of res)
      for (const m of text.matchAll(re)) out.push({ phrase: m[0], rule, message: MESSAGES[rule] });
  };
  if (!opts.incidenceEvidence) scan(PREVENTION, 'prevention');
  scan(APTITUDE, 'aptitude');
  scan(DIAGNOSIS, 'diagnosis');
  return out;
}

/** Every text of a report (titles, texts, lists, table cells, chart and radar titles). */
export function reportTexts(r: Report): string[] {
  const out = [r.title, r.subtitle, ...r.footer];
  for (const s of r.sections) {
    out.push(s.title);
    for (const b of s.blocks) {
      if (b.kind === 'text') out.push(b.text);
      if (b.kind === 'list') out.push(...b.items);
      if (b.kind === 'table')
        out.push(...b.columns, ...b.rows.flat().filter((c): c is string => typeof c === 'string'));
      if (b.kind === 'chart') out.push(b.title);
      if (b.kind === 'radar') out.push(b.title, b.scaleLabel, b.neutralLabel, ...b.axes);
    }
  }
  return out;
}

export function reportLanguageIssues(
  r: Report,
  opts: { incidenceEvidence?: boolean } = {},
): LanguageIssue[] {
  return reportTexts(r).flatMap((t) => languageIssues(t, opts));
}
