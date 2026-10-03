/**
 * Scientific QA validators (MASTER_SPECIFICATION §10.6). Pure checks over sources, findings and
 * claims. `error` blocks publication; `warning` must be reviewed by a person.
 */
import type { EvidenceLevel } from './grading';

export type QaSeverity = 'error' | 'warning';
export interface QaIssue {
  code: string;
  severity: QaSeverity;
  message: string;
  target: { type: 'source' | 'finding' | 'claim'; key: string };
}

export interface QaSource {
  key: string;
  doi: string | null;
  pmid: string | null;
  verificationStatus:
    'verified' | 'verified_with_corrections' | 'unverified' | 'retracted' | 'non_scientific';
  verifiedAt: Date | string | null;
  verificationMethod: string | null;
  populationSummary: string | null;
}
export interface QaFinding {
  key: string;
  sourceKey: string;
  populationSlug: string;
  quote: string | null;
  effectValue: number | null;
}
export interface QaClaim {
  key: string;
  statement: string;
  status: string;
  findings: { findingKey: string; role: 'supports' | 'contradicts' | 'context' }[];
  appliesTo: string[];
  level: EvidenceLevel;
}

const DOI_RE = /^10\.[0-9]{4,9}\/\S+$/;
/** Clinical/causal wording that needs evidence it rarely has (§71: no prevention-as-fact). */
const CAUSAL_RE =
  /\b(previene|prevenir|evita(?:r)? (?:las |la )?lesi|garantiza|cura|elimina el riesgo|reduce a la mitad|siempre|nunca falla)\b/i;
const NUMBER_RE = /\d+(?:[.,]\d+)?\s*(?:%|kg|m\/s|series|s\b|min)/i;

export function qaSource(s: QaSource): QaIssue[] {
  const t = { type: 'source' as const, key: s.key };
  const out: QaIssue[] = [];
  if (s.doi && !DOI_RE.test(s.doi))
    out.push({
      code: 'doi_format',
      severity: 'error',
      message: 'DOI con formato no válido.',
      target: t,
    });
  if (s.pmid && !/^\d{1,9}$/.test(s.pmid))
    out.push({ code: 'pmid_format', severity: 'error', message: 'PMID no numérico.', target: t });
  const verified =
    s.verificationStatus === 'verified' || s.verificationStatus === 'verified_with_corrections';
  if (verified && (!s.verifiedAt || !s.verificationMethod))
    out.push({
      code: 'verification_incomplete',
      severity: 'error',
      message: 'Verificada sin fecha o sin método de verificación.',
      target: t,
    });
  if (verified && !s.doi && !s.pmid)
    out.push({
      code: 'no_identifier',
      severity: 'warning',
      message: 'Fuente verificada sin DOI ni PMID.',
      target: t,
    });
  if (s.verificationStatus === 'retracted')
    out.push({
      code: 'retracted',
      severity: 'error',
      message: 'Artículo retractado: no puede respaldar recomendaciones.',
      target: t,
    });
  if (!s.populationSummary?.trim())
    out.push({
      code: 'no_population',
      severity: 'warning',
      message: 'Falta la población estudiada.',
      target: t,
    });
  return out;
}

export function qaFinding(f: QaFinding): QaIssue[] {
  const t = { type: 'finding' as const, key: f.key };
  const out: QaIssue[] = [];
  if (!f.quote?.trim())
    out.push({
      code: 'no_quote',
      severity: 'warning',
      message: 'Hallazgo sin cita literal de la fuente.',
      target: t,
    });
  if (
    f.effectValue != null &&
    f.quote &&
    !f.quote.includes(String(f.effectValue).replace('.', ',')) &&
    !f.quote.includes(String(f.effectValue))
  ) {
    out.push({
      code: 'number_not_in_quote',
      severity: 'warning',
      message: `El valor ${f.effectValue} no aparece en la cita literal: comprobar.`,
      target: t,
    });
  }
  return out;
}

export function qaClaim(
  c: QaClaim,
  findings: Map<string, QaFinding>,
  sources: Map<string, QaSource>,
): QaIssue[] {
  const t = { type: 'claim' as const, key: c.key };
  const out: QaIssue[] = [];
  const supports = c.findings.filter((f) => f.role === 'supports');
  if (!supports.length)
    out.push({
      code: 'no_support',
      severity: 'error',
      message: 'Afirmación sin hallazgos que la respalden.',
      target: t,
    });
  for (const l of c.findings) {
    const f = findings.get(l.findingKey);
    if (!f) {
      out.push({
        code: 'missing_finding',
        severity: 'error',
        message: `Hallazgo inexistente: ${l.findingKey}.`,
        target: t,
      });
      continue;
    }
    const s = sources.get(f.sourceKey);
    if (
      l.role === 'supports' &&
      (!s ||
        !(
          s.verificationStatus === 'verified' ||
          s.verificationStatus === 'verified_with_corrections'
        ))
    ) {
      out.push({
        code: 'unverified_support',
        severity: 'error',
        message: `Se apoya en una fuente no verificada (${f.sourceKey}).`,
        target: t,
      });
    }
  }
  if (CAUSAL_RE.test(c.statement)) {
    out.push({
      code: 'causal_language',
      severity: 'error',
      message:
        'Lenguaje causal o absoluto («previene», «garantiza»…): reformular según la evidencia.',
      target: t,
    });
  }
  if (NUMBER_RE.test(c.statement) && !supports.some((l) => findings.get(l.findingKey)?.quote)) {
    out.push({
      code: 'number_without_quote',
      severity: 'warning',
      message: 'La afirmación contiene cifras sin hallazgo con cita literal.',
      target: t,
    });
  }
  // Extrapolation: the claim says it applies to populations no supporting study covered.
  const studied = new Set(
    supports.map((l) => findings.get(l.findingKey)?.populationSlug).filter(Boolean),
  );
  const extra = c.appliesTo.filter((p) => !studied.has(p));
  if (extra.length) {
    out.push({
      code: 'extrapolation',
      severity: 'warning',
      message: `Se aplica a poblaciones no estudiadas en los hallazgos de apoyo: ${extra.join(', ')}.`,
      target: t,
    });
  }
  if (c.level === 'H' && c.status === 'published')
    out.push({
      code: 'published_unverified',
      severity: 'error',
      message: 'Publicada con nivel H.',
      target: t,
    });
  return out;
}
