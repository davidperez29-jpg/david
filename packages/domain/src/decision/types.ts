/**
 * Decision engine contracts (MASTER_SPECIFICATION §13.2). The engine is deterministic: the same
 * ClientContext + the same KnowledgeSnapshot (rule set version) always produce the same result.
 */
export type Quality =
  | 'max_strength'
  | 'hypertrophy'
  | 'power'
  | 'speed'
  | 'cod'
  | 'aerobic'
  | 'functional'
  | 'mobility';

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Confidence = 'high' | 'moderate' | 'low' | 'very_low';

export interface MetricFact {
  testSlug: string;
  name: string;
  value: number;
  unit: string;
  date: string;
  /** Verdict of the assessment engine against the previous value (MDC), if any. */
  change: string | null;
  /** Applicable reference classification, if a verified reference matches the client. */
  reference: 'low' | 'average' | 'high' | null;
}

export interface ClientContext {
  today: string;
  person: {
    age: number | null;
    sex: 'female' | 'male' | 'other' | 'undisclosed';
    experience: Experience | null;
    yearsTraining: number | null;
  };
  goals: {
    primary: {
      slug: string;
      family: string;
      sport: string | null;
      sportType: string | null;
    } | null;
    secondary: { slug: string; weight: number; sport: string | null }[];
  };
  /** Latest valid value per test slug. */
  metrics: Record<string, MetricFact>;
  /** Derived: relative strength (1RM / body mass), etc. */
  derived: Record<string, { value: number; unit: string; date: string; from: string }>;
  availability: { daysPerWeek: number | null; minutesPerSession: number | null };
  /** Equipment slugs available; null = unknown (no equipment filter). */
  equipment: string[] | null;
  /** Health-consented flags only; never a diagnosis. */
  tolerances: { notToleratedExerciseIds: string[]; restrictedPatterns: string[] };
  screening: 'clear' | 'refer' | 'unknown';
  response: {
    adherence28: number | null;
    /** Red pain alert open, or pain ≥ threshold recently (with consent). */
    painFlag: boolean;
    srpeHigh: boolean;
  };
  /** Trainer's manual assessments of traits when no applicable reference exists (§13.10). */
  manualTraits: Record<string, boolean>;
  modality: 'in_person' | 'online' | 'hybrid';
  /** Populations the client belongs to (for applicability). */
  populations: string[];
  /** Data the builder could not find (e.g. "Sin evaluación de fuerza en 90 días"). */
  missing: string[];
}

export interface ParamSpec {
  value: number | string | null;
  unit?: string;
  label: string;
  /** Where the value comes from; null default = the organization must set it. */
  source: string;
  evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
}

export type RuleAction =
  | { type: 'set_screening'; status: 'caution' | 'refer'; text: string }
  | { type: 'set_trait'; trait: string; value: boolean; text: string }
  | { type: 'raise_need'; quality: Quality; delta: number }
  | { type: 'set_direction'; quality: Quality; direction: 'mantener' }
  | { type: 'limit_priorities'; max: number }
  | { type: 'exclude_methods'; methods: string[]; reason: string }
  | { type: 'prefer_method'; method: string; reason: string }
  | { type: 'dose_note'; text: string }
  | { type: 'plan'; text: string }
  | { type: 'warn'; text: string };

export interface DecisionRule {
  key: string;
  version: number;
  domain:
    | 'screening'
    | 'needs'
    | 'prioritization'
    | 'method_selection'
    | 'exercise_selection'
    | 'dosing'
    | 'progression';
  description: string;
  condition: unknown;
  parameters: Record<string, ParamSpec>;
  action: RuleAction;
  evidenceClaimKeys: string[];
  evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  limitations: string;
  enabled: boolean;
}

export interface ClaimFact {
  key: string;
  statement: string;
  confidence: Confidence;
  appliesTo: string[];
  notFor: string[];
  /** Verified sources with DOI/PMID, for the "Evidencia" line. */
  sources: {
    citation: string;
    doi: string | null;
    pmid: string | null;
    /** Restructure phase 9: who was studied (§32). */
    population?: string | null;
  }[];
  /** Restructure phase 9: what the evidence measured and its limitations (§32). */
  evidenceKind?: string | null;
  limitations?: string | null;
}

export interface MethodFact {
  slug: string;
  name: string;
  kind: string;
  claimKeys: string[];
  variables: {
    key: string;
    min: number | null;
    max: number | null;
    typical: number | null;
    unit: string | null;
    population: string | null;
    claimKey: string | null;
  }[];
}

export interface ExerciseFact {
  id: string;
  name: string;
  pattern: string;
  level: Experience | null;
  complexity: number | null;
  impact: 'none' | 'low' | 'moderate' | 'high' | null;
  requiredEquipment: string[];
  methodSlugs: string[];
}

export interface TemplateFact {
  slug: string;
  name: string;
  goal: string;
  sessionsPerWeek: number;
  weeks: number;
}

export interface KnowledgeSnapshot {
  ruleSetVersion: number;
  rules: DecisionRule[];
  claims: Record<string, ClaimFact>;
  methods: MethodFact[];
  exercises: ExerciseFact[];
  templates: TemplateFact[];
  /** Rules disabled for this client (§13.9). */
  disabledRules: string[];
}

export interface Explanation {
  proposal: string;
  data: string[];
  interpretation: string[];
  rules: { key: string; version: number }[];
  evidence: {
    claimKey: string;
    statement: string;
    confidence: Confidence;
    sources: ClaimFact['sources'];
    evidenceKind?: string | null;
    limitations?: string | null;
  }[];
  applicability: string[];
  limitations: string[];
  confidence: Confidence;
}

export interface Need {
  quality: Quality;
  label: string;
  score: number;
  direction: 'desarrollar' | 'mantener' | 'no prioritario';
  explanation: Explanation;
}

export interface Priority {
  rank: number;
  quality: Quality;
  label: string;
  minutesPerWeek: number;
  sessionsPerWeek: number;
}

export interface MethodChoice {
  method: string;
  name: string;
  quality: Quality;
  rationale: string;
  excluded: false;
  explanation: Explanation;
}

export interface ExerciseCandidate {
  slot: string;
  method: string;
  candidates: { exerciseId: string; name: string; score: number; reasons: string[] }[];
  excluded: { exerciseId: string; name: string; reason: string }[];
}

export interface Dose {
  method: string;
  variable: string;
  min: number | null;
  max: number | null;
  suggested: number | null;
  unit: string | null;
  note: string | null;
  claimKey: string | null;
}

export interface DecisionResult {
  ruleSetVersion: number;
  screening: { status: 'clear' | 'caution' | 'refer'; reasons: string[] };
  traits: {
    key: string;
    label: string;
    value: boolean | null;
    basis: 'threshold' | 'reference' | 'manual' | 'change' | 'unknown';
    detail: string;
  }[];
  needs: Need[];
  priorities: Priority[];
  methods: MethodChoice[];
  excludedMethods: { method: string; reason: string; ruleKey: string }[];
  exercises: ExerciseCandidate[];
  doses: Dose[];
  introPhase: {
    level: 'ninguna' | 'introducción breve' | 'fase de adaptación';
    score: number;
    weeks: string;
    reasons: string[];
    explanation: Explanation;
  };
  planSkeleton: {
    templateSlug: string | null;
    templateName: string | null;
    sessionsPerWeek: number;
    reassessmentEveryWeeks: number;
    explanation: Explanation;
  } | null;
  warnings: string[];
  pendingRules: { key: string; params: string[] }[];
  /** Hash of the inputs: same hash + same rule set version → same result. */
  inputHash: string;
}
