import { z } from 'zod';
import { optionalText, paginationSchema } from './common';

export const STUDY_DESIGNS = [
  'guideline',
  'position_stand',
  'consensus',
  'umbrella_review',
  'systematic_review',
  'meta_analysis',
  'rct',
  'non_randomized_trial',
  'cohort',
  'cross_sectional',
  'case_series',
  'mechanistic',
  'narrative_review',
  'expert_opinion',
  'book',
  'website',
] as const;
export const TRAINING_STATUS = [
  'untrained',
  'recreational',
  'trained',
  'highly_trained',
  'elite',
  'mixed',
  'unknown',
] as const;
export const SEX_SCOPE = ['female', 'male', 'mixed', 'unknown'] as const;
export const EPISTEMIC = ['fact', 'inference', 'hypothesis', 'opinion'] as const;
export const CONFIDENCE = ['high', 'moderate', 'low', 'very_low'] as const;
export const EVIDENCE_ROLE = ['supports', 'contradicts', 'context'] as const;
export const METHOD_KINDS = [
  'training_method',
  'contraction_type',
  'organization_method',
  'autoregulation_method',
  'conditioning_method',
] as const;
export const METHOD_NOTE_KINDS = [
  'mechanism',
  'indication',
  'precaution',
  'progression',
  'limitation',
] as const;
const concern = z.enum(['no', 'serious']);

const authors = z.array(z.string().trim().min(1).max(120)).max(60);
const sourceFields = z.object({
  title: z.string().trim().min(5).max(500),
  authors,
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  journal: optionalText(200),
  volume: optionalText(20),
  issue: optionalText(20),
  pages: optionalText(30),
  doi: z
    .string()
    .trim()
    .regex(/^10\.[0-9]{4,9}\/\S+$/, 'DOI no válido (debe empezar por 10.)')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  pmid: z
    .string()
    .trim()
    .regex(/^[0-9]{1,9}$/, 'PMID no válido')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  url: z
    .url()
    .max(500)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  studyDesign: z.enum(STUDY_DESIGNS),
  populationSummary: optionalText(1000),
  ageRange: optionalText(60),
  sex: z.enum(SEX_SCOPE).nullable().optional(),
  trainingStatus: z.enum(TRAINING_STATUS).nullable().optional(),
  sport: optionalText(80),
  intervention: optionalText(1000),
  comparison: optionalText(1000),
  outcomesMeasured: optionalText(1000),
  resultsSummary: optionalText(3000),
  limitations: optionalText(2000),
  practicalApplication: optionalText(2000),
});
export const sourceSchema = sourceFields.extend({ authors: authors.default([]) });
export const updateSourceSchema = sourceFields
  .partial()
  .extend({ expectedVersion: z.coerce.number().int().min(1) });

export const verifySourceSchema = z.object({
  status: z.enum([
    'verified',
    'verified_with_corrections',
    'unverified',
    'retracted',
    'non_scientific',
  ]),
  access: z.enum(['full_text', 'abstract_only', 'secondary_source', 'not_accessed']),
  verificationMethod: z.string().trim().min(3).max(300),
  corrections: optionalText(1000),
});

export const gradingSchema = z.object({
  basedOnSystematicReview: z.boolean().optional(),
  riskOfBias: concern,
  inconsistency: z.enum(['no', 'serious', 'contradictory']),
  indirectness: concern,
  imprecision: concern,
  publicationBias: concern,
});

const num = z.coerce.number().finite().nullable().optional();
export const findingSchema = z.object({
  outcomeId: z.uuid(),
  populationId: z.uuid(),
  intervention: optionalText(1000),
  comparator: optionalText(1000),
  effectMetric: optionalText(40),
  effectValue: num,
  ciLow: num,
  ciHigh: num,
  nStudies: z.coerce.number().int().min(0).nullable().optional(),
  nParticipants: z.coerce.number().int().min(0).nullable().optional(),
  heterogeneityI2: num,
  quote: z.string().trim().min(5).max(600),
  grading: gradingSchema,
  epistemicType: z.enum(EPISTEMIC).default('fact'),
});

const claimEvidenceLinks = z
  .array(z.object({ findingId: z.uuid(), role: z.enum(EVIDENCE_ROLE) }))
  .max(40);
const populationSlugs = z.array(z.string().max(60)).max(20);
// No defaults here: `.partial()` keeps zod defaults, and an update must not wipe what it did not send.
const claimFields = {
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_.-]{3,80}$/, 'Clave: minúsculas, números, _ . -'),
  statement: z.string().trim().min(10).max(1000),
  scope: optionalText(200),
  epistemicType: z.enum(EPISTEMIC),
  confidence: z.enum(CONFIDENCE),
  limitations: optionalText(2000),
  appliesTo: populationSlugs,
  notFor: populationSlugs,
  findings: claimEvidenceLinks,
};
export const claimSchema = z.object({
  ...claimFields,
  appliesTo: populationSlugs.default([]),
  notFor: populationSlugs.default([]),
  findings: claimEvidenceLinks.default([]),
});
export const updateClaimSchema = z
  .object(claimFields)
  .partial()
  .extend({ expectedVersion: z.coerce.number().int().min(1) });
export const statusSchema = z.object({
  status: z.enum(['draft', 'reviewed', 'published', 'deprecated']),
});

export const evidenceReviewSchema = z.object({
  target: z.enum(['source', 'claim']),
  targetId: z.uuid(),
  outcome: z.enum(['approved', 'changes_requested', 'rejected']),
  checklist: z.object({
    numbersMatchSource: z.boolean(),
    populationRespected: z.boolean(),
    noCorrelationAsCausation: z.boolean(),
    noMechanismAsClinicalOutcome: z.boolean(),
    noInjuryPreventionAsFact: z.boolean(),
    contraryEvidenceRecorded: z.boolean(),
  }),
  notes: optionalText(2000),
});

export const methodSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(METHOD_KINDS),
  parentMethodId: z.uuid().nullable().optional(),
  definition: optionalText(3000),
  summaryForTrainer: optionalText(3000),
  summaryForClient: optionalText(600),
  notes: z
    .array(
      z.object({
        kind: z.enum(METHOD_NOTE_KINDS),
        text: z.string().trim().min(2).max(1000),
        claimId: z.uuid().nullable().optional(),
      }),
    )
    .max(60)
    .optional(),
  variables: z
    .array(
      z.object({
        variableKey: z.string().max(60),
        populationId: z.uuid().nullable().optional(),
        minValue: num,
        maxValue: num,
        typicalValue: num,
        unit: optionalText(20),
        claimId: z.uuid().nullable().optional(),
        isDefaultSuggestion: z.boolean().default(false),
        notes: optionalText(500),
      }),
    )
    .max(40)
    .optional(),
  findings: z
    .array(z.object({ findingId: z.uuid(), role: z.enum(EVIDENCE_ROLE) }))
    .max(80)
    .optional(),
});
export const updateMethodSchema = methodSchema
  .partial()
  .extend({ expectedVersion: z.coerce.number().int().min(1) });

export const listScienceSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  level: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).optional(),
  status: z.string().max(30).optional(),
  design: z.enum(STUDY_DESIGNS).optional(),
});

export const exerciseMethodsSchema = z.object({ methodIds: z.array(z.uuid()).max(20) });
