/**
 * Evidence kind, origin and verification (restructure phase 9, docs/SCIENCE_SYSTEM.md §2–§5).
 *
 * The app must tell a change in a risk factor apart from a real reduction of injury incidence:
 * «reduce la incidencia / el riesgo de lesión» is only allowed when the claim's evidence measured
 * incidence; «previene» is never allowed (QA `causal_language`).
 */
export const EVIDENCE_KINDS = {
  incidence_reduction: 'Reducción de la incidencia',
  risk_factor_change: 'Cambio en un factor de riesgo',
  performance: 'Rendimiento',
  mechanism: 'Mecanismo o plausibilidad',
  practical_criterion: 'Criterio práctico',
  insufficient: 'Evidencia insuficiente',
} as const;
export type EvidenceKind = keyof typeof EVIDENCE_KINDS;

/** What each kind allows the app to say (§3). */
export const EVIDENCE_KIND_MAY_SAY: Record<EvidenceKind, string> = {
  incidence_reduction: 'Reduce la incidencia de la lesión estudiada en la población estudiada.',
  risk_factor_change:
    'Mejora una variable asociada a la lesión; no demuestra que reduzca lesiones.',
  performance: 'Mejora el rendimiento medido en la población estudiada.',
  mechanism: 'Justificación fisiológica; sin estudios de resultado.',
  practical_criterion: 'Criterio práctico de trabajo, sin respaldo publicado suficiente.',
  insufficient: 'Evidencia insuficiente.',
};

export const ORIGINS = {
  user_document: 'Documento del entrenador',
  external_literature: 'Literatura externa',
  practical_proposal: 'Propuesta práctica',
} as const;
export type Origin = keyof typeof ORIGINS;

export type VerificationStatus =
  | 'verified'
  | 'verified_with_corrections'
  | 'unverified'
  | 'cited_in_document'
  | 'unverifiable'
  | 'retracted'
  | 'non_scientific';
export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verificada',
  verified_with_corrections: 'Verificada con correcciones',
  unverified: 'Sin verificar',
  cited_in_document: 'Citada en un documento (pendiente de verificar)',
  unverifiable: 'No verificable',
  retracted: 'Retractada',
  non_scientific: 'No científica',
};

/** Only a verified source can appear as support of anything. */
export function canSupport(v: VerificationStatus | string | null | undefined): boolean {
  return v === 'verified' || v === 'verified_with_corrections';
}

/** Outcomes that measure incidence (not a risk factor). */
export const INCIDENCE_OUTCOMES = new Set([
  'injury_incidence',
  'reinjury',
  'falls',
  'illness_incidence',
]);
const PERFORMANCE_DOMAINS = new Set([
  'strength',
  'power',
  'speed',
  'endurance',
  'muscle',
  'body_composition',
]);
const RISK_FACTOR_DOMAINS = new Set([
  'biomechanics',
  'assessment',
  'mobility',
  'tissue',
  'neuromuscular',
]);

/**
 * Default kind of a claim from its supporting findings when the curator did not set one. A
 * practical (level F/G) or unsupported claim never becomes evidence. The curator can override.
 */
export function inferEvidenceKind(c: {
  epistemicType: string;
  level: string;
  supportOutcomes: { slug: string; domain: string }[];
}): EvidenceKind {
  if (c.level === 'H' || !c.supportOutcomes.length) return 'insufficient';
  // What the studies measured decides; a cautious wording (hypothesis) does not change it.
  if (c.supportOutcomes.some((o) => INCIDENCE_OUTCOMES.has(o.slug))) return 'incidence_reduction';
  if (c.epistemicType === 'hypothesis') return 'mechanism';
  if (c.supportOutcomes.some((o) => PERFORMANCE_DOMAINS.has(o.domain))) return 'performance';
  if (c.supportOutcomes.some((o) => RISK_FACTOR_DOMAINS.has(o.domain))) return 'risk_factor_change';
  if (c.level === 'F' || c.level === 'G') return 'practical_criterion';
  return 'performance';
}

const INCIDENCE_CLAIM_RE =
  /\b(reduce[n]?|disminuye[n]?|baja[n]?|menor(?:es)?)\b[^.;:]{0,40}?\b(riesgo|incidencia|n[uú]mero|tasa|prevalencia)\b[^.;:]{0,20}?\b(de\s+)?(lesi[oó]n(es)?|ca[ií]das|reles(i[oó]n|iones)|problemas)\b/iu;

/**
 * A statement that claims fewer injuries (or falls) needs evidence that measured incidence.
 * Returns the problem, or null.
 */
export function evidenceKindIssue(statement: string, kind: EvidenceKind | null): string | null {
  if (!INCIDENCE_CLAIM_RE.test(statement)) return null;
  if (kind === 'incidence_reduction') return null;
  return 'La afirmación habla de menos lesiones, pero su evidencia no midió la incidencia de lesiones: di qué variable mejora («mejora X, asociada a Y; no demuestra que reduzca lesiones»).';
}
