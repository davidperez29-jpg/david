import { z } from 'zod';
import { isoDate, nonEmpty, optionalText } from './common';

/** Injury, readaptation and return to sport (restructure phase 7, docs/INJURY_MODULE.md). */
export const INJURY_SIDES = ['left', 'right', 'both', 'none'] as const;
export const RTP_STAGE_VALUES = [
  'return_to_participation',
  'return_to_sport',
  'return_to_performance',
] as const;
export const RTP_OUTCOME_VALUES = ['authorized', 'not_yet', 'deferred'] as const;

export const openInjurySchema = z.object({
  conditionId: z.uuid(),
  /** A protocol of the condition (optional: a case may start without one). */
  protocolId: z.uuid().nullable().optional(),
  side: z.enum(INJURY_SIDES).default('none'),
  occurredOn: isoDate,
  mechanism: optionalText(500),
  /** Information received from the health professional (stored encrypted, never generated). */
  diagnosis: optionalText(2000),
  professional: optionalText(200),
  clinicalClearanceOn: isoDate.nullable().optional(),
  restrictions: optionalText(1000),
  notes: optionalText(2000),
});

export const symptomSchema = z.object({
  recordedOn: isoDate,
  pain: z.coerce.number().int().min(0).max(10),
  worseThanBefore: z.boolean().default(false),
  persistsNextDay: z.boolean().default(false),
  functionLoss: z.boolean().default(false),
  neurological: z.boolean().default(false),
  swelling: z.boolean().default(false),
  instability: z.boolean().default(false),
  adverseReaction: z.boolean().default(false),
  note: optionalText(1000),
});

export const reviewAlertSchema = z.object({ note: nonEmpty(1000) });

export const criterionCheckSchema = z.object({
  criterionId: z.uuid(),
  met: z.boolean(),
  note: optionalText(500),
});

export const advancePhaseSchema = z.object({
  /** Optimistic lock: the phase the trainer saw. */
  fromPhaseId: z.uuid(),
  note: optionalText(500),
});

export const rtpDecisionSchema = z.object({
  stage: z.enum(RTP_STAGE_VALUES),
  outcome: z.enum(RTP_OUTCOME_VALUES),
  decidedByName: nonEmpty(120),
  decidedByRole: nonEmpty(120),
  decidedOn: isoDate,
  rationale: optionalText(2000),
});

export const closeInjurySchema = z.object({ note: optionalText(500) });

export const injuryComparisonQuerySchema = z.object({
  a: z.uuid().optional(),
  b: z.uuid().optional(),
});
