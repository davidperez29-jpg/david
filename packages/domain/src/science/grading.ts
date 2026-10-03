/**
 * Evidence grading with explicit criteria (MASTER_SPECIFICATION §0.2, §10.4). The level is
 * DERIVED from a structured rationale — never typed by hand — so that a letter always has
 * reasons behind it. Inspired by GRADE (start by design, downgrade for limitations) but it is
 * our own operational scale and must be presented together with population, applicability,
 * limitations and uncertainty.
 */
export const EVIDENCE_LEVELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const LEVEL_LABELS: Record<EvidenceLevel, string> = {
  A: 'Evidencia fuerte',
  B: 'Evidencia moderada',
  C: 'Evidencia limitada',
  D: 'Evidencia contradictoria',
  E: 'Mecanismo plausible',
  F: 'Recomendación práctica',
  G: 'Opinión',
  H: 'No verificada',
};

export type StudyDesign =
  | 'guideline'
  | 'position_stand'
  | 'consensus'
  | 'umbrella_review'
  | 'systematic_review'
  | 'meta_analysis'
  | 'rct'
  | 'non_randomized_trial'
  | 'cohort'
  | 'cross_sectional'
  | 'case_series'
  | 'mechanistic'
  | 'narrative_review'
  | 'expert_opinion'
  | 'book'
  | 'website';

export type Concern = 'no' | 'serious';

export interface GradingRationale {
  design: StudyDesign;
  /** Guidelines/position stands/consensus count as A only when built on a systematic review. */
  basedOnSystematicReview?: boolean;
  riskOfBias: Concern;
  inconsistency: Concern | 'contradictory';
  /** Population/intervention/outcome differ from the intended use. */
  indirectness: Concern;
  imprecision: Concern;
  publicationBias: Concern;
}

export interface GradeResult {
  level: EvidenceLevel;
  startingLevel: EvidenceLevel;
  downgrades: string[];
  explanation: string;
}

function startingLevel(r: GradingRationale): EvidenceLevel {
  switch (r.design) {
    case 'umbrella_review':
    case 'systematic_review':
    case 'meta_analysis':
      return 'A';
    case 'guideline':
    case 'position_stand':
    case 'consensus':
      return r.basedOnSystematicReview ? 'A' : 'F';
    case 'rct':
      return 'B';
    case 'non_randomized_trial':
    case 'cohort':
    case 'cross_sectional':
    case 'case_series':
      return 'C';
    case 'mechanistic':
      return 'E';
    case 'narrative_review':
    case 'expert_opinion':
    case 'book':
    case 'website':
      return 'G';
  }
}

const DOWN: Partial<Record<EvidenceLevel, EvidenceLevel>> = { A: 'B', B: 'C', C: 'C' };

const REASONS: [keyof GradingRationale, string][] = [
  ['riskOfBias', 'riesgo de sesgo'],
  ['inconsistency', 'inconsistencia entre estudios'],
  ['indirectness', 'aplicabilidad indirecta (población, intervención o desenlace distintos)'],
  ['imprecision', 'imprecisión (pocos estudios/participantes o IC amplio)'],
  ['publicationBias', 'posible sesgo de publicación'],
];

export function gradeFinding(r: GradingRationale, verified: boolean): GradeResult {
  const start = startingLevel(r);
  if (!verified) {
    return {
      level: 'H',
      startingLevel: start,
      downgrades: ['fuente no verificada'],
      explanation: 'Fuente no verificada: nivel H hasta su verificación.',
    };
  }
  if (r.inconsistency === 'contradictory') {
    return {
      level: 'D',
      startingLevel: start,
      downgrades: ['resultados contradictorios'],
      explanation: 'Fuentes de calidad similar con conclusiones opuestas.',
    };
  }
  let level = start;
  const downgrades: string[] = [];
  // Only the evidence-based ladder (A→B→C) is downgraded; E/F/G describe the kind of support.
  if (level === 'A' || level === 'B' || level === 'C') {
    for (const [key, reason] of REASONS) {
      if (r[key] === 'serious') {
        downgrades.push(reason);
        level = DOWN[level] ?? level;
      }
    }
  }
  const explanation =
    `Nivel de partida ${start} (${designLabel(r.design)})` +
    (downgrades.length ? `; baja por ${downgrades.join(', ')}` : '; sin motivos para bajar') +
    `. Resultado: ${level} — ${LEVEL_LABELS[level]}.`;
  return { level, startingLevel: start, downgrades, explanation };
}

export function designLabel(d: StudyDesign): string {
  const m: Record<StudyDesign, string> = {
    guideline: 'guía',
    position_stand: 'posicionamiento oficial',
    consensus: 'consenso',
    umbrella_review: 'revisión paraguas',
    systematic_review: 'revisión sistemática',
    meta_analysis: 'metaanálisis',
    rct: 'ensayo aleatorizado',
    non_randomized_trial: 'ensayo no aleatorizado',
    cohort: 'cohortes',
    cross_sectional: 'transversal',
    case_series: 'serie de casos',
    mechanistic: 'estudio mecanístico',
    narrative_review: 'revisión narrativa',
    expert_opinion: 'opinión de expertos',
    book: 'libro',
    website: 'web',
  };
  return m[d];
}

/** Strength order on the evidence ladder (higher = stronger). D/E/F/G/H are not "stronger" than C. */
const RANK: Record<EvidenceLevel, number> = { A: 6, B: 5, C: 4, E: 3, F: 2, G: 1, D: 0, H: -1 };

export function compareLevels(a: EvidenceLevel, b: EvidenceLevel): number {
  return RANK[a] - RANK[b];
}

export interface ClaimEvidence {
  level: EvidenceLevel;
  role: 'supports' | 'contradicts' | 'context';
}

/**
 * Level of a claim from its findings: best supporting level, unless a contradicting finding of
 * comparable strength exists (within one step on the A–C ladder) → D. No support → H.
 */
export function claimLevel(evidence: ClaimEvidence[]): EvidenceLevel {
  const sup = evidence.filter((e) => e.role === 'supports').map((e) => e.level);
  if (!sup.length) return 'H';
  const best = [...sup].sort((a, b) => compareLevels(b, a))[0]!;
  const contra = evidence.filter((e) => e.role === 'contradicts').map((e) => e.level);
  const strongContra = contra.some((c) => RANK[c] >= 4 && RANK[best] - RANK[c] <= 1);
  return strongContra ? 'D' : best;
}
